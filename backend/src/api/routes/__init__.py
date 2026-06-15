"""Route aggregation — combines all route modules into a single router."""

from __future__ import annotations

from fastapi import APIRouter

from src.api.routes import chat, health, ingestion, product, retrieval, video

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(ingestion.router)
api_router.include_router(product.router)
api_router.include_router(video.router)
api_router.include_router(retrieval.router)
api_router.include_router(chat.router)

__all__ = ["api_router"]
