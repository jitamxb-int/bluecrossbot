"""Shared API models — health, readiness, and error envelopes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """Uniform error envelope returned by exception handlers."""

    detail: str = Field(..., description="Human-readable error message.")
    error_type: str | None = Field(
        default=None, description="Machine-readable error/exception class name."
    )


class HealthResponse(BaseModel):
    """Liveness probe payload."""

    status: str = Field(default="ok")
    service: str
    environment: str
    version: str = "0.1.0"


class ReadinessResponse(BaseModel):
    """Readiness probe payload — reflects downstream dependency health."""

    status: str = Field(..., description="'ready' or 'degraded'.")
    qdrant: str = Field(..., description="Qdrant connectivity status.")
