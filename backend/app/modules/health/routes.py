from __future__ import annotations

from flask import Blueprint, jsonify

from ...core.time import now_utc

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "time": now_utc().isoformat()})
