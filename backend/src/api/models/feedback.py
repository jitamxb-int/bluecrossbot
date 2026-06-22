"""Pydantic models for the session feedback API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CreateFeedbackRequest(BaseModel):
    session_id: str = Field(..., description="The chat session this feedback belongs to.")
    original_text: str = Field(..., min_length=1, description="The text snippet being annotated.")
    feedback_text: str = Field(..., min_length=1, description="The reviewer's feedback comment.")


class FeedbackResponse(BaseModel):
    id: str = Field(..., description="Feedback document ID.")
    session_id: str
    original_text: str
    feedback_text: str
    status: int = Field(..., description="1 = active, 0 = deleted")
    created_at: datetime


class FeedbackListResponse(BaseModel):
    total: int = Field(..., description="Total number of feedback entries.")
    feedbacks: list[FeedbackResponse] = Field(default_factory=list)


class DeleteFeedbackResponse(BaseModel):
    deleted: bool = Field(..., description="True if the document was found and deleted.")
    id: str = Field(..., description="ID of the targeted feedback document.")
