"""Chat route — RAG question answering with per-session memory.

``POST /chat`` answers grounded in the ingested corpus, persists the conversation
to MongoDB (keyed by ``session_id``), and surfaces relevant product/video
references with their real image/video URLs from the vector store.
"""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from src.api.dependencies import get_chat_service
from src.api.models.chat import (
    ChatCountResponse,
    ChatRequest,
    ChatSessionListResponse,
    ChatTranscriptsResponse,
    DeleteSessionsRequest,
    DeleteSessionsResponse,
    HcpConsentRequest,
    SessionInfo,
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
    start_date: datetime | None = Query(
        default=None, description="Filter sessions created on/after this datetime (UTC)."
    ),
    end_date: datetime | None = Query(
        default=None, description="Filter sessions created on/before this datetime (UTC)."
    ),
    service: ChatService = Depends(get_chat_service),
) -> ChatSessionListResponse:
    return await service.list_sessions(
        limit=limit,
        offset=offset,
        status=status,
        sort_by=sortBy.value,
        sort_order=sortOrder.value,
        start_date=start_date,
        end_date=end_date,
    )


@router.delete(
    "/sessions",
    response_model=DeleteSessionsResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Delete chat sessions.",
    description="Permanently delete one or more chat sessions (and their transcripts) by id.",
)
async def delete_sessions(
    payload: DeleteSessionsRequest,
    service: ChatService = Depends(get_chat_service),
) -> DeleteSessionsResponse:
    return await service.delete_sessions(payload)


@router.get(
    "/chat/count",
    response_model=ChatCountResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Count persisted chat sessions.",
    description="Returns the total number of chat sessions persisted in MongoDB.",
)
async def chat_metrics(
    start_date: datetime | None = Query(
        default=None, description="Filter sessions created on/after this datetime (UTC)."
    ),
    end_date: datetime | None = Query(
        default=None, description="Filter sessions created on/before this datetime (UTC)."
    ),
    service: ChatService = Depends(get_chat_service),
) -> ChatCountResponse:
    chats = await service.chat_count_metrics(start_date, end_date)
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
    responses={502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="RAG chat (streaming) with conversation memory and product/video references.",
    description=(
        "Answers a question grounded in the ingested corpus, **streamed** as "
        "Server-Sent-Events (`text/event-stream`). Each line is `data: <json>` with "
        "a `type` of `start` (carries the session_id), `delta` (incremental answer "
        "text), `done` (final sanitized answer + session + citations + products + "
        "videos), or `error`. Conversation history and a rolling summary are "
        "persisted per session_id in MongoDB; omit session_id on the first turn."
    ),
)
async def chat(
    payload: ChatRequest,
    service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    async def _event_stream():
        async for event in service.answer_stream(payload):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disable proxy/nginx buffering so chunks flush immediately.
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chat/hcp-consent",
    response_model=SessionInfo,
    responses={404: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
    summary="Grant HCP consent for a session.",
    description=(
        "Records that the user granted HCP (healthcare-professional) consent for "
        "the given session. Once granted, HCP-gated answers in that session are "
        "shown without re-prompting."
    ),
)
async def grant_hcp_consent(
    payload: HcpConsentRequest,
    service: ChatService = Depends(get_chat_service),
) -> SessionInfo:
    session = await service.set_hcp_consent(payload.session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{payload.session_id}' not found.",
        )
    return session
