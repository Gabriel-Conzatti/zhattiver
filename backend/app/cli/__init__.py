from __future__ import annotations

from getpass import getpass

import click
from flask import Flask
from sqlalchemy import select

from ..core.auth import hash_password
from ..extensions import db
from ..modules.catalog.models import ClientType, Insurer, Origin
from ..modules.funnel.models import Funnel, FunnelStage
from ..modules.opportunities.models import LossReason, NextActionType
from ..modules.orgs.models import Organization
from ..modules.users.models import ROLE_ADMIN, Product, User


DEFAULT_ORIGINS = ["Placas", "Indicação", "Renovação", "Prospecção", "Cliente ativo", "Novo"]
DEFAULT_CLIENT_TYPES = ["Novo", "Recuperado", "Cliente ativo"]
DEFAULT_INSURERS = ["Porto Seguro", "Bradesco", "Allianz", "SulAmérica", "Tokio Marine"]
DEFAULT_PRODUCTS = [("Seguro Automóvel", "auto")]
DEFAULT_LOSS_REASONS = [
    "Preço",
    "Renovou com concorrente",
    "Sem interesse",
    "Não respondeu",
    "Dados inválidos",
    "Não foi possível cotar",
    "Outro",
]
DEFAULT_NEXT_ACTION_TYPES = [
    ("Mensagem", "message"),
    ("Ligação", "call"),
    ("Retorno", "callback"),
    ("Reunião", "meeting"),
    ("Enviar cotação", "send-quote"),
    ("Cobrar resposta", "chase-response"),
    ("Outro", "other"),
]

DEFAULT_STAGES = [
    ("Mensagem inicial", True, False, "Olá {nome_cliente}, aqui é {nome_vendedor} da corretora. Podemos falar sobre seu seguro?"),
    ("Questionário", False, False, None),
    ("Negociação", False, False, None),
    ("Reengajamento", False, False, None),
    ("Finalização", False, False, None),
    ("Transmitido", False, True, None),
]


def register(app: Flask) -> None:
    group = click.Group("lynk", help="Comandos administrativos do Lynk")

    @group.command("create-admin", help="Cria um administrador inicial")
    @click.option("--org-name", default="Corretora", show_default=True)
    @click.option("--org-slug", default="default", show_default=True)
    @click.option("--email", required=False)
    @click.option("--name", required=False)
    def create_admin(org_name: str, org_slug: str, email: str | None, name: str | None):
        email = (email or click.prompt("Email")).strip().lower()
        name = name or click.prompt("Nome")
        password = getpass("Senha (não será exibida): ")
        password_confirm = getpass("Confirme a senha: ")
        if password != password_confirm:
            raise click.ClickException("As senhas não conferem")
        if len(password) < 10:
            raise click.ClickException("A senha deve ter pelo menos 10 caracteres")

        org = db.session.execute(
            select(Organization).where(Organization.slug == org_slug)
        ).scalar_one_or_none()
        if org is None:
            org = Organization(name=org_name, slug=org_slug)
            db.session.add(org)
            db.session.flush()

        _seed_defaults(org.id)

        existing = db.session.execute(
            select(User).where(User.email == email)
        ).scalar_one_or_none()
        if existing is not None:
            raise click.ClickException("Já existe um usuário com esse email")

        admin = User(
            organization_id=org.id,
            email=email,
            name=name,
            password_hash=hash_password(password),
            role=ROLE_ADMIN,
            is_active=True,
        )
        db.session.add(admin)
        db.session.commit()
        click.echo(f"Administrador criado: {email} (org={org.slug})")

    @group.command("seed-dev", help="Popula dados fictícios (apenas em desenvolvimento)")
    def seed_dev():
        if app.config["LYNK_ENV"] != "development":
            raise click.ClickException("Somente disponível em desenvolvimento")
        click.echo("Seed de desenvolvimento ainda não implementado (Etapa 3+).")

    @group.command("set-prospecting-quota", help="Define quota diária de prospecção do vendedor (RN-005)")
    @click.option("--email", required=True)
    @click.option("--quota", required=True, type=int)
    @click.option("--effective-from", default=None, help="ISO date; padrão hoje")
    def set_quota(email: str, quota: int, effective_from: str | None):
        from datetime import date

        from ..modules.goals.models import DailyProspectingQuota

        user = db.session.execute(
            select(User).where(User.email == email.lower())
        ).scalar_one_or_none()
        if user is None:
            raise click.ClickException("Usuário não encontrado")
        start = date.fromisoformat(effective_from) if effective_from else date.today()
        # Encerra vigências abertas anteriores
        for q in db.session.execute(
            select(DailyProspectingQuota).where(
                DailyProspectingQuota.user_id == user.id,
                DailyProspectingQuota.effective_to.is_(None),
            )
        ).scalars().all():
            q.effective_to = start
        db.session.add(
            DailyProspectingQuota(
                organization_id=user.organization_id,
                user_id=user.id,
                quota=quota,
                effective_from=start,
            )
        )
        db.session.commit()
        click.echo(f"Quota diária de {email} = {quota} a partir de {start}")

    app.cli.add_command(group)


def _seed_defaults(organization_id: str) -> None:
    """Garante catálogos e produto padrão para a organização."""

    def _slug(name: str) -> str:
        import re

        return re.sub(r"[^\w]+", "-", name.strip().lower(), flags=re.UNICODE).strip("-")

    for name in DEFAULT_ORIGINS:
        exists = db.session.execute(
            select(Origin).where(
                Origin.organization_id == organization_id,
                Origin.slug == _slug(name),
            )
        ).scalar_one_or_none()
        if exists is None:
            db.session.add(
                Origin(organization_id=organization_id, name=name, slug=_slug(name))
            )
    for name in DEFAULT_CLIENT_TYPES:
        exists = db.session.execute(
            select(ClientType).where(
                ClientType.organization_id == organization_id,
                ClientType.slug == _slug(name),
            )
        ).scalar_one_or_none()
        if exists is None:
            db.session.add(
                ClientType(organization_id=organization_id, name=name, slug=_slug(name))
            )
    for name in DEFAULT_INSURERS:
        exists = db.session.execute(
            select(Insurer).where(
                Insurer.organization_id == organization_id,
                Insurer.name == name,
            )
        ).scalar_one_or_none()
        if exists is None:
            db.session.add(Insurer(organization_id=organization_id, name=name))
    for name, slug in DEFAULT_PRODUCTS:
        product = db.session.execute(
            select(Product).where(
                Product.organization_id == organization_id,
                Product.slug == slug,
            )
        ).scalar_one_or_none()
        if product is None:
            product = Product(organization_id=organization_id, name=name, slug=slug)
            db.session.add(product)
            db.session.flush()

        funnel = db.session.execute(
            select(Funnel).where(
                Funnel.organization_id == organization_id,
                Funnel.product_id == product.id,
            )
        ).scalar_one_or_none()
        if funnel is None:
            funnel = Funnel(
                organization_id=organization_id,
                product_id=product.id,
                name=f"Funil {name}",
                is_default=True,
            )
            db.session.add(funnel)
            db.session.flush()
            for idx, (stage_name, is_initial, is_final, template) in enumerate(DEFAULT_STAGES):
                db.session.add(
                    FunnelStage(
                        organization_id=organization_id,
                        funnel_id=funnel.id,
                        name=stage_name,
                        order_index=idx,
                        is_initial=is_initial,
                        is_final=is_final,
                        message_template=template,
                    )
                )

    for name in DEFAULT_LOSS_REASONS:
        exists = db.session.execute(
            select(LossReason).where(
                LossReason.organization_id == organization_id,
                LossReason.slug == _slug(name),
            )
        ).scalar_one_or_none()
        if exists is None:
            db.session.add(
                LossReason(
                    organization_id=organization_id,
                    name=name,
                    slug=_slug(name),
                )
            )
    for name, slug in DEFAULT_NEXT_ACTION_TYPES:
        exists = db.session.execute(
            select(NextActionType).where(
                NextActionType.organization_id == organization_id,
                NextActionType.slug == slug,
            )
        ).scalar_one_or_none()
        if exists is None:
            db.session.add(
                NextActionType(organization_id=organization_id, name=name, slug=slug)
            )
    db.session.flush()
