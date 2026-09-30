from __future__ import annotations

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk


class Funnel(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "funnels"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    product_id: Mapped[str] = uuid_fk("products.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index("ix_funnels_org_product", "organization_id", "product_id"),
    )


class FunnelStage(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "funnel_stages"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    funnel_id: Mapped[str] = uuid_fk("funnels.id", ondelete="CASCADE")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_initial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    message_template: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_funnel_stages_funnel_order", "funnel_id", "order_index"),
    )
