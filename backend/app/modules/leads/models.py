from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, CHAR, Date, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk

KIND_PF = "pf"
KIND_PJ = "pj"
KINDS = (KIND_PF, KIND_PJ)


class Lead(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "leads"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    kind: Mapped[str] = mapped_column(String(2), nullable=False, default=KIND_PF)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    document: Mapped[str | None] = mapped_column(String(20), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(CHAR(2), nullable=True)
    indicator_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    origin_id: Mapped[str | None] = uuid_fk("origins.id", nullable=True)
    client_type_id: Mapped[str | None] = uuid_fk("client_types.id", nullable=True)
    created_by: Mapped[str | None] = uuid_fk("users.id", nullable=True)

    __table_args__ = (
        Index("ix_leads_org_name", "organization_id", "name"),
        Index("ix_leads_org_state_city", "organization_id", "state", "city"),
    )


class LeadPhone(db.Model, TimestampMixin):
    __tablename__ = "lead_phones"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id", ondelete="CASCADE")
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    original: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_lead_phones_org_phone", "organization_id", "phone_e164", unique=True),
        Index("ix_lead_phones_lead", "lead_id"),
    )


class Vehicle(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "vehicles"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id", ondelete="CASCADE")
    plate: Mapped[str | None] = mapped_column(String(10), nullable=True)
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    year: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_vehicles_org_plate", "organization_id", "plate"),
    )


class LeadTag(db.Model):
    __tablename__ = "lead_tags"

    lead_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[str] = mapped_column(
        db.String(36), db.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )
    organization_id: Mapped[str] = uuid_fk("organizations.id")


STATUS_HAS = "has"
STATUS_NONE = "none"
STATUS_UNKNOWN = "unknown"
LEAD_PRODUCT_STATUS = (STATUS_HAS, STATUS_NONE, STATUS_UNKNOWN)


class LeadProduct(db.Model, TimestampMixin):
    """Situação conhecida de um produto para o lead (usada em cross-sell)."""

    __tablename__ = "lead_products"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id", ondelete="CASCADE")
    product_id: Mapped[str] = uuid_fk("products.id")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=STATUS_UNKNOWN)
    source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    known_since: Mapped[date | None] = mapped_column(Date, nullable=True)

    __table_args__ = (
        Index("ix_lead_products_unique", "organization_id", "lead_id", "product_id", unique=True),
    )


class Availability(db.Model, TimestampMixin, ArchivableMixin):
    """Lead disponibilizado para um produto/equipe (SDR → comercial)."""

    __tablename__ = "availabilities"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    lead_id: Mapped[str] = uuid_fk("leads.id", ondelete="CASCADE")
    product_id: Mapped[str] = uuid_fk("products.id")
    team_id: Mapped[str | None] = uuid_fk("teams.id", nullable=True)
    origin_id: Mapped[str | None] = uuid_fk("origins.id", nullable=True)
    released_by: Mapped[str] = uuid_fk("users.id")
    released_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False)
    claimed_by: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index(
            "ix_availabilities_open",
            "organization_id",
            "product_id",
            "lead_id",
            unique=False,
        ),
    )
