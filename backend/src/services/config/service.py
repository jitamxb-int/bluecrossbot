"""Runtime configuration service.

Thin orchestration over :class:`ConfigRepository` so admin routes stay thin and
return API models directly (mirrors :class:`FeedbackService`).
"""

from __future__ import annotations

from src.api.models.config import SessionConfigResponse
from src.storage.mongo.config import ConfigRepository


class ConfigService:
    def __init__(self, config: ConfigRepository) -> None:
        self._config = config

    async def get_session_config(self) -> SessionConfigResponse:
        config = await self._config.get_config()
        return SessionConfigResponse(
            max_session_duration_minutes=config.max_session_duration_minutes,
            updated_at=config.updated_at,
        )

    async def update_session_config(self, minutes: int) -> SessionConfigResponse:
        config = await self._config.set_max_session_duration_minutes(minutes)
        return SessionConfigResponse(
            max_session_duration_minutes=config.max_session_duration_minutes,
            updated_at=config.updated_at,
        )
