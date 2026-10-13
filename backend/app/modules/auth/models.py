from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db
from app.modules._shared import TimestampMixin, uuid_fk, uuid_pk


class PasswordResetToken(TimestampMixin, db.Model):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        Index(
            "ix_password_reset_tokens_user_open",
            "user_id",
            "used_at",
            "expires_at",
        ),
    )

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk(
        "organizations.id", ondelete="CASCADE"
    )
    user_id: Mapped[str] = uuid_fk("users.id", ondelete="CASCADE")
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
