from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ...extensions import db
from .._shared import TimestampMixin, uuid_fk, uuid_pk

TYPE_LEADS = "leads"
TYPE_SCHEDULES = "schedules"
BATCH_TYPES = (TYPE_LEADS, TYPE_SCHEDULES)

STATUS_PENDING = "pending"
STATUS_REVIEWING = "reviewing"
STATUS_CONFIRMED = "confirmed"
STATUS_FAILED = "failed"
BATCH_STATUSES = (STATUS_PENDING, STATUS_REVIEWING, STATUS_CONFIRMED, STATUS_FAILED)


class ImportBatch(db.Model, TimestampMixin):
    __tablename__ = "import_batches"

    id: Mapped[str] = uuid_pk()
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=STATUS_PENDING)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    rows_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_ok: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_error: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rows_duplicate: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[str] = uuid_fk("users.id")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_import_batches_org_created", "organization_id", "created_at"),
    )


ROW_STATUS_OK = "ok"
ROW_STATUS_DUPLICATE = "duplicate"
ROW_STATUS_ERROR = "error"
ROW_STATUS_SKIPPED = "skipped"
ROW_STATUSES = (ROW_STATUS_OK, ROW_STATUS_DUPLICATE, ROW_STATUS_ERROR, ROW_STATUS_SKIPPED)


class ImportRow(db.Model, TimestampMixin):
    __tablename__ = "import_rows"

    id: Mapped[str] = uuid_pk()
    batch_id: Mapped[str] = uuid_fk("import_batches.id", ondelete="CASCADE")
    organization_id: Mapped[str] = uuid_fk("organizations.id")
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    normalized: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    errors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ROW_STATUS_OK)
    duplicate_of_lead_id: Mapped[str | None] = uuid_fk("leads.id", nullable=True)

    __table_args__ = (
        Index("ix_import_rows_batch_status", "batch_id", "status"),
    )
