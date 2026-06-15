"""Chat route — RAG question answering with per-session memory.

``POST /chat`` answers grounded in the ingested corpus, persists the conversation
to MongoDB (keyed by ``session_id``), and surfaces relevant product/video
references with their real image/video URLs from the vector store.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.dependencies import get_chat_service
from src.api.models.chat import ChatRequest, ChatResponse
from src.api.models.common import ErrorResponse
from src.services.chat.service import ChatService

router = APIRouter(tags=["Chat"])


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
