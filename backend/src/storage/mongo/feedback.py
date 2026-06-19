"""MongoDB-backed session feedback storage (Beanie).

One document per feedback entry, keyed by ``session_id``. Stores the
highlighted ``original_text``, the reviewer's ``feedback_text``, and an
integer ``status`` flag (1 = active, 0 = deleted/soft-deleted).
Collection name: ``blue_cross_sessions_feedback``.
"""

from __future__ import annotations

from datetime import UTC, datetime

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel

from src.core.logging.setup import get_logger

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


class SessionFeedback(Document):
    """One feedback entry linked to a chat session."""

    session_id: str
    original_text: str
    feedback_text: str
    status: int = Field(default=1, description="1 = active, 0 = deleted")
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    class Settings:
        name = "blue_cross_sessions_feedback"
        indexes = [
            IndexModel([("session_id", 1)], name="idx_session_id"),
            IndexModel([("status", 1)], name="idx_status"),
        ]


class FeedbackRepository:
    """Reads and writes session feedback documents."""

    async def create(
        self,
        session_id: str,
        original_text: str,
        feedback_text: str,
    ) -> SessionFeedback:
        feedback = SessionFeedback(
            session_id=session_id,
            original_text=original_text,
            feedback_text=feedback_text,
        )
        await feedback.insert()
        return feedback

    async def list_all(self) -> list[SessionFeedback]:
        """Return all active (status=1) feedback entries, newest first."""
        return (
            await SessionFeedback.find(SessionFeedback.status == 1)
            .sort("-created_at")
            .to_list()
        )

    async def get_by_session(self, session_id: str) -> list[SessionFeedback]:
        """Return active feedback entries for a specific session."""
        return await SessionFeedback.find(
            SessionFeedback.session_id == session_id,
            SessionFeedback.status == 1,
        ).to_list()

    async def soft_delete(self, feedback_id: str) -> bool:
        """Set status=0 instead of removing the document. Returns True if found."""
        oid = PydanticObjectId(feedback_id)
        feedback = await SessionFeedback.get(oid)
        if feedback is None:
            return False
        feedback.status = 0
        feedback.updated_at = _utcnow()
        await feedback.save()
        return True
