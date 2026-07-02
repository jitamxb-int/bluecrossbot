"""Models for the chat (RAG question-answering) API.

The conversation transcript and rolling summary are persisted server-side in
MongoDB and keyed by ``session_id`` (see ``docs/CONVERSATION_HISTORY.md``), so a
client only sends the next ``message`` plus the ``session_id`` to continue a
thread. Product and video references carry the real ``image_url`` / ``video_url``
pulled from the vector store payloads — never invented by the model.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """RAG chat request."""

    message: str = Field(..., description="The user's question.")
    session_id: str | None = Field(
        default=None,
        description="Conversation id. Omit on the first turn — the server mints one.",
    )
    top_k: int | None = Field(
        default=None, ge=1, le=100, description="Context chunks to retrieve (defaults to config)."
    )


class ProductReference(BaseModel):
    """A product surfaced as a reference, with its image pulled from the vector DB."""

    product_name: str
    category: str | None = None
    division: str | None = None
    image_url: str | None = None
    page_url: str | None = None
    score: float | None = None


class VideoReference(BaseModel):
    """A video surfaced as a reference, with its video URL pulled from the vector DB."""

    title: str
    video_url: str | None = None
    thumbnail_url: str | None = None
    category: str | None = None
    division: str | None = None
    page_url: str | None = None
    score: float | None = None


class SessionInfo(BaseModel):
    """Session timing/state returned to the client."""

    session_id: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float = 0.0
    is_active: bool = True
    hcp_consent: bool = Field(
        default=False,
        description="Whether HCP consent has been granted for this session.",
    )


class HcpConsentRequest(BaseModel):
    """Request to grant HCP consent for a session."""

    session_id: str = Field(..., description="The session to grant HCP consent for.")


class ChatResponse(BaseModel):
    """RAG chat response."""

    citations: str = Field(
    default="",
    description="Comma-separated, deduped page URLs the answer is grounded in "
    "(descriptive source_urls + referenced product/video page_urls).",
)
    answer: str
    session: SessionInfo
    products: list[ProductReference] = Field(default_factory=list)
    videos: list[VideoReference] = Field(default_factory=list)


class ChatCountResponse(BaseModel):
    """Total number of persisted chat sessions."""

    total_chats: int = Field(..., ge=0, description="Number of persisted chat sessions.")
    total_chat_messages: int = Field(
        ..., ge=0, description="Number of persisted chat transcript messages."
    )
    total_chat_minutes: float = Field(
        ..., ge=0, description="Total persisted chat duration in minutes."
    )
    minutes_of_meetings: dict[str, list[dict]] = Field(
        default_factory=dict,
        description="Map of session_id to persisted chat_json transcript.",
    )


class ChatTranscriptsResponse(BaseModel):
    """Persisted chat transcripts keyed by session id."""

    transcripts: dict[str, list[dict]] = Field(
        default_factory=dict,
        description="Map of session_id to persisted chat_json transcript.",
    )


class SessionSortField(str, Enum):
    id = "id"
    started_at = "started_at"
    ended_at = "ended_at"
    duration_seconds = "duration_seconds"
    created_at = "created_at"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class ChatSessionItem(BaseModel):
    """A single chat session row returned in the paginated list."""

    session_id: str
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_seconds: float = 0.0
    is_active: bool = True
    message_count: int = 0
    created_at: datetime
    updated_at: datetime


class ChatSessionListResponse(BaseModel):
    """Paginated list of chat sessions."""

    total: int = Field(..., description="Total sessions matching the filter.")
    limit: int = Field(..., description="Page size requested.")
    offset: int = Field(..., description="Page offset requested.")
    sessions: list[ChatSessionItem] = Field(default_factory=list)


class DeleteSessionsRequest(BaseModel):
    """Request to permanently delete one or more chat sessions."""

    session_ids: list[str] = Field(..., min_length=1, description="session_ids to delete (>=1).")


class DeleteSessionsResponse(BaseModel):
    """Result of a session delete operation."""

    deleted: int = Field(..., ge=0, description="Number of sessions actually deleted.")
    requested: int = Field(..., ge=0, description="Number of session_ids requested.")
