"""RAG chat orchestration: LOAD history -> RUN retrieval+LLM -> SAVE turn.

Implements ``docs/CONVERSATION_HISTORY.md``. Each turn:

1. LOAD the session transcript + rolling summary from MongoDB.
2. Rewrite the query to standalone form (for retrieval only) using the history.
3. Retrieve top-k chunks (blended across doc types) from Qdrant.
4. Build the prompt: [system instructions] + [summary] + windowed history +
   [retrieved context, with products/videos tagged P#/V#] + the raw query.
5. One structured LLM call returns the answer, the new rolling summary, and the
   tags of products/videos worth referencing.
6. Resolve those tags back to the retrieved payloads so references carry the
   REAL image/video URLs from the vector store (never model-invented).
7. SAVE the turn (raw query + final answer) and the refreshed summary; timing
   updates inside ``append_turn``.
"""

from __future__ import annotations

import uuid

from src.api.models.chat import (
    ChatRequest,
    ChatResponse,
    ProductReference,
    SessionInfo,
    VideoReference,
)
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.llm.openai_chat import OpenAIChatProvider
from src.services.retrieval.service import RetrievalService
from src.storage.mongo.session import SessionRepository

logger = get_logger(__name__)

_SYSTEM_INSTRUCTIONS = (
    "You are a helpful assistant for Blue Cross Laboratories. Answer the user's "
    "question grounded ONLY in the [RETRIEVED CONTEXT]; if the context does not "
    "contain the answer, say so plainly rather than inventing facts.\n\n"
    "When products or videos in the context are relevant to the user's need, "
    "recommend them in your answer and return their tags (e.g. 'P1', 'V2') in "
    "product_ids / video_ids so the app can attach their images/links. Only "
    "reference items that genuinely fit; return empty lists otherwise. Never "
    "invent product names, image URLs, or video URLs.\n\n"
    "Always produce conversation_summary: merge the previous summary with this "
    "turn into ONE plain-text string of 100-200 characters (no markdown, no line "
    "breaks, no 'Summary:' prefix). Prioritise the user's primary intent and the "
    "most recent exchange."
)


class ChatService:
    def __init__(
        self,
        retrieval: RetrievalService,
        llm: OpenAIChatProvider,
        sessions: SessionRepository,
        settings: Settings,
    ) -> None:
        self._retrieval = retrieval
        self._llm = llm
        self._sessions = sessions
        self._settings = settings

    async def answer(self, request: ChatRequest) -> ChatResponse:
        session_id = request.session_id or uuid.uuid4().hex
        top_k = request.top_k or self._settings.chat_retrieval_top_k

        # 1. LOAD
        chat_history, summary = await self._sessions.get_history(session_id)

        # 2. Rewrite for retrieval only (raw query is what we store/show).
        standalone = await self._llm.rewrite_standalone(request.message, summary, chat_history)

        # 3. Retrieve (blended across doc types).
        points = await self._retrieval.search(standalone, top_k)
        descriptive, product_map, video_map = _split_by_type(points)

        # 4. Build the prompt.
        messages = self._build_messages(
            request.message, chat_history, summary, descriptive, product_map, video_map
        )

        # 5. LLM call.
        result = await self._llm.complete_structured(messages)
        answer = result["answer"]
        new_summary = result["conversation_summary"]

        # 6. Resolve chosen tags -> grounded references (real URLs from payloads).
        products = _resolve_products(result["product_ids"], product_map)
        videos = _resolve_videos(result["video_ids"], video_map)
        # Citations = comma-separated, deduped page URLs the answer is grounded in:
        # descriptive source_urls + the page_urls of the products/videos actually referenced.
        citations = _build_sources(descriptive, products, videos)

        # 7. SAVE (raw query + final answer).
        session = await self._sessions.append_turn(
            session_id=session_id,
            user_query=request.message,
            assistant_content=answer,
            summary=new_summary,
        )
        logger.info(
            "chat_turn_complete",
            session_id=session_id,
            products=len(products),
            videos=len(videos),
            citations=len(citations.split(", ")) if citations else 0,
        )

        return ChatResponse(
            answer=answer,
            session=SessionInfo(
                session_id=session.session_id,
                started_at=session.started_at,
                ended_at=session.ended_at,
                duration_seconds=session.duration_seconds,
                is_active=session.is_active,
            ),
            citations=citations,
            products=products,
            videos=videos,
        )

    def _build_messages(
        self,
        user_query: str,
        chat_history: list[dict],
        summary: str | None,
        descriptive: list[dict],
        product_map: dict[str, dict],
        video_map: dict[str, dict],
    ) -> list[dict]:
        messages: list[dict] = [{"role": "system", "content": _SYSTEM_INSTRUCTIONS}]
        if summary:
            messages.append({"role": "system", "content": f"[CONVERSATION SUMMARY]\n{summary}"})

        window = self._settings.chat_history_window_turns * 2
        messages.extend((chat_history or [])[-window:])

        context = _format_context(descriptive, product_map, video_map)
        if context:
            messages.append({"role": "system", "content": f"[RETRIEVED CONTEXT]\n{context}"})

        messages.append({"role": "user", "content": user_query})
        return messages


def _split_by_type(points: list) -> tuple[list[dict], dict[str, dict], dict[str, dict]]:
    """Split scored points into descriptive payloads + tagged product/video maps."""
    descriptive: list[dict] = []
    product_map: dict[str, dict] = {}
    video_map: dict[str, dict] = {}
    for point in points:
        payload = dict(point.payload or {})
        payload["_score"] = getattr(point, "score", None)
        doc_type = payload.get("doc_type")
        if doc_type == "product":
            product_map[f"P{len(product_map) + 1}"] = payload
        elif doc_type == "video":
            video_map[f"V{len(video_map) + 1}"] = payload
        else:
            descriptive.append(payload)
    return descriptive, product_map, video_map


def _format_context(
    descriptive: list[dict], product_map: dict[str, dict], video_map: dict[str, dict]
) -> str:
    blocks: list[str] = []
    for payload in descriptive:
        text = (payload.get("text") or "").strip()
        if text:
            blocks.append(text)
    for tag, p in product_map.items():
        blocks.append(
            f"[{tag}] PRODUCT: {p.get('product_name', '')} "
            f"(category: {p.get('category') or 'n/a'}). {p.get('text', '')}"
        )
    for tag, v in video_map.items():
        blocks.append(
            f"[{tag}] VIDEO: {v.get('video_name', '')} "
            f"(category: {v.get('category') or 'n/a'}). {v.get('text', '')}"
        )
    return "\n\n".join(blocks)


def _normalize_tags(ids: list, prefix: str) -> set[str]:
    """Accept 'P1', 'p1', or bare '1' and normalise to the canonical tag set."""
    out: set[str] = set()
    for raw in ids or []:
        token = str(raw).strip().upper()
        if not token:
            continue
        out.add(token if token.startswith(prefix) else f"{prefix}{token}")
    return out


def _resolve_products(ids: list, product_map: dict[str, dict]) -> list[ProductReference]:
    tags = _normalize_tags(ids, "P")
    return [
        ProductReference(
            product_name=p.get("product_name", ""),
            category=p.get("category"),
            division=p.get("division"),
            image_url=p.get("image_url"),
            page_url=p.get("page_url"),
            score=p.get("_score"),
        )
        for tag, p in product_map.items()
        if tag in tags
    ]


def _resolve_videos(ids: list, video_map: dict[str, dict]) -> list[VideoReference]:
    tags = _normalize_tags(ids, "V")
    return [
        VideoReference(
            title=v.get("video_name", ""),
            video_url=v.get("video_url"),
            thumbnail_url=v.get("thumbnail_url"),
            category=v.get("category"),
            division=v.get("division"),
            page_url=v.get("page_url"),
            score=v.get("_score"),
        )
        for tag, v in video_map.items()
        if tag in tags
    ]


def _build_sources(
    descriptive: list[dict],
    products: list[ProductReference],
    videos: list[VideoReference],
) -> str:
    """Comma-separated, deduped page URLs the answer is grounded in.

    ``source_url`` for descriptive hits, ``page_url`` for the referenced
    products/videos. Order preserved (descriptive → products → videos); empty
    URLs skipped; each page appears once.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str | None) -> None:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    for payload in descriptive:
        add(payload.get("source_url"))
    for product in products:
        add(product.page_url)
    for video in videos:
        add(video.page_url)

    return ", ".join(urls)
