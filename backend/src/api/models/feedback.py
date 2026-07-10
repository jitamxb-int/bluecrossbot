"""Pydantic models for the session feedback API."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Work-status values for a feedback entry (distinct from the active/deleted `status`).
ResolutionStatus = Literal["WIP", "Resolved"]


class CreateFeedbackRequest(BaseModel):
    session_id: str = Field(..., description="The chat session this feedback belongs to.")
    original_text: str = Field(..., min_length=1, description="The text snippet being annotated.")
    feedback_text: str = Field(..., min_length=1, description="The reviewer's feedback comment.")


class UpdateFeedbackStatusRequest(BaseModel):
    resolution_status: ResolutionStatus = Field(
        ..., description="New work status for the feedback entry: 'WIP' or 'Resolved'."
    )


class FeedbackResponse(BaseModel):
    id: str = Field(..., description="Feedback document ID.")
    session_id: str
    original_text: str
    feedback_text: str
    status: int = Field(..., description="1 = active, 0 = deleted")
    resolution_status: ResolutionStatus = Field(
        default="WIP", description="Work status: 'WIP' or 'Resolved'."
    )
    created_at: datetime


class FeedbackListResponse(BaseModel):
    total: int = Field(..., description="Total number of feedback entries.")
    feedbacks: list[FeedbackResponse] = Field(default_factory=list)


class DeleteFeedbackResponse(BaseModel):
    deleted: bool = Field(..., description="True if the document was found and deleted.")
    id: str = Field(..., description="ID of the targeted feedback document.")
