"""Feedback routes — create and delete session feedback entries."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.dependencies import get_feedback_service
from src.api.models.common import ErrorResponse
from src.api.models.feedback import (
    CreateFeedbackRequest,
    DeleteFeedbackResponse,
    FeedbackListResponse,
    FeedbackResponse,
)
from src.services.feedback.service import FeedbackService

router = APIRouter(tags=["Feedback"])


@router.get(
    "/feedback",
    response_model=FeedbackListResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Get all feedback entries.",
    description="Returns all session feedback entries sorted by newest first.",
)
async def get_all_feedbacks(
    service: FeedbackService = Depends(get_feedback_service),
) -> FeedbackListResponse:
    return await service.list_all()


@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=201,
    responses={503: {"model": ErrorResponse}},
    summary="Create session feedback.",
    description="Persist a feedback annotation linked to a chat session.",
)
async def create_feedback(
    payload: CreateFeedbackRequest,
    service: FeedbackService = Depends(get_feedback_service),
) -> FeedbackResponse:
    return await service.create(payload)


@router.delete(
    "/feedback/{feedback_id}",
    response_model=DeleteFeedbackResponse,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Delete session feedback.",
    description="Delete a feedback document by its ID. Returns 404 if not found.",
)
async def delete_feedback(
    feedback_id: str,
    service: FeedbackService = Depends(get_feedback_service),
) -> DeleteFeedbackResponse:
    return await service.delete(feedback_id)
