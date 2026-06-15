"""Models for the chat (RAG question-answering) API.

The conversation transcript and rolling summary are persisted server-side in
MongoDB and keyed by ``session_id`` (see ``docs/CONVERSATION_HISTORY.md``), so a
client only sends the next ``message`` plus the ``session_id`` to continue a
thread. Product and video references carry the real ``image_url`` / ``video_url``
pulled from the vector store payloads — never invented by the model.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single turn in the conversation history."""

    role: str = Field(..., description="'user' | 'assistant' | 'system'.")
    content: str


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


class ChatResponse(BaseModel):
    """RAG chat response."""

    answer: str
    session: SessionInfo
    citations: str = Field(
        default="",
        description="Comma-separated, deduped page URLs the answer is grounded in "
        "(descriptive source_urls + referenced product/video page_urls).",
    )
    products: list[ProductReference] = Field(default_factory=list)
    videos: list[VideoReference] = Field(default_factory=list)
