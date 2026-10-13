from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_login import login_required
from pydantic import BaseModel, Field

from ...core.authz import load_context
from ...core.errors import BusinessError
from ...core.time import today_local
from ..users.models import ROLE_ADMIN
from .services import monthly_production_report

bp = Blueprint("reports", __name__)


class ProductionReportQuery(BaseModel):
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)
    seller_user_id: str | None = None
    product_id: str | None = None


@bp.get("/admin/reports/production")
@login_required
def production_report():
    ctx = load_context()
    if ctx.role != ROLE_ADMIN:
        raise BusinessError("forbidden", "Somente administrador", status=403)
    today = today_local()
    query = ProductionReportQuery.model_validate(
        {
            "year": request.args.get("year", today.year),
            "month": request.args.get("month", today.month),
            "seller_user_id": request.args.get("seller_user_id"),
            "product_id": request.args.get("product_id"),
        }
    )
    return jsonify(
        monthly_production_report(
            organization_id=ctx.organization_id,
            year=query.year,
            month=query.month,
            seller_user_id=query.seller_user_id,
            product_id=query.product_id,
        )
    )
