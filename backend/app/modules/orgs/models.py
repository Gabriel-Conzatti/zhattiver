from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import ArchivableMixin, TimestampMixin, uuid_pk


class Organization(db.Model, TimestampMixin, ArchivableMixin):
    __tablename__ = "organizations"

    id: Mapped[str] = uuid_pk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False, unique=True)
    timezone: Mapped[str] = mapped_column(String(60), nullable=False, default="America/Sao_Paulo")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Organization {self.slug}>"
