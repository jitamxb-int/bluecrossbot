"""Chat route — RAG question answering with per-session memory.

``POST /chat`` answers grounded in the ingested corpus, persists the conversation
to MongoDB (keyed by ``session_id``), and surfaces relevant product/video
references with their real image/video URLs from the vector store.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_chat_service
from src.api.models.chat import (
    ChatCountResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionListResponse,
    ChatTranscriptsResponse,
    SessionSortField,
    SortOrder,
)
from src.api.models.common import ErrorResponse
from src.services.chat.service import ChatService

router = APIRouter(tags=["Chat"])


@router.get(
    "/sessions",
    response_model=ChatSessionListResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Paginated list of chat sessions.",
    description=(
        "Returns chat sessions with optional status filter and sorting. "
        "Use `status=active` or `status=inactive` to filter; omit for all sessions."
    ),
)
async def list_sessions(
    limit: int = Query(default=10, ge=1, le=100, description="Max sessions to return."),
    offset: int = Query(default=0, ge=0, description="Number of sessions to skip."),
    status: str | None = Query(default=None, description="Filter by status: active | inactive."),
    sortBy: SessionSortField = Query(default=SessionSortField.id, description="Field to sort by."),
    sortOrder: SortOrder = Query(default=SortOrder.asc, description="Sort direction: asc | desc."),
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionListResponse:
    return await service.list_sessions(
        limit=limit,
        offset=offset,
        status=status,
        sort_by=sortBy.value,
        sort_order=sortOrder.value,
    )


@router.get(
    "/chat/count",
    response_model=ChatCountResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Count persisted chat sessions.",
    description="Returns the total number of chat sessions persisted in MongoDB.",
)
async def chat_metrics(
    service: ChatService = Depends(get_chat_service),
) -> ChatCountResponse:
    chats = await service.chat_count_metrics()
    return chats


@router.get(
    "/chat/transcripts",
    response_model=ChatTranscriptsResponse,
    responses={503: {"model": ErrorResponse}},
    summary="List persisted chat transcripts.",
    description="Returns all persisted chat_json transcripts keyed by session_id.",
)
async def list_chat_transcripts(
    service: ChatService = Depends(get_chat_service),
) -> ChatTranscriptsResponse:
    return await service.list_chat_transcripts()


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="RAG chat with conversation memory and product/video references.",
    description=(
        "Answers a question grounded in the ingested corpus. Conversation history "
        "and a rolling summary are persisted per session_id in MongoDB. Omit "
        "session_id on the first turn to start a new conversation (the response "
        "returns the minted id). When relevant, the response includes product and "
        "video references carrying their image_url / video_url from the vector store."
    ),
)
async def chat(
    payload: ChatRequest,
    service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    return await service.answer(payload)
