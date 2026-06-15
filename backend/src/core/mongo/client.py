"""Async MongoDB client factory + Beanie initialization.

The client is constructed once during application startup (see the lifespan in
``server.py``) and stored on ``app.state``. ``init_session_store`` registers the
:class:`ChatSession` document with Beanie against the configured database.

Beanie 2.x uses PyMongo's **native async driver** (``AsyncMongoClient`` →
``AsyncDatabase``), not Motor — passing a Motor database to ``init_beanie`` fails,
so we build a PyMongo ``AsyncMongoClient`` here.
"""

from __future__ import annotations

import certifi
from beanie import init_beanie
from pymongo import AsyncMongoClient

from src.core.config import Settings
from src.storage.mongo.session import ChatSession


def create_mongo_client(settings: Settings) -> AsyncMongoClient:
    """Build a PyMongo async client from settings.

    Raises ``ValueError`` if ``MONGODB_URI`` is not configured — chat persistence
    cannot work without it. ``tlsCAFile`` is harmless for non-TLS local Mongo and
    makes TLS (Atlas) reliable on platforms with an incomplete trust store.
    """
    if not settings.mongodb_uri:
        raise ValueError("MONGODB_URI is not configured; chat persistence is unavailable.")
    return AsyncMongoClient(
        settings.mongodb_uri,
        serverSelectionTimeoutMS=settings.mongodb_timeout_ms,
        tlsCAFile=certifi.where(),
        tz_aware=True,  # datetimes round-trip as aware UTC (BSON stores them naive)
    )


async def init_session_store(client: AsyncMongoClient, settings: Settings) -> None:
    """Initialize Beanie with the chat session document model.

    The collection name comes from config; set it before ``init_beanie`` reads it.
    """
    ChatSession.Settings.name = settings.mongodb_chat_collection
    await init_beanie(
        database=client[settings.mongodb_db],
        document_models=[ChatSession],
    )
