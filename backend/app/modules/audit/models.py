from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    actor_user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    before: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_audit_org_occurred", "organization_id", "occurred_at"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )
