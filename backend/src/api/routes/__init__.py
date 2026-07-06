"""Route aggregation — combines all route modules into a single router."""

from __future__ import annotations

from fastapi import APIRouter

from src.api.routes import (
    admin,
    chat,
    config,
    feedback,
    health,
    ingestion,
    product,
    retrieval,
    vectors,
    video,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(admin.router)
api_router.include_router(config.router)
api_router.include_router(ingestion.router)
api_router.include_router(product.router)
api_router.include_router(video.router)
api_router.include_router(retrieval.router)
api_router.include_router(chat.router)
api_router.include_router(feedback.router)
api_router.include_router(vectors.router)

__all__ = ["api_router"]
