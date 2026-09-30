from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import TimestampMixin, uuid_fk, uuid_pk

KIND_LEAD_RELEASED = "lead_released"
KIND_SALE_PENDING = "sale_pending"
KIND_TRANSFER = "transfer"
KIND_ABSENCE = "absence"
KIND_CROSS_SELL_LIST = "cross_sell_list"
KIND_CROSS_SELL_ASSIGN = "cross_sell_assign"


class Notification(db.Model, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    user_id: Mapped[str] = uuid_fk("users.id")
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    link_path: Mapped[str | None] = mapped_column(String(200), nullable=True)
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dedup_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", "dedup_key", name="uq_notifications_dedup"),
        Index("ix_notifications_user_read", "user_id", "read_at"),
    )
