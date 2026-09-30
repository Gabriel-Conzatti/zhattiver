from __future__ import annotations

from typing import Any

from flask import Flask, g, jsonify, request
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException


def api_error(
    code: str,
    message: str,
    *,
    status: int = 400,
    details: Any | None = None,
):
    payload = {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "requestId": getattr(g, "request_id", None),
        }
    }
    response = jsonify(payload)
    response.status_code = status
    return response


class BusinessError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status: int = 400,
        details: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details


def install_error_handlers(app: Flask) -> None:
    @app.errorhandler(BusinessError)
    def _business(exc: BusinessError):
        return api_error(exc.code, exc.message, status=exc.status, details=exc.details)

    @app.errorhandler(ValidationError)
    def _validation(exc: ValidationError):
        return api_error(
            "invalid_request",
            "Requisição inválida",
            status=422,
            details={
                "issues": [
                    {
                        "loc": list(err["loc"]),
                        "msg": err["msg"],
                        "type": err["type"],
                    }
                    for err in exc.errors()
                ]
            },
        )

    @app.errorhandler(HTTPException)
    def _http(exc: HTTPException):
        return api_error(
            exc.name.lower().replace(" ", "_"),
            exc.description or exc.name,
            status=exc.code or 500,
        )

    @app.errorhandler(Exception)
    def _unhandled(exc: Exception):
        app.logger.exception("lynk.error.unhandled", extra={"path": request.path})
        if app.config.get("DEBUG"):
            return api_error("internal_error", str(exc), status=500)
        return api_error("internal_error", "Erro interno", status=500)


__all__ = ["BusinessError", "api_error", "install_error_handlers"]
