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
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

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
from src.services.llm.errors import LLMError
from src.services.llm.openai_chat import OpenAIChatProvider
from src.services.retrieval.service import RetrievalService
from src.storage.mongo.config import ConfigRepository
from src.storage.mongo.session import SessionRepository

logger = get_logger(__name__)

# Returned (HTTP 200) when a message targets a session past its max duration.
SESSION_EXPIRED_MESSAGE = (
    "Your chat session has reached the maximum allowed duration and has now ended. "
    "Please refresh the page to start a new session. "
    "If you require any additional information or assistance, feel free to email us at "
    "info@bluecrosslabs.com, and our team will get back to you as soon as possible."
)

# After more than this many questions about the SAME product in one session, the
# bot stops giving detailed product answers and routes the user to email support.
PRODUCT_QUERY_LIMIT = 5
EMAIL_SUPPORT_MESSAGE = (
    "If you require any additional information or assistance regarding this "
    "product, please feel free to email us at info@bluecrosslabs.com. Our team will "
    "be happy to assist you and will get back to you as soon as possible."
)

# Canonical refusal used whenever the model reports the answer isn't grounded in
# the retrieved context (response_type == "no_info"). Kept identical to the
# fallback wording embedded in the system prompt.
NO_INFO_MESSAGE = (
    "I'm sorry, I don't have enough information to answer that question at the moment. "
    "If you need a more detailed or prompt response, please feel free to email us at "
    "info@bluecrosslabs.com, and our team will be happy to assist you."
)

_SYSTEM_INSTRUCTIONS = (
    # ── ROLE ──────────────────────────────────────────────────────────
    "You are Luna, an assistant for Blue Cross Laboratories, here to help "
    "users with information related to our products and services.\n\n"

    # ── 0. IDENTITY (who you are) ─────────────────────────────────────
    "## IDENTITY\n"
    "Your name is Luna. You are the assistant for Blue Cross Laboratories, and "
    "your purpose is to help users with information related to Blue Cross "
    "Laboratories' products and services. Hold this as your own understanding "
    "of who you are — not a script to recite.\n"
    "When the user asks about you or the bot — e.g. 'who are you', 'what are "
    "you', 'what is your name', 'what can you do', 'tell me about yourself', "
    "'what is this bot' — answer naturally in your OWN words, adapting to what "
    "they actually asked. Someone asking your name just needs your name; "
    "someone asking what you can do wants a short sense of how you help; a "
    "general 'who are you' gets a brief, warm introduction. Vary the wording "
    "turn to turn — never repeat one fixed, canned sentence.\n"
    "Keep these replies to the core idea (you're Luna, an assistant for Blue "
    "Cross Laboratories, here to help with its products and services) and, "
    "when it fits, invite them to ask what they need. For reference tone, a "
    "natural intro might read: 'I'm Luna, an assistant for Blue Cross "
    "Laboratories — here to help you with information about our products and "
    "services. How can I assist you today?' — but treat that as an example of "
    "the tone, not a line to copy verbatim.\n"
    "For identity questions, return empty product_ids, video_ids, and "
    "source_ids. Do not mention context or tags.\n\n"

    # ── 1. GROUNDING ──────────────────────────────────────────────────
    "## GROUNDING\n"
    "Answer ONLY from the [RETRIEVED CONTEXT]. "
    "If the answer isn't there, say so plainly — never invent facts.\n\n"

    # ── 2. STRICT NO-HALLUCINATION RULE (highest priority) ────────────
    "## NO-HALLUCINATION RULE (HIGHEST PRIORITY)\n"
    "Never invent, guess, or fabricate facts that are NOT present in the "
    "[RETRIEVED CONTEXT].\n"
    "BUT — if the information needed to answer IS present in the context, you "
    "MUST answer. This holds even when the relevant facts are spread across "
    "several chunks, worded differently from the user's question, or need to "
    "be pulled together into one clear reply. Combining, summarising, or "
    "rephrasing facts that are actually in the context is NOT hallucination — "
    "it is your job. Do NOT refuse just because the wording doesn't match the "
    "question, or because one minor sub-detail is missing; answer the part the "
    "context supports.\n"
    "Use the fallback below ONLY when the context contains NO relevant "
    "information about what the user asked — i.e. the answer is genuinely "
    "absent, not merely phrased differently or requiring you to connect a "
    "couple of stated facts. When in doubt and the context clearly supports an "
    "answer, ANSWER rather than refuse.\n"
    "Fallback (use ONLY when the answer is truly not in the context):\n"
    "  'I'm sorry, I don't have enough information to answer that question at the moment. "
    "If you need a more detailed or prompt response, please feel free to email us at "
    "info@bluecrosslabs.com, and our team will be happy to assist you.'\n"
    "Rephrase naturally, but keep the meaning: you lack the data, you won't "
    "invent an answer, and the user can reach out by email for further help. "
    "Return empty product_ids, video_ids, and source_ids in this case.\n"
    "An honest 'I don't know' is correct only when the context truly lacks the "
    "answer. A plausible but unsupported answer is never acceptable.\n\n"

    # ── 3. COMPOSITION / INGREDIENT QUESTIONS (HIGH PRIORITY) ─────────
    "## COMPOSITION / INGREDIENT QUESTIONS\n"
    "This rule overrides any instinct to reuse the full context chunk as-is.\n"
    "If the user asks about a product's 'composition', 'ingredients', 'what "
    "does it contain', 'formula', or similar — and does NOT explicitly say "
    "'inactive ingredients', 'excipients', or 'full formulation' — then:\n"
    "- Answer with ONLY the active ingredient(s) and strength, in one short "
    "sentence.\n"
    "- Do NOT use the words 'inactive', 'excipient', 'microcrystalline "
    "cellulose', 'starch', 'stabilization', 'flavouring', or any other "
    "excipient name in this reply, even briefly or in passing.\n"
    "- Do NOT structure the answer as a list with an active/inactive split. "
    "One plain sentence is enough.\n"
    "- Example — user asks 'tell me about its composition':\n"
    "  CORRECT: 'MEFTAL-P Dispersible Tablets contain 100 mg of mefenamic "
    "acid per tablet.'\n"
    "  INCORRECT: any version that also mentions inactive ingredients or "
    "excipients.\n"
    "- Only give the inactive ingredients / excipients list if the user's "
    "own message explicitly asks for them.\n\n"

    # ── 3B. PURCHASING / ORDERING MEDICINE ────────────────────────────
    "## PURCHASING / ORDERING MEDICINE\n"
    "When the user asks how to GET, BUY, ORDER, or OBTAIN a medicine — e.g. "
    "'how can I get your medicine', 'can I order meds directly to my home', "
    "'how do I buy this online', 'can I get it directly from the plant / from "
    "employees', 'where can I purchase it', or any similar purchase/delivery "
    "request — do NOT provide ordering links, delivery options, or direct-"
    "supply routes. Instead, convey this compliance guidance:\n"
    "  - The medication requires a valid prescription from a licensed medical "
    "practitioner.\n"
    "  - Per applicable regulations, it should only be purchased from an "
    "authorized pharmacist or licensed chemist.\n"
    "  - Advise the user to consult their healthcare provider and obtain the "
    "medicine through an approved pharmacy.\n"
    "Phrase this naturally in your own words — do NOT recite a fixed line. It "
    "is perfectly fine if your wording does NOT match the quoted line below "
    "exactly; what matters is that you CONVEY the same meaning. Rephrase it "
    "intelligently and vary it from turn to turn, so the chat never feels "
    "robotic or repetitive — just keep all three points above intact and never "
    "suggest buying directly from the plant, employees, or any unauthorized "
    "source. For reference tone: "
    "'The requested medication is a scheduled drug and requires a valid "
    "prescription from a licensed medical practitioner. As per applicable "
    "regulations, it should only be purchased from an authorized pharmacist or "
    "licensed chemist. Please consult your healthcare provider and obtain the "
    "medicine through an approved pharmacy.' — this is only an example of the "
    "tone and meaning to preserve, NOT a script to copy word for word.\n"
    "Return empty product_ids and source_ids for these purchase questions; "
    "populate video_ids only if a video genuinely helps.\n\n"

    # ── 4. INTERNAL TAGS ──────────────────────────────────────────────
    "## INTERNAL TAGS\n"
    "Context is tagged as [D1], [D2] (descriptive), [P1], [P2] (products), "
    "[V1], [V2] (videos). Tags go ONLY in structured fields, NEVER in the "
    "answer text:\n"
    "- product_ids: [P#] tags of recommended products ([] if none).\n"
    "- video_ids:   [V#] tags of recommended videos ([] if none).\n"
    "- source_ids:  [D#] tags of chunks used to ground the answer ([] if none).\n"
    "Only include tags that genuinely fit. Never invent product names, image "
    "URLs, or video URLs.\n\n"

    # ── 5. ANSWER TEXT FORMATTING ─────────────────────────────────────
    "## ANSWER TEXT FORMATTING\n"
    "Refer to products and videos by their real NAMES (e.g. 'Dolostat Gel'). "
    "NEVER write tag tokens like P1, V2, or D1 in the visible answer. "
    "The app attaches images and links from the structured id fields.\n\n"

    # ── 6. RESPONSE FORMATTING ────────────────────────────────────────
    "## RESPONSE FORMATTING\n"
    "Every response must be precise and crisp — not too long, not too short, "
    "just enough to fully answer the question and nothing more:\n"
    "- **Short answers**: plain prose, 1–3 sentences. No lists, no bold unless "
    "a term truly needs emphasis.\n"
    "- **Longer answers**: use bullet points to break up the content. Each "
    "bullet must be concise — one clear idea per bullet, no padding.\n"
    "- **Sequential steps**: use a numbered list.\n"
    "- **Bold** only product names, critical warnings, or key terms the user "
    "must not miss.\n"
    "- Never pad responses. If the full answer fits in two sentences, write "
    "two sentences.\n"
    "- **Answer strictly what was asked — nothing adjacent, even if it's in "
    "the context.** (See the COMPOSITION / INGREDIENT QUESTIONS rule above "
    "for the specific case of composition questions.) This applies more "
    "broadly too:\n"
    "  - 'dosage' → dose/frequency only, not storage or warnings.\n"
    "  - 'side effects' → side effects only, not contraindications or "
    "dosage.\n"
    "  - If truly unsure whether the user wants the fuller picture, answer "
    "the narrow question first and offer to share more "
    "(e.g. 'Let me know if you'd also like more detail.') rather than "
    "dumping everything.\n\n"

    # ── 7. PROACTIVE PRODUCTS & VIDEOS ───────────────────────────────
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
    "### EXCEPTION — 'HOW/WHEN TO TAKE' & DOSAGE QUERIES ABOUT A NAMED PRODUCT\n"
    "This exception OVERRIDES the proactive rule above.\n"
    "When the user has already named a specific product and is only asking HOW "
    "or WHEN to use it — e.g. 'how and when to take Kyglip', 'how much X', "
    "'how often should I take X', or any dosage / timing / administration "
    "question — the user already knows the product, so a product card and a "
    "source citation add nothing and should be suppressed:\n"
    "- Return EMPTY product_ids AND EMPTY source_ids for these queries.\n"
    "- Answer the usage/dosage question in plain text only.\n"
    "- Populate video_ids ONLY if a video genuinely demonstrates the usage; "
    "otherwise leave it empty too.\n"
    "This applies only to usage/dosage/timing questions about an "
    "already-named product. Symptom- or concern-based questions still surface "
    "products normally per the rule above.\n\n"

    # ── 8. CONVERSATION SUMMARY ───────────────────────────────────────
    "## CONVERSATION SUMMARY\n"
    "Always produce conversation_summary: merge the previous summary with this "
    "turn into ONE plain-text string of 100–200 characters (no markdown, no "
    "line breaks, no 'Summary:' prefix). Prioritise the user's primary intent "
    "and the most recent exchange.\n\n"

    # ── 9. GREETINGS & CHIT-CHAT ──────────────────────────────────────
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
        config: ConfigRepository,
    ) -> None:
        self._retrieval = retrieval
        self._llm = llm
        self._sessions = sessions
        self._settings = settings
        self._config = config

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
        # Auto-expire idle / over-duration sessions before listing so the status
        # reflects current state (max duration is the primary rule).
        max_minutes = await self._config.get_max_session_duration_minutes()
        await self._sessions.deactivate_stale(timedelta(minutes=max_minutes))
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

    async def set_hcp_consent(self, session_id: str) -> SessionInfo | None:
        """Grant HCP consent for a session; returns the updated SessionInfo or None."""
        session = await self._sessions.set_hcp_consent(session_id)
        if session is None:
            return None
        logger.info("hcp_consent_granted", session_id=session_id)
        return SessionInfo(
            session_id=session.session_id,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_seconds=session.duration_seconds,
            is_active=session.is_active,
            hcp_consent=session.hcp_consent,
        )

    async def _product_gate(
        self,
        session: object | None,
        message: str,
        standalone: str,
        chat_history: list[dict],
        product_map: dict[str, dict],
    ) -> tuple[dict[str, int], bool, str | None]:
        """Identify the focused product, bump its per-session counter, decide gating.

        Returns ``(updated_counts, gated, focused_product)``. ``gated`` is True once
        the focused product exceeds ``PRODUCT_QUERY_LIMIT`` (i.e. the 6th+ question
        about it) — the caller then routes to email support instead of answering.
        """
        candidates = list(
            {p.get("product_name") for p in product_map.values() if p.get("product_name")}
        )
        focused = await self._llm.identify_product(
            message, standalone, chat_history, candidates
        )
        counts = dict(session.product_query_counts) if session is not None else {}
        gated = False
        if focused:
            counts[focused] = counts.get(focused, 0) + 1
            gated = counts[focused] > PRODUCT_QUERY_LIMIT
            logger.info(
                "product_query_counted",
                product=focused,
                count=counts[focused],
                gated=gated,
            )
        return counts, gated, focused

    async def _apply_pi_priority(
        self,
        standalone: str,
        descriptive_map: dict[str, dict],
        top_k: int,
    ) -> dict[str, dict]:
        """Prioritize the linked PI document over its PIL for a product question.

        If the retrieved descriptive context includes PI/PIL chunks, scope the
        context to the dominant product's PI chunks first; if the best PI chunk
        isn't relevant enough (``pi_relevance_threshold``), fall back to the linked
        PIL chunks. When no PI/PIL chunks are present the map is returned unchanged
        (existing blended behavior is preserved).
        """
        pipil = [
            (tag, p)
            for tag, p in descriptive_map.items()
            if p.get("pdf_type") in ("PI", "PIL")
        ]
        if not pipil:
            return descriptive_map

        target_key = max(pipil, key=lambda tp: tp[1].get("_score") or 0.0)[1].get("product_key")
        if not target_key:
            return descriptive_map

        # Dense-only (cosine) so `pi_top` is comparable to the cosine-calibrated
        # `pi_relevance_threshold`. Hybrid RRF scores would be rank-derived and make
        # the threshold meaningless (see HCP-consent note in answer_stream).
        pi_points = await self._retrieval.search(
            standalone, top_k, {"product_key": target_key, "pdf_type": "PI"}, hybrid=False
        )
        pi_top = (pi_points[0].score or 0.0) if pi_points else None
        pi_sufficient = pi_points and (pi_top or 0.0) >= self._settings.pi_relevance_threshold

        if pi_sufficient:
            chosen, used = pi_points, "PI"
        else:
            pil_points = await self._retrieval.search(
                standalone, top_k, {"product_key": target_key, "pdf_type": "PIL"}, hybrid=False
            )
            chosen = pil_points or pi_points
            used = "PIL" if pil_points else "PI"

        # Scoped search found nothing usable — keep the blended context rather than
        # dropping the PI/PIL chunks (preserves grounding, citations, and the PDF
        # signal the HCP gate depends on).
        if not chosen:
            logger.info("pi_pil_selection_empty", product_key=target_key)
            return descriptive_map

        logger.info(
            "pi_pil_selection", product_key=target_key, used=used, pi_top_score=pi_top
        )

        # Rebuild the descriptive map: keep non-PI/PIL descriptive chunks, then
        # append the chosen PI/PIL chunks, re-tagged D1, D2, … in order.
        rebuilt: dict[str, dict] = {}
        index = 0
        for _tag, payload in descriptive_map.items():
            if payload.get("pdf_type") in ("PI", "PIL"):
                continue
            index += 1
            rebuilt[f"D{index}"] = payload
        for point in chosen:
            payload = dict(point.payload or {})
            payload["_score"] = getattr(point, "score", None)
            index += 1
            rebuilt[f"D{index}"] = payload
        return rebuilt

    async def answer(self, request: ChatRequest) -> ChatResponse:
        # Capture arrival time BEFORE retrieval + LLM so a single-turn session records the
        # real time the turn took (otherwise started_at == ended_at and duration is 0).
        request_started_at = datetime.now(UTC)
        session_id = request.session_id or uuid.uuid4().hex
        top_k = request.top_k or self._settings.chat_retrieval_top_k

        # 1. LOAD. An unrecognised id (e.g. a stale one from the frontend) is treated
        #    as a brand-new conversation: mint a fresh id and start clean. The frontend
        #    replaces its stale id with the one echoed back in the response.
        session = await self._sessions.get_session(session_id)
        if request.session_id and session is None:
            logger.info("chat_session_replaced", stale_session_id=session_id)
            session_id = uuid.uuid4().hex
            session = None

        # 1a. MAX-DURATION GATE (primary rule). A known session older than the
        #     configured maximum is expired: mark it inactive and reject the
        #     message without running retrieval/LLM. The user must start a new
        #     session (refresh → no session_id → fresh conversation).
        if session is not None:
            max_minutes = await self._config.get_max_session_duration_minutes()
            started = session.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=UTC)
            if request_started_at - started >= timedelta(minutes=max_minutes):
                if session.is_active:
                    await self._sessions.mark_inactive(session_id)
                logger.info(
                    "chat_session_expired",
                    session_id=session_id,
                    max_session_duration_minutes=max_minutes,
                )
                return ChatResponse(
                    answer=SESSION_EXPIRED_MESSAGE,
                    session=SessionInfo(
                        session_id=session.session_id,
                        started_at=session.started_at,
                        ended_at=session.ended_at,
                        duration_seconds=session.duration_seconds,
                        is_active=False,
                        hcp_consent=session.hcp_consent,
                    ),
                    citations="",
                    products=[],
                    videos=[],
                )

        chat_history = session.chat_json if session is not None else []
        summary = session.conversation_summary if session is not None else None

        # 2. Rewrite for retrieval only (raw query is what we store/show).
        standalone = await self._llm.rewrite_standalone(request.message, summary, chat_history)

        # 3. Retrieve (blended across doc types).
        logger.info(f"Standalone query generated: {standalone}")

        points = await self._retrieval.search(standalone, top_k)

        logger.info(f"Retrieved {len(points)} points from vector search")
        logger.debug(f"Retrieved points: {points}")
        descriptive_map, product_map, video_map = _split_by_type(points)

        # 3a1. PI-priority: prefer the linked PI document, fall back to its PIL.
        descriptive_map = await self._apply_pi_priority(standalone, descriptive_map, top_k)

        # 3a. PRODUCT QUERY GATE. If the user has asked > limit questions about the
        #     same product, stop answering in detail and route to email support.
        counts, product_gated, _focused = await self._product_gate(
            session, request.message, standalone, chat_history, product_map
        )
        if product_gated:
            session = await self._sessions.append_turn(
                session_id=session_id,
                user_query=request.message,
                assistant_content=EMAIL_SUPPORT_MESSAGE,
                started_at=request_started_at,
                product_query_counts=counts,
            )
            return ChatResponse(
                answer=EMAIL_SUPPORT_MESSAGE,
                session=SessionInfo(
                    session_id=session.session_id,
                    started_at=session.started_at,
                    ended_at=session.ended_at,
                    duration_seconds=session.duration_seconds,
                    is_active=session.is_active,
                    hcp_consent=session.hcp_consent,
                ),
                citations="",
                products=[],
                videos=[],
            )

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

        # 6a. GROUNDING GUARD. If the model flagged the answer as ungrounded
        #     (context lacks it), force the canonical refusal — never let a
        #     world-knowledge answer through. (Keyed on the declared type, not on
        #     empty ids, since valid dosage answers intentionally cite nothing.)
        if result.get("response_type") == "no_info":
            answer = NO_INFO_MESSAGE
            products, videos, citations = [], [], ""

        # 7. SAVE (raw query + final answer).
        session = await self._sessions.append_turn(
            session_id=session_id,
            user_query=request.message,
            assistant_content=answer,
            summary=new_summary,
            started_at=request_started_at,
            product_query_counts=counts,
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
                hcp_consent=session.hcp_consent,
            ),
            citations=citations,
            products=products,
            videos=videos,
        )

    async def answer_stream(self, request: ChatRequest) -> AsyncIterator[dict]:
        """Streaming variant of :meth:`answer` — yields SSE event dicts.

        Emits ``start`` -> ``delta``* -> ``done`` (or a single ``done`` for an
        expired session, or ``error`` on failure). Mirrors ``answer``'s
        load / expiry-gate / retrieve / resolve / persist logic so behaviour is
        identical, only delivered incrementally.
        """
        request_started_at = datetime.now(UTC)
        session_id = request.session_id or uuid.uuid4().hex
        top_k = request.top_k or self._settings.chat_retrieval_top_k

        try:
            # 1. LOAD + stale-id handling.
            session = await self._sessions.get_session(session_id)
            if request.session_id and session is None:
                logger.info("chat_session_replaced", stale_session_id=session_id)
                session_id = uuid.uuid4().hex
                session = None

            # 1a. MAX-DURATION GATE — expired session: one done event, no streaming.
            if session is not None:
                max_minutes = await self._config.get_max_session_duration_minutes()
                started = session.started_at
                if started.tzinfo is None:
                    started = started.replace(tzinfo=UTC)
                if request_started_at - started >= timedelta(minutes=max_minutes):
                    if session.is_active:
                        await self._sessions.mark_inactive(session_id)
                    logger.info(
                        "chat_session_expired",
                        session_id=session_id,
                        max_session_duration_minutes=max_minutes,
                    )
                    yield {
                        "type": "done",
                        "answer": SESSION_EXPIRED_MESSAGE,
                        "session": SessionInfo(
                            session_id=session.session_id,
                            started_at=session.started_at,
                            ended_at=session.ended_at,
                            duration_seconds=session.duration_seconds,
                            is_active=False,
                            hcp_consent=session.hcp_consent,
                        ).model_dump(mode="json"),
                        "citations": "",
                        "products": [],
                        "videos": [],
                    }
                    return

            chat_history = session.chat_json if session is not None else []
            summary = session.conversation_summary if session is not None else None

            # 2-4. Rewrite (retrieval only) -> retrieve -> build prompt.
            standalone = await self._llm.rewrite_standalone(
                request.message, summary, chat_history
            )
            logger.info(f"Standalone query generated: {standalone}")
            points = await self._retrieval.search(standalone, top_k)
            logger.info(f"Retrieved {len(points)} points from vector search")

            # HCP-consent signal. Decided on a comparable COSINE scale via a dense-only
            # probe (the main `points` above come from hybrid/RRF search, whose scores
            # are rank-derived and cannot express relevance). Consent is required ONLY
            # when a PDF source is the MOST relevant source for this query — i.e. the
            # answer will actually be grounded in PDF (HCP) content. A weakly-related
            # PDF chunk that exists in the corpus but is out-ranked by a
            # descriptive/product/video chunk (e.g. "who is the vice chairman?") must
            # NOT trigger consent. Greetings/chit-chat stay below the floor too.
            consent_probe = await self._retrieval.search(standalone, top_k, hybrid=False)

            def _src(pt) -> str:
                return ((pt.payload or {}).get("source_url") or "").lower()

            pdf_top = max(
                ((pt.score or 0.0) for pt in consent_probe if _src(pt) == "pdf"),
                default=0.0,
            )
            other_top = max(
                ((pt.score or 0.0) for pt in consent_probe if _src(pt) != "pdf"),
                default=0.0,
            )
            retrieval_has_pdf = (
                pdf_top >= self._settings.pdf_consent_min_score and pdf_top >= other_top
            )

            descriptive_map, product_map, video_map = _split_by_type(points)

            # PI-priority: prefer the linked PI document, fall back to its PIL.
            descriptive_map = await self._apply_pi_priority(standalone, descriptive_map, top_k)

            session_consented = bool(session is not None and session.hcp_consent)

            # 4a. PRODUCT QUERY GATE (before any token streams). Once the user has
            #     asked > limit questions about the same product, route to email
            #     support instead of a detailed answer. Never HCP-blurred.
            counts, product_gated, _focused = await self._product_gate(
                session, request.message, standalone, chat_history, product_map
            )
            if product_gated:
                yield {
                    "type": "start",
                    "session_id": session_id,
                    "hcp_consent": session_consented,
                    "requires_consent": False,
                }
                yield {"type": "delta", "text": EMAIL_SUPPORT_MESSAGE}
                session = await self._sessions.append_turn(
                    session_id=session_id,
                    user_query=request.message,
                    assistant_content=EMAIL_SUPPORT_MESSAGE,
                    started_at=request_started_at,
                    product_query_counts=counts,
                )
                yield {
                    "type": "done",
                    "answer": EMAIL_SUPPORT_MESSAGE,
                    "session": SessionInfo(
                        session_id=session.session_id,
                        started_at=session.started_at,
                        ended_at=session.ended_at,
                        duration_seconds=session.duration_seconds,
                        is_active=session.is_active,
                        hcp_consent=session.hcp_consent,
                    ).model_dump(mode="json"),
                    "citations": "",
                    "products": [],
                    "videos": [],
                }
                return

            messages = self._build_messages(
                request.message, chat_history, summary, descriptive_map, product_map, video_map
            )

            # 5. Decide the HCP-consent gate BEFORE any token streams, using the
            #    pre-reshape retrieval signal above: if any retrieved chunk is
            #    PDF-sourced and the session hasn't consented, the answer must
            #    stream behind the blur from the first token.
            requires_consent = retrieval_has_pdf and not session_consented

            # 6. Stream the LLM answer; capture the final structured payload.
            yield {
                "type": "start",
                "session_id": session_id,
                "hcp_consent": session_consented,
                "requires_consent": requires_consent,
            }
            final: dict = {}
            async for event in self._llm.stream_structured(messages):
                if "delta" in event:
                    yield {"type": "delta", "text": event["delta"]}
                elif "final" in event:
                    final = event["final"]

            # 7. Resolve chosen tags -> grounded references (same as answer()).
            answer = _sanitize_answer(final.get("answer", ""))
            new_summary = final.get("conversation_summary")
            products = _resolve_products(final.get("product_ids", []), product_map)
            videos = _resolve_videos(final.get("video_ids", []), video_map)
            source_tags = _normalize_tags(final.get("source_ids", []), "D")
            citations = _build_sources(descriptive_map, source_tags, products, videos)

            # 7a. GROUNDING GUARD. If the model flagged the answer as ungrounded,
            #     force the canonical refusal (the model was instructed to stream
            #     that text for no_info, so the `done` answer stays consistent).
            if final.get("response_type") == "no_info":
                answer = NO_INFO_MESSAGE
                products, videos, citations = [], [], ""

            # 8. SAVE (raw query + final answer).
            session = await self._sessions.append_turn(
                session_id=session_id,
                user_query=request.message,
                assistant_content=answer,
                summary=new_summary,
                started_at=request_started_at,
                product_query_counts=counts,
            )
            logger.info(
                "chat_turn_complete",
                session_id=session_id,
                products=len(products),
                videos=len(videos),
                citations=len(citations.split(", ")) if citations else 0,
            )

            yield {
                "type": "done",
                "answer": answer,
                "session": SessionInfo(
                    session_id=session.session_id,
                    started_at=session.started_at,
                    ended_at=session.ended_at,
                    duration_seconds=session.duration_seconds,
                    is_active=session.is_active,
                    hcp_consent=session.hcp_consent,
                ).model_dump(mode="json"),
                "citations": citations,
                "products": [p.model_dump(mode="json") for p in products],
                "videos": [v.model_dump(mode="json") for v in videos],
            }
        except Exception as exc:  # noqa: BLE001 - always close the stream gracefully
            logger.exception("chat_stream_failed", error=str(exc))
            detail = (
                str(exc)
                if isinstance(exc, LLMError)
                else "Something went wrong while streaming the response."
            )
            yield {"type": "error", "detail": detail}

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
