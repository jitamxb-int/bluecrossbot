"""Feedback service — thin orchestration over FeedbackRepository."""

from __future__ import annotations

from fastapi import HTTPException, status

from src.api.models.feedback import (
    CreateFeedbackRequest,
    DeleteFeedbackResponse,
    FeedbackListResponse,
    FeedbackResponse,
)
from src.storage.mongo.feedback import FeedbackRepository


class FeedbackService:
    def __init__(self, repository: FeedbackRepository) -> None:
        self._repo = repository

    async def create(self, payload: CreateFeedbackRequest) -> FeedbackResponse:
        doc = await self._repo.create(
            session_id=payload.session_id,
            original_text=payload.original_text,
            feedback_text=payload.feedback_text,
        )
        return FeedbackResponse(
            id=str(doc.id),
            session_id=doc.session_id,
            original_text=doc.original_text,
            feedback_text=doc.feedback_text,
            status=doc.status,
            created_at=doc.created_at,
        )

    async def list_all(self) -> FeedbackListResponse:
        docs = await self._repo.list_all()
        feedbacks = [
            FeedbackResponse(
                id=str(doc.id),
                session_id=doc.session_id,
                original_text=doc.original_text,
                feedback_text=doc.feedback_text,
                status=doc.status,
                created_at=doc.created_at,
            )
            for doc in docs
        ]
        return FeedbackListResponse(total=len(feedbacks), feedbacks=feedbacks)

    async def delete(self, feedback_id: str) -> DeleteFeedbackResponse:
        found = await self._repo.soft_delete(feedback_id)
        if not found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Feedback '{feedback_id}' not found.",
            )
        return DeleteFeedbackResponse(deleted=True, id=feedback_id)
