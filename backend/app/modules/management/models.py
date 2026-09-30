from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk


class Absence(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "absences"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    user_id: Mapped[str] = uuid_fk("users.id")
    substitute_user_id: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    starts_on: Mapped[date] = mapped_column(Date, nullable=False)
    ends_on: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("ix_absences_user_period", "user_id", "starts_on"),
    )
