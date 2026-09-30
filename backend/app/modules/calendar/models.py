from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import TimestampMixin, uuid_fk, uuid_pk


class Holiday(db.Model, TimestampMixin):
    __tablename__ = "holidays"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str | None] = uuid_fk("organizations.id", nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False, default="manual")

    __table_args__ = (
        Index("ix_holidays_org_date", "organization_id", "date", unique=True),
    )
