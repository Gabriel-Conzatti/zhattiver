from __future__ import annotations

import hashlib
import secrets
import smtplib
import ssl
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from urllib.parse import urlencode

from flask import current_app
from sqlalchemy import select

from app.extensions import db
from app.modules.auth.models import PasswordResetToken
from app.modules.users.models import User

GENERIC_REQUEST_MESSAGE = (
    "Se existir uma conta ativa para este e-mail, enviaremos as instruções."
)


class PasswordResetDeliveryError(RuntimeError):
    pass


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_password_reset_token(user: User) -> str | None:
    now = datetime.now(UTC)
    locked_user = db.session.scalar(
        select(User).where(User.id == user.id).with_for_update()
    )
    if locked_user is None or not locked_user.is_active:
        return None
    user = locked_user
    cooldown = timedelta(
        seconds=current_app.config[
            "LYNK_PASSWORD_RESET_COOLDOWN_SECONDS"
        ]
    )
    recent_token = db.session.scalar(
        select(PasswordResetToken.id).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.created_at >= now - cooldown,
        )
    )
    if recent_token is not None:
        return None

    open_tokens = db.session.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    for open_token in open_tokens:
        open_token.used_at = now

    raw_token = secrets.token_urlsafe(32)
    db.session.add(
        PasswordResetToken(
            organization_id=user.organization_id,
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=now
            + timedelta(
                minutes=current_app.config[
                    "LYNK_PASSWORD_RESET_TTL_MINUTES"
                ]
            ),
        )
    )
    db.session.commit()
    return raw_token


def find_valid_password_reset_token(
    raw_token: str,
) -> PasswordResetToken | None:
    now = datetime.now(UTC)
    return db.session.scalar(
        select(PasswordResetToken)
        .join(User, User.id == PasswordResetToken.user_id)
        .where(
            PasswordResetToken.token_hash == hash_reset_token(raw_token),
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
            User.is_active.is_(True),
        )
        .with_for_update()
    )


def consume_user_password_reset_tokens(user_id: str, used_at: datetime) -> None:
    open_tokens = db.session.scalars(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    for open_token in open_tokens:
        open_token.used_at = used_at


def send_password_reset_email(user: User, raw_token: str) -> None:
    host = current_app.config.get("LYNK_SMTP_HOST")
    sender = current_app.config.get("LYNK_SMTP_FROM")
    if not host or not sender:
        raise PasswordResetDeliveryError(
            "SMTP não está configurado para recuperação de senha"
        )

    query = urlencode({"token": raw_token})
    reset_url = (
        f"{current_app.config['LYNK_PUBLIC_URL']}/redefinir-senha?{query}"
    )
    message = EmailMessage()
    message["Subject"] = "Redefinição de senha - Funil Sustentare"
    message["From"] = sender
    message["To"] = user.email
    message.set_content(
        "\n".join(
            [
                f"Olá, {user.name}.",
                "",
                "Recebemos uma solicitação para redefinir sua senha.",
                "Acesse o link abaixo para criar uma nova senha:",
                reset_url,
                "",
                "Se você não solicitou esta alteração, ignore esta mensagem.",
            ]
        )
    )

    try:
        with smtplib.SMTP(
            host,
            current_app.config["LYNK_SMTP_PORT"],
            timeout=10,
        ) as smtp:
            smtp.starttls(context=ssl.create_default_context())
            username = current_app.config.get("LYNK_SMTP_USERNAME")
            password = current_app.config.get("LYNK_SMTP_PASSWORD")
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException):
        raise PasswordResetDeliveryError(
            "Falha ao enviar recuperação de senha"
        ) from None
