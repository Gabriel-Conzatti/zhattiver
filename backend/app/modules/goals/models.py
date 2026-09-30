from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import TimestampMixin, uuid_fk, uuid_pk


class DailyProspectingQuota(db.Model, TimestampMixin):
    """Quota diária de primeiros contatos por vendedor com vigência (RN-005/RN-044)."""

    __tablename__ = "daily_prospecting_quotas"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    user_id: Mapped[str] = uuid_fk("users.id")
    quota: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index("ix_dpq_user_effective", "user_id", "effective_from"),
    )
