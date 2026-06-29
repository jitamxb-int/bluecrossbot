"""MongoDB-backed application configuration (Beanie).

A single ``AppConfig`` document holds runtime-tunable settings that admins can
change without redeploying — currently the maximum chat session duration. The
document is a singleton keyed by a fixed ``key`` so reads/writes always target
the same row.
"""

from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document
from pydantic import Field
from pymongo import IndexModel

# Default applied when no config document exists yet (~preserves the old ~1h feel).
DEFAULT_MAX_SESSION_DURATION_MINUTES = 60

# Fixed key for the singleton config document.
_CONFIG_KEY = "global"


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppConfig(Document):
    """Singleton runtime configuration document."""

    key: str = _CONFIG_KEY
    max_session_duration_minutes: int = DEFAULT_MAX_SESSION_DURATION_MINUTES
    updated_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "blue_cross_app_config"
        indexes = [IndexModel([("key", 1)], unique=True, name="uniq_config_key")]


class ConfigRepository:
    """All reads/writes of runtime config go through this small repository."""

    async def get_config(self) -> AppConfig:
        """Return the singleton config, creating it with defaults if absent."""
        config = await AppConfig.find_one(AppConfig.key == _CONFIG_KEY)
        if config is None:
            config = AppConfig()
            await config.insert()
        return config

    async def get_max_session_duration_minutes(self) -> int:
        """Return the configured maximum chat session duration (minutes)."""
        return (await self.get_config()).max_session_duration_minutes

    async def set_max_session_duration_minutes(self, minutes: int) -> AppConfig:
        """Upsert the maximum chat session duration and refresh ``updated_at``."""
        now = _utcnow()
        config = await AppConfig.find_one(AppConfig.key == _CONFIG_KEY)
        if config is None:
            config = AppConfig(max_session_duration_minutes=minutes, updated_at=now)
            await config.insert()
            return config
        config.max_session_duration_minutes = minutes
        config.updated_at = now
        await config.save()
        return config
