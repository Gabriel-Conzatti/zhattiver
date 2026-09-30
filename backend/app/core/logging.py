from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from flask import Flask, g, has_request_context, request


class RequestFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if has_request_context():
            payload["path"] = request.path
            payload["method"] = request.method
            payload["request_id"] = getattr(g, "request_id", None)
        extras = getattr(record, "extra", None)
        if extras:
            payload.update(extras)
        for key, value in record.__dict__.items():
            if key in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "message",
            }:
                continue
            if key.startswith("_"):
                continue
            if key in payload:
                continue
            payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(app: Flask) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(RequestFormatter())
    level = logging.DEBUG if app.config["LYNK_ENV"] == "development" else logging.INFO
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    app.logger.handlers = [handler]
    app.logger.setLevel(level)


def new_request_id() -> str:
    return uuid.uuid4().hex
