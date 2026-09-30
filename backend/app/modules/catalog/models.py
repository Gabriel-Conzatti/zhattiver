from __future__ import annotations

from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk


class TagCategory(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "tag_categories"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)

    __table_args__ = (
        Index("ix_tag_categories_org_slug", "organization_id", "slug", unique=True),
    )


class Tag(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "tags"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    category_id: Mapped[str | None] = uuid_fk("tag_categories.id", nullable=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        Index("ix_tags_org_name", "organization_id", "name", unique=True),
    )


class Origin(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "origins"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_origins_org_slug", "organization_id", "slug", unique=True),
    )


class ClientType(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "client_types"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)

    __table_args__ = (
        Index("ix_client_types_org_slug", "organization_id", "slug", unique=True),
    )


class Insurer(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "insurers"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_insurers_org_name", "organization_id", "name", unique=True),
    )
