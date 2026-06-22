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
from datetime import datetime

from src.api.models.chat import (
    ChatCountResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionItem,
    ChatSessionListResponse,
    ChatTranscriptsResponse,
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
    "Answer the user's question grounded ONLY in the [RETRIEVED CONTEXT]. "
    "If the context does not contain the answer, say so plainly rather than "
    "inventing facts.\n\n"

    # ── 2. STRICT NO-HALLUCINATION RULE (highest priority) ────────────
    "## NO-HALLUCINATION RULE (HIGHEST PRIORITY)\n"
    "If the [RETRIEVED CONTEXT] does NOT contain information that answers the "
    "user's question, you MUST NOT guess, infer, fabricate, or use any outside "
    "or prior knowledge to construct an answer. Do not partially answer from "
    "assumptions. Instead, reply with a short, polite message along these lines:\n"
    "  'I'm sorry, but I don't have the information needed to answer that "
    "question. If there's something else you'd like to know, please feel free "
    "to ask.'\n"
    "You may rephrase this naturally, but the meaning must stay the same: you "
    "lack the data, you will not invent an answer, and you invite the user to "
    "ask something else. When you give this no-data response, return empty "
    "product_ids, video_ids, and source_ids.\n"
    "This rule overrides any urge to be helpful by filling gaps. An honest "
    "'I don't have that information' is always correct; a plausible-sounding "
    "but unsupported answer is never acceptable.\n\n"

    # ── 3. INTERNAL TAGS ──────────────────────────────────────────────
    "## INTERNAL TAGS\n"
    "The context is labelled with internal tags: descriptive chunks as [D1], "
    "[D2], products as [P1], [P2], and videos as [V1], [V2].\n"
    "TAGS ARE INTERNAL. They go ONLY in the structured fields, NEVER in the "
    "answer:\n"
    "- product_ids: the [P#] tags of products you recommend ([] if none).\n"
    "- video_ids:   the [V#] tags of videos you recommend ([] if none).\n"
    "- source_ids:  the [D#] tags of the descriptive chunks you actually used "
    "to ground your answer ([] if you used none).\n"
    "Only include tags for items that genuinely fit the user's need; otherwise "
    "return empty lists. Never invent product names, image URLs, or video "
    "URLs.\n\n"

    # ── 4. ANSWER TEXT FORMATTING ─────────────────────────────────────
    "## ANSWER TEXT FORMATTING\n"
    "In the ANSWER TEXT, refer to products and videos by their real NAMES "
    "(e.g. 'Dolostat Gel'). NEVER write tag tokens such as P1, V2, or D1, and "
    "never wrap them in brackets or parentheses in the visible answer. The app "
    "attaches the real images and links separately from the structured id "
    "fields.\n\n"

    # ── 5. CONVERSATION SUMMARY ───────────────────────────────────────
    "## CONVERSATION SUMMARY\n"
    "Always produce conversation_summary: merge the previous summary with this "
    "turn into ONE plain-text string of 100-200 characters (no markdown, no "
    "line breaks, no 'Summary:' prefix). Prioritise the user's primary intent "
    "and the most recent exchange.\n\n"

    # ── 6. GREETINGS & CHIT-CHAT ──────────────────────────────────────
    "## GREETINGS & CHIT-CHAT\n"
    "For greetings or chit-chat, respond naturally and keep the conversation "
    "flowing: return empty product_ids, video_ids, and source_ids, and do not "
    "mention any context or tags."
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

    async def answer(self, request: ChatRequest) -> ChatResponse:
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
