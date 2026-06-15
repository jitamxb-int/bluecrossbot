"""Async Qdrant client factory.

The client is constructed once during application startup (see the lifespan in
``server.py``) and stored on ``app.state`` for dependency injection.
"""

from __future__ import annotations

from qdrant_client import AsyncQdrantClient

from src.core.config import Settings


def create_qdrant_client(settings: Settings) -> AsyncQdrantClient:
    """Build an :class:`AsyncQdrantClient` from settings."""
    return AsyncQdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        prefer_grpc=settings.qdrant_prefer_grpc,
        timeout=settings.qdrant_timeout,
    )
