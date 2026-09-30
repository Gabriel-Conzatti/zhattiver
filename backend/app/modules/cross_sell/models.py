from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk

LIST_STATE_DRAFT = "draft"
LIST_STATE_PARTIAL = "partial"
LIST_STATE_RELEASED = "released"
LIST_STATES = (LIST_STATE_DRAFT, LIST_STATE_PARTIAL, LIST_STATE_RELEASED)


class CrossSellList(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "cross_sell_lists"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_product_id: Mapped[str] = uuid_fk("products.id")
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default=LIST_STATE_DRAFT)
    created_by: Mapped[str] = uuid_fk("users.id")
    total_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    released_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_cross_sell_lists_org_state", "organization_id", "state"),
    )


ITEM_STATE_PENDING = "pending"
ITEM_STATE_RELEASED = "released"
ITEM_STATE_SKIPPED = "skipped"
ITEM_STATES = (ITEM_STATE_PENDING, ITEM_STATE_RELEASED, ITEM_STATE_SKIPPED)


class CrossSellItem(db.Model, TimestampMixin):
    __tablename__ = "cross_sell_items"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    list_id: Mapped[str] = uuid_fk("cross_sell_lists.id", ondelete="CASCADE")
    lead_id: Mapped[str] = uuid_fk("leads.id")
    state: Mapped[str] = mapped_column(String(20), nullable=False, default=ITEM_STATE_PENDING)
    last_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    availability_id: Mapped[str | None] = uuid_fk("availabilities.id", nullable=True)

    __table_args__ = (
        Index("ix_cross_sell_items_list_state", "list_id", "state"),
    )
