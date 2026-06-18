"""FastAPI dependency providers.

Singletons constructed during the application lifespan are stored on
``app.state`` and exposed here via ``Depends`` so routes stay thin and testable
(tests can override these providers with mocks).
"""

from __future__ import annotations

from fastapi import HTTPException, Request, status

from src.services.chat.service import ChatService
from src.services.ingestion.product_service import ProductIngestionService
from src.services.ingestion.service import IngestionService
from src.services.ingestion.video_service import VideoIngestionService
from src.services.retrieval.service import RetrievalService


def get_ingestion_service(request: Request) -> IngestionService:
    return request.app.state.ingestion_service


def get_product_ingestion_service(request: Request) -> ProductIngestionService:
    return request.app.state.product_ingestion_service


def get_video_ingestion_service(request: Request) -> VideoIngestionService:
    return request.app.state.video_ingestion_service


def get_retrieval_service(request: Request) -> RetrievalService:
    return request.app.state.retrieval_service


def get_chat_service(request: Request) -> ChatService:
    service = getattr(request.app.state, "chat_service", None)
    if service is None:
        # Chat needs MongoDB; surface the actual reason it wasn't initialized
        # (real connection/init error, or "not configured") instead of a generic msg.
        reason = (
            getattr(request.app.state, "chat_unavailable_reason", None)
            or "MongoDB is not configured (set MONGODB_URI)."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Chat is unavailable: {reason}",
        )
    return service
