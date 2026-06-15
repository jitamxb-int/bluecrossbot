"""Structured logging via ``structlog``, bridged over the stdlib logging module.

``configure_logging`` wires a single rendering pipeline so that both structlog
loggers and third-party stdlib loggers (uvicorn, httpx, openai, qdrant_client)
are emitted in the same format: JSON in production, colorized console in dev.

``RequestIDMiddleware`` binds a per-request ``request_id`` into structlog's
contextvars so every log line within a request is correlated.
"""

from __future__ import annotations

import logging
import sys
import uuid
from typing import Any

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"

_NOISY_LOGGERS = (
    "uvicorn",
    "uvicorn.error",
    "uvicorn.access",
    "httpx",
    "httpcore",
    "openai",
    "qdrant_client",
)


def configure_logging(level: str = "INFO", json_logs: bool = True) -> None:
    """Configure structlog + stdlib logging into one rendering pipeline."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer: Any = (
        structlog.processors.JSONRenderer()
        if json_logs
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Let third-party loggers propagate to the root handler instead of their own.
    for name in _NOISY_LOGGERS:
        third_party = logging.getLogger(name)
        third_party.handlers.clear()
        third_party.propagate = True
    # Quiet per-request chatter from the HTTP clients used by qdrant/openai.
    for name in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger."""
    return structlog.get_logger(name)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Bind a per-request ``request_id`` (and echo it as a response header)."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response = await call_next(request)
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            structlog.contextvars.clear_contextvars()
