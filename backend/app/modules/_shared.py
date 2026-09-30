"""Helpers e mixins compartilhados pelos modelos."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


def uuid_pk() -> Mapped[str]:
    return mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )


def uuid_fk(
    target: str,
    *,
    nullable: bool = False,
    ondelete: str | None = None,
    use_alter: bool = False,
):
    return mapped_column(
        UUID(as_uuid=False),
        ForeignKey(target, ondelete=ondelete, use_alter=use_alter)
        if ondelete
        else ForeignKey(target, use_alter=use_alter),
        nullable=nullable,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ArchivableMixin:
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
