from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk

STATE_SCHEDULED = "scheduled"
STATE_CONTACTED = "contacted"
STATE_RESOLVED = "resolved"
STATE_CANCELLED = "cancelled"
SCHEDULE_STATES = (STATE_SCHEDULED, STATE_CONTACTED, STATE_RESOLVED, STATE_CANCELLED)


class Schedule(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "schedules"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id", ondelete="CASCADE")
    product_id: Mapped[str] = uuid_fk("products.id")
    owner_user_id: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    coverage_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    date_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    insurer_id: Mapped[str | None] = uuid_fk("insurers.id", nullable=True)
    vehicle_id: Mapped[str | None] = uuid_fk("vehicles.id", nullable=True)
    origin_id: Mapped[str | None] = uuid_fk("origins.id", nullable=True)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default=STATE_SCHEDULED)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    previous_schedule_id: Mapped[str | None] = uuid_fk("schedules.id", nullable=True)
    # use_alter quebra o ciclo schedules<->opportunities (opportunities referencia schedules)
    contacted_opportunity_id: Mapped[str | None] = uuid_fk(
        "opportunities.id", nullable=True, use_alter=True
    )

    __table_args__ = (
        Index("ix_schedules_org_coverage", "organization_id", "coverage_end_date"),
        Index("ix_schedules_owner_state", "owner_user_id", "state"),
    )
