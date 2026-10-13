from __future__ import annotations

from decimal import Decimal

from sqlalchemy import and_, func, select

from ...extensions import db
from ..bonus.services import eligible_sales_statement, month_bounds
from ..sales.models import (
    STATE_CANCELLED,
    STATE_REGISTERED,
    STATE_REVISION_PENDING,
    STATE_VALIDATED,
    Sale,
)
from ..users.models import Product, User

REPORT_STATES = (
    STATE_REGISTERED,
    STATE_REVISION_PENDING,
    STATE_VALIDATED,
    STATE_CANCELLED,
)


def monthly_production_report(
    *,
    organization_id: str,
    year: int,
    month: int,
    seller_user_id: str | None = None,
    product_id: str | None = None,
) -> dict:
    start, end = month_bounds(year, month)
    scope = [
        Sale.organization_id == organization_id,
        Sale.closed_on >= start,
        Sale.closed_on <= end,
    ]
    if seller_user_id:
        scope.append(Sale.seller_user_id == seller_user_id)
    if product_id:
        scope.append(Sale.product_id == product_id)

    state_rows = db.session.execute(
        select(Sale.state, func.count(Sale.id)).where(*scope).group_by(Sale.state)
    ).all()
    state_counts = {state: 0 for state in REPORT_STATES}
    state_counts.update({state: int(count) for state, count in state_rows})

    eligible = eligible_sales_statement(
        organization_id=organization_id,
        user_id=seller_user_id,
        product_id=product_id,
        year=year,
        month=month,
    ).subquery()
    rows = db.session.execute(
        select(
            eligible.c.seller_user_id,
            User.name.label("seller_name"),
            eligible.c.product_id,
            Product.name.label("product_name"),
            func.count(eligible.c.id).label("validated_count"),
            func.coalesce(func.sum(eligible.c.net_premium), Decimal("0")).label(
                "net_premium"
            ),
            func.coalesce(func.sum(eligible.c.commission_amount), Decimal("0")).label(
                "commission_amount"
            ),
        )
        .join(
            User,
            and_(
                User.id == eligible.c.seller_user_id,
                User.organization_id == organization_id,
            ),
        )
        .join(
            Product,
            and_(
                Product.id == eligible.c.product_id,
                Product.organization_id == organization_id,
            ),
        )
        .group_by(
            eligible.c.seller_user_id,
            User.name,
            eligible.c.product_id,
            Product.name,
        )
        .order_by(User.name, Product.name)
    ).all()

    items = [
        {
            "seller_user_id": str(row.seller_user_id),
            "seller_name": row.seller_name,
            "product_id": str(row.product_id),
            "product_name": row.product_name,
            "validated_count": int(row.validated_count),
            "net_premium": _money(row.net_premium),
            "commission_amount": _money(row.commission_amount),
        }
        for row in rows
    ]
    return {
        "year": year,
        "month": month,
        "filters": {
            "seller_user_id": seller_user_id,
            "product_id": product_id,
        },
        "state_counts": state_counts,
        "totals": {
            "validated_count": sum(item["validated_count"] for item in items),
            "net_premium": _money(
                sum((Decimal(item["net_premium"]) for item in items), Decimal("0"))
            ),
            "commission_amount": _money(
                sum((Decimal(item["commission_amount"]) for item in items), Decimal("0"))
            ),
        },
        "items": items,
    }


def _money(value) -> str:
    return str(Decimal(value or 0).quantize(Decimal("0.01")))
