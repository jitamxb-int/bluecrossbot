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

import re
import uuid
from datetime import UTC, datetime

from src.api.models.chat import (
    ChatCountResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionItem,
    ChatSessionListResponse,
    ChatTranscriptsResponse,
    DeleteSessionsRequest,
    DeleteSessionsResponse,
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
    # ── ROLE ──────────────────────────────────────────────────────────
    "You are a helpful assistant for Blue Cross Laboratories.\n\n"

    # ── 1. GROUNDING ──────────────────────────────────────────────────
    "## GROUNDING\n"
    "Answer ONLY from the [RETRIEVED CONTEXT]. "
    "If the answer isn't there, say so plainly — never invent facts.\n\n"

    # ── 2. STRICT NO-HALLUCINATION RULE (highest priority) ────────────
    "## NO-HALLUCINATION RULE (HIGHEST PRIORITY)\n"
    "If the [RETRIEVED CONTEXT] does NOT answer the user's question, do NOT "
    "guess, infer, or fabricate. Reply with:\n"
    "  'I'm sorry, I don't have the information to answer that. "
    "Feel free to ask something else!'\n"
    "Rephrase naturally, but keep the meaning: you lack the data, you won't "
    "invent an answer, and the user is welcome to ask something else. "
    "Return empty product_ids, video_ids, and source_ids in this case.\n"
    "An honest 'I don't know' is always correct. A plausible but unsupported "
    "answer is never acceptable.\n\n"

    # ── 3. INTERNAL TAGS ──────────────────────────────────────────────
    "## INTERNAL TAGS\n"
    "Context is tagged as [D1], [D2] (descriptive), [P1], [P2] (products), "
    "[V1], [V2] (videos). Tags go ONLY in structured fields, NEVER in the "
    "answer text:\n"
    "- product_ids: [P#] tags of recommended products ([] if none).\n"
    "- video_ids:   [V#] tags of recommended videos ([] if none).\n"
    "- source_ids:  [D#] tags of chunks used to ground the answer ([] if none).\n"
    "Only include tags that genuinely fit. Never invent product names, image "
    "URLs, or video URLs.\n\n"

    # ── 4. ANSWER TEXT FORMATTING ─────────────────────────────────────
    "## ANSWER TEXT FORMATTING\n"
    "Refer to products and videos by their real NAMES (e.g. 'Dolostat Gel'). "
    "NEVER write tag tokens like P1, V2, or D1 in the visible answer. "
    "The app attaches images and links from the structured id fields.\n\n"

    # ── 5. RESPONSE FORMATTING ────────────────────────────────────────
    "## RESPONSE FORMATTING\n"
    "Keep responses crisp and to the point — include all necessary information "
    "but cut everything that doesn't add value:\n"
    "- **Short answers**: plain prose, 1–3 sentences. No lists, no bold unless "
    "a term truly needs emphasis.\n"
    "- **Longer answers**: use bullet points to break up the content. Each "
    "bullet must be concise — one clear idea per bullet, no padding.\n"
    "- **Sequential steps**: use a numbered list.\n"
    "- **Bold** only product names, critical warnings, or key terms the user "
    "must not miss.\n"
    "- Never pad responses. If the full answer fits in two sentences, write "
    "two sentences.\n\n"

    # ── 6. PROACTIVE PRODUCTS & VIDEOS ───────────────────────────────
    "## PROACTIVE PRODUCTS & VIDEOS\n"
    "Do NOT wait for the user to ask. Whenever the [RETRIEVED CONTEXT] has a "
    "relevant product or video, include it every time it fits — proactively:\n"
    "- Health concern or symptom → include related product in product_ids and "
    "mention it by name in the answer.\n"
    "- Topic a video explains or demonstrates → include it in video_ids and "
    "mention it naturally (e.g. 'This video covers it well: [name].').\n"
    "- Both relevant → include both.\n"
    "- Neither relevant → return empty lists. Never force irrelevant items.\n\n"
    "Weave mentions naturally into the answer — not as an afterthought.\n\n"

    # ── 7. CONVERSATION SUMMARY ───────────────────────────────────────
    "## CONVERSATION SUMMARY\n"
    "Always produce conversation_summary: merge the previous summary with this "
    "turn into ONE plain-text string of 100–200 characters (no markdown, no "
    "line breaks, no 'Summary:' prefix). Prioritise the user's primary intent "
    "and the most recent exchange.\n\n"

    # ── 8. GREETINGS & CHIT-CHAT ──────────────────────────────────────
    "## GREETINGS & CHIT-CHAT\n"
    "Respond naturally and keep it conversational. Return empty product_ids, "
    "video_ids, and source_ids. Do not mention context or tags."
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

    async def chat_count_metrics(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> ChatCountResponse:
        total_chats = await self._sessions.count_sessions(start_date, end_date)
        total_chat_messages = await self._sessions.count_sessions_messages(start_date, end_date)
        total_chat_minutes = await self._sessions.count_sessions_minutes(start_date, end_date)
        # minutes_of_meetings=await self._sessions.list_chat_json_by_session_id()
        return ChatCountResponse(
            total_chats=total_chats,
            total_chat_messages=total_chat_messages,
            total_chat_minutes=total_chat_minutes,
            # minutes_of_meetings=minutes_of_meetings
        )

    async def list_sessions(
        self,
        limit: int,
        offset: int,
        status: str | None,
        sort_by: str,
        sort_order: str,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> ChatSessionListResponse:
        # Auto-expire idle sessions before listing so the status reflects current state.
        await self._sessions.deactivate_stale()
        total, sessions = await self._sessions.list_sessions(
            limit=limit,
            offset=offset,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            start_date=start_date,
            end_date=end_date,
        )
        items = [
            ChatSessionItem(
                session_id=s.session_id,
                started_at=s.started_at,
                ended_at=s.ended_at,
                duration_seconds=s.duration_seconds,
                is_active=s.is_active,
                message_count=len(s.chat_json),
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in sessions
        ]
        return ChatSessionListResponse(total=total, limit=limit, offset=offset, sessions=items)

    async def list_chat_transcripts(self) -> ChatTranscriptsResponse:
        transcripts = await self._sessions.list_chat_json_by_session_id()
        return ChatTranscriptsResponse(transcripts=transcripts)

    async def delete_sessions(self, request: DeleteSessionsRequest) -> DeleteSessionsResponse:
        deleted = await self._sessions.delete_by_ids(request.session_ids)
        logger.info("sessions_deleted", deleted=deleted, requested=len(request.session_ids))
        return DeleteSessionsResponse(deleted=deleted, requested=len(request.session_ids))

    async def answer(self, request: ChatRequest) -> ChatResponse:
        # Capture arrival time BEFORE retrieval + LLM so a single-turn session records the
        # real time the turn took (otherwise started_at == ended_at and duration is 0).
        request_started_at = datetime.now(UTC)
        session_id = request.session_id or uuid.uuid4().hex
        top_k = request.top_k or self._settings.chat_retrieval_top_k

        # 1. LOAD. An unrecognised id (e.g. a stale one from the frontend) is treated
        #    as a brand-new conversation: mint a fresh id and start clean. The frontend
        #    replaces its stale id with the one echoed back in the response.
        found, chat_history, summary = await self._sessions.get_history(session_id)
        if request.session_id and not found:
            logger.info("chat_session_replaced", stale_session_id=session_id)
            session_id = uuid.uuid4().hex
            chat_history, summary = [], None

        # 2. Rewrite for retrieval only (raw query is what we store/show).
        standalone = await self._llm.rewrite_standalone(request.message, summary, chat_history)

        # 3. Retrieve (blended across doc types).
        logger.info(f"Standalone query generated: {standalone}")

        points = await self._retrieval.search(standalone, top_k)

        logger.info(f"Retrieved {len(points)} points from vector search")
        logger.debug(f"Retrieved points: {points}")
        descriptive_map, product_map, video_map = _split_by_type(points)

        # 4. Build the prompt.
        messages = self._build_messages(
            request.message, chat_history, summary, descriptive_map, product_map, video_map
        )

        # 5. LLM call.
        result = await self._llm.complete_structured(messages)
        # Strip any internal tags the model leaked into the visible answer text.
        answer = _sanitize_answer(result["answer"])
        new_summary = result["conversation_summary"]

        # 6. Resolve chosen tags -> grounded references (real URLs from payloads).
        products = _resolve_products(result["product_ids"], product_map)
        videos = _resolve_videos(result["video_ids"], video_map)
        # Citations reflect ACTUAL grounding: only the descriptive chunks the model
        # cited (source_ids) plus the page_urls of referenced products/videos. For
        # greetings/chit-chat all id lists are empty, so citations are empty too.
        source_tags = _normalize_tags(result.get("source_ids", []), "D")
        citations = _build_sources(descriptive_map, source_tags, products, videos)

        # 7. SAVE (raw query + final answer).
        session = await self._sessions.append_turn(
            session_id=session_id,
            user_query=request.message,
            assistant_content=answer,
            summary=new_summary,
            started_at=request_started_at,
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
        descriptive_map: dict[str, dict],
        product_map: dict[str, dict],
        video_map: dict[str, dict],
    ) -> list[dict]:
        messages: list[dict] = [{"role": "system", "content": _SYSTEM_INSTRUCTIONS}]
        if summary:
            messages.append({"role": "system", "content": f"[CONVERSATION SUMMARY]\n{summary}"})

        window = self._settings.chat_history_window_turns * 2
        messages.extend((chat_history or [])[-window:])

        context = _format_context(descriptive_map, product_map, video_map)
        if context:
            messages.append({"role": "system", "content": f"[RETRIEVED CONTEXT]\n{context}"})

        messages.append({"role": "user", "content": user_query})
        return messages


def _split_by_type(points: list) -> tuple[dict[str, dict], dict[str, dict], dict[str, dict]]:
    """Split scored points into tagged descriptive/product/video maps (D#/P#/V#)."""
    descriptive_map: dict[str, dict] = {}
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
            descriptive_map[f"D{len(descriptive_map) + 1}"] = payload
    return descriptive_map, product_map, video_map


def _format_context(
    descriptive_map: dict[str, dict], product_map: dict[str, dict], video_map: dict[str, dict]
) -> str:
    blocks: list[str] = []
    for tag, payload in descriptive_map.items():
        text = (payload.get("text") or "").strip()
        if text:
            blocks.append(f"[{tag}] {text}")
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
    descriptive_map: dict[str, dict],
    source_tags: set[str],
    products: list[ProductReference],
    videos: list[VideoReference],
) -> str:
    """Comma-separated, deduped page URLs the answer is actually grounded in.

    ``source_url`` only for the descriptive chunks the model cited via
    ``source_ids``, plus ``page_url`` for the referenced products/videos. Order
    preserved (descriptive → products → videos); empty URLs skipped; each page
    appears once. Hallucinated tags not in ``descriptive_map`` are ignored.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str | None) -> None:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    for tag, payload in descriptive_map.items():
        if tag in source_tags:
            add(payload.get("source_url"))
    for product in products:
        add(product.page_url)
    for video in videos:
        add(video.page_url)

    return ", ".join(urls)


# Internal context tags (D#/P#/V#) the model occasionally leaks into prose despite
# the system prompt. Conservative: only bracketed/parenthesised forms and a trailing
# run of tags are stripped — bare inline tokens are left alone to avoid corrupting
# legitimate text.
_TAG = r"[DPV]\d+"
_BRACKETED_TAG = re.compile(rf"[\[(]\s*{_TAG}(?:\s*[,;]\s*{_TAG})*\s*[\])]")
_TRAILING_TAGS = re.compile(rf"(?:\s*[\[(]?{_TAG}[\])]?)+\s*$")


def _sanitize_answer(answer: str) -> str:
    """Strip stray internal tag tokens that leaked into the visible answer."""
    cleaned = _BRACKETED_TAG.sub("", answer)
    cleaned = _TRAILING_TAGS.sub("", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\s+([.,;:!?])", r"\1", cleaned)
    return cleaned.strip()
