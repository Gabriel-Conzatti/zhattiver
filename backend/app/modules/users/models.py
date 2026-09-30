from __future__ import annotations

from datetime import datetime
from typing import Iterable

from flask_login import UserMixin
from sqlalchemy import Boolean, DateTime, Index, String, and_, or_, select
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_fk, uuid_pk

ROLE_ADMIN = "admin"
ROLE_VENDEDOR = "vendedor"
ROLE_SDR = "sdr"
ROLES = (ROLE_ADMIN, ROLE_VENDEDOR, ROLE_SDR)


class Team(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "teams"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class Product(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "products"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_products_org_slug", "organization_id", "slug", unique=True),
    )


user_products = db.Table(
    "user_products",
    db.Column("user_id", UUID(as_uuid=False), db.ForeignKey("users.id"), primary_key=True),
    db.Column("product_id", UUID(as_uuid=False), db.ForeignKey("products.id"), primary_key=True),
)


class User(db.Model, TimestampMixin, ArchivableMixin, UserMixin):
    __tablename__ = "users"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    products = relationship("Product", secondary=user_products, backref="users")

    __table_args__ = (
        Index("ix_users_org_email", "organization_id", "email", unique=True),
    )

    def get_id(self) -> str:  # Flask-Login
        return str(self.id)


class PermissionGrant(db.Model, TimestampMixin):
    __tablename__ = "permission_grants"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    user_id: Mapped[str] = uuid_fk("users.id")
    granted_by: Mapped[str] = uuid_fk("users.id")
    target_user_id: Mapped[str | None] = uuid_fk("users.id", nullable=True)
    permission: Mapped[str] = mapped_column(String(80), nullable=False)
    scope: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(500))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_permission_grants_user_perm", "user_id", "permission"),
    )

    @classmethod
    def active_for_user(cls, user_id: str, at: datetime) -> Iterable["PermissionGrant"]:
        stmt = select(cls).where(
            cls.user_id == user_id,
            cls.revoked_at.is_(None),
            or_(cls.starts_at.is_(None), cls.starts_at <= at),
            or_(cls.ends_at.is_(None), cls.ends_at > at),
        )
        return db.session.execute(stmt).scalars().all()
