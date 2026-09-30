from __future__ import annotations

from flask import Flask, g, request

from .logging import new_request_id


def init_request_context(app: Flask) -> None:
    @app.before_request
    def _attach_request_id() -> None:
        g.request_id = request.headers.get("X-Request-ID") or new_request_id()

    @app.after_request
    def _return_request_id(response):
        rid = getattr(g, "request_id", None)
        if rid:
            response.headers["X-Request-ID"] = rid
        return response
