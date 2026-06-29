"""Admin runtime configuration routes.

``GET /config/session`` returns the current session configuration and
``PUT /config/session`` updates the maximum chat session duration (minutes).
The setting is persisted in MongoDB and applies globally to all sessions.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.dependencies import get_config_service
from src.api.models.common import ErrorResponse
from src.api.models.config import SessionConfigResponse, UpdateSessionConfigRequest
from src.services.config.service import ConfigService

router = APIRouter(tags=["Admin - Config"])


@router.get(
    "/config/session",
    response_model=SessionConfigResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Get session configuration.",
    description="Returns the configured maximum chat session duration (minutes).",
)
async def get_session_config(
    service: ConfigService = Depends(get_config_service),
) -> SessionConfigResponse:
    return await service.get_session_config()


@router.put(
    "/config/session",
    response_model=SessionConfigResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Set the maximum chat session duration.",
    description=(
        "Sets the maximum lifetime (in minutes) for all chat sessions, measured "
        "from session creation. Once a session exceeds this duration it is marked "
        "inactive and further messages to it are rejected. Applies globally."
    ),
)
async def update_session_config(
    payload: UpdateSessionConfigRequest,
    service: ConfigService = Depends(get_config_service),
) -> SessionConfigResponse:
    return await service.update_session_config(payload.max_session_duration_minutes)
