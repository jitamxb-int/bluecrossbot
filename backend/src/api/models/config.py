"""Models for the runtime admin configuration API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SessionConfigResponse(BaseModel):
    """Current session-related runtime configuration."""

    max_session_duration_minutes: int = Field(
        ..., description="Maximum chat session lifetime in minutes, measured from creation."
    )
    updated_at: datetime | None = Field(
        default=None, description="When this configuration was last updated (UTC)."
    )


class UpdateSessionConfigRequest(BaseModel):
    """Request to set the maximum chat session duration."""

    max_session_duration_minutes: int = Field(
        ...,
        ge=1,
        le=1440,
        description="Maximum chat session lifetime in minutes (1–1440).",
    )
