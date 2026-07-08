"""OpenAI chat-completion provider for RAG answering.

Produces a structured response in a single call — the answer, the next rolling
conversation summary, and the ids of any retrieved products/videos worth
referencing — using Chat Completions structured outputs (JSON schema). A small
``rewrite_standalone`` helper rewrites follow-up queries into standalone form for
accurate retrieval (see ``docs/CONVERSATION_HISTORY.md`` §6.3).
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from openai import APIError, AsyncOpenAI

from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.llm.errors import LLMError
from src.services.llm.openai_base import resolve_base_url

logger = get_logger(__name__)

# API-key values that indicate the key was never configured.
_PLACEHOLDER_KEYS = {"", "sk-replace-me"}

# JSON single-char escape sequences (excluding \u, handled separately).
_JSON_ESCAPES = {
    '"': '"', "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t",
}


def extract_json_string_field(buffer: str, key: str) -> tuple[str | None, bool]:
    """Incrementally decode a string field's value from a partial JSON ``buffer``.

    Scans for ``"<key>"`` -> ``:`` -> opening ``"`` and decodes the string value,
    handling JSON escapes. An **incomplete trailing escape** (a lone ``\\`` or a
    ``\\uXXXX`` with fewer than 4 hex digits available) is held back so we never
    emit a half-decoded character. Returns ``(decoded_so_far, closed)`` where
    ``closed`` is True once the closing quote is seen; ``(None, False)`` if the
    value hasn't started yet.
    """
    marker = f'"{key}"'
    idx = buffer.find(marker)
    if idx == -1:
        return None, False
    i = idx + len(marker)
    n = len(buffer)
    # Skip whitespace and the ':' separator.
    while i < n and buffer[i] in " \t\r\n":
        i += 1
    if i >= n or buffer[i] != ":":
        return None, False
    i += 1
    while i < n and buffer[i] in " \t\r\n":
        i += 1
    if i >= n or buffer[i] != '"':
        return None, False
    i += 1  # past the opening quote

    out: list[str] = []
    while i < n:
        ch = buffer[i]
        if ch == "\\":
            # Need at least the escape indicator char; hold back if it's the tail.
            if i + 1 >= n:
                break
            esc = buffer[i + 1]
            if esc == "u":
                if i + 6 > n:  # need \uXXXX (6 chars total)
                    break
                hex4 = buffer[i + 2 : i + 6]
                try:
                    out.append(chr(int(hex4, 16)))
                except ValueError:
                    out.append(buffer[i : i + 6])
                i += 6
                continue
            out.append(_JSON_ESCAPES.get(esc, esc))
            i += 2
            continue
        if ch == '"':
            return "".join(out), True
        out.append(ch)
        i += 1
    return "".join(out), False

# Structured-output schema for the main answering call.
_CHAT_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "chat_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "answer": {
                    "type": "string",
                    "description": "The grounded answer shown to the user.",
                },
                "conversation_summary": {
                    "type": "string",
                    "description": "New rolling summary, 100-200 chars, plain text.",
                },
                "product_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Tags (e.g. 'P1') of products worth referencing; [] if none.",
                },
                "video_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Tags (e.g. 'V1') of videos worth referencing; [] if none.",
                },
                "source_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Tags (e.g. 'D1') of the descriptive context chunks actually used "
                        "to ground the answer; [] if none (e.g. greetings/chit-chat)."
                    ),
                },
                "response_type": {
                    "type": "string",
                    "enum": ["answer", "chitchat", "no_info"],
                    "description": (
                        "'answer' = every claim is grounded in [RETRIEVED CONTEXT]; "
                        "'chitchat' = greeting/social/meta; "
                        "'no_info' = the context does NOT contain what's needed to answer "
                        "(never answer such questions from outside/world knowledge)."
                    ),
                },
            },
            "required": [
                "answer",
                "conversation_summary",
                "product_ids",
                "video_ids",
                "source_ids",
                "response_type",
            ],
        },
    },
}


class OpenAIChatProvider:
    def __init__(self, settings: Settings, client: AsyncOpenAI | None = None) -> None:
        self._model = settings.openai_chat_model
        self._api_key = (settings.openai_api_key or "").strip()
        self._base_url = resolve_base_url(settings.openai_base_url)
        self._client = client or AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)

    @property
    def model_name(self) -> str:
        return self._model

    def _guard_key(self) -> None:
        if self._api_key in _PLACEHOLDER_KEYS:
            raise LLMError("OPENAI_API_KEY is not configured. Set a valid key in your .env file.")

    async def complete_structured(self, messages: list[dict]) -> dict:
        """Run the answering call; return answer + summary + product/video ids."""
        self._guard_key()
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                response_format=_CHAT_RESPONSE_SCHEMA,
            )
        except APIError as exc:
            raise LLMError(f"OpenAI chat request failed ({type(exc).__name__}): {exc}") from exc

        content = response.choices[0].message.content or "{}"
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMError(f"OpenAI returned non-JSON structured output: {exc}") from exc

        return {
            "answer": data.get("answer", ""),
            "conversation_summary": data.get("conversation_summary"),
            "product_ids": data.get("product_ids", []),
            "video_ids": data.get("video_ids", []),
            "source_ids": data.get("source_ids", []),
            "response_type": data.get("response_type", "answer"),
        }

    async def stream_structured(self, messages: list[dict]) -> AsyncIterator[dict]:
        """Stream the answering call.

        Yields ``{"delta": "<new answer text>"}`` as the ``answer`` field grows,
        then exactly one ``{"final": {answer, conversation_summary, product_ids,
        video_ids, source_ids}}`` once the full structured JSON has arrived. Relies
        on ``answer`` being the first property in the strict schema so it can be
        extracted incrementally.
        """
        self._guard_key()
        buffer: list[str] = []
        emitted = 0
        try:
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                response_format=_CHAT_RESPONSE_SCHEMA,
                stream=True,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                piece = chunk.choices[0].delta.content
                if not piece:
                    continue
                buffer.append(piece)
                text, _closed = extract_json_string_field("".join(buffer), "answer")
                if text is not None and len(text) > emitted:
                    yield {"delta": text[emitted:]}
                    emitted = len(text)
        except APIError as exc:
            raise LLMError(f"OpenAI chat stream failed ({type(exc).__name__}): {exc}") from exc

        raw = "".join(buffer).strip()
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError as exc:
            raise LLMError(f"OpenAI returned non-JSON structured output: {exc}") from exc

        yield {
            "final": {
                "answer": data.get("answer", ""),
                "conversation_summary": data.get("conversation_summary"),
                "product_ids": data.get("product_ids", []),
                "video_ids": data.get("video_ids", []),
                "source_ids": data.get("source_ids", []),
                "response_type": data.get("response_type", "answer"),
            }
        }

    async def rewrite_standalone(self, query: str, summary: str | None, history: list[dict]) -> str:
        """Rewrite a possibly-elliptical follow-up into a standalone query.

        Returns the original query unchanged when there is no prior context.
        """
        if not summary and not history:
            return query

        self._guard_key()
        context_parts: list[str] = []
        if summary:
            context_parts.append(f"Conversation summary: {summary}")
        recent = history[-4:]  # last two turns are plenty to resolve references
        if recent:
            transcript = "\n".join(f"{m.get('role')}: {m.get('content')}" for m in recent)
            context_parts.append(f"Recent turns:\n{transcript}")
        context = "\n\n".join(context_parts)

        rewrite_messages = [
            {
                "role": "system",
                "content": (
                    "Rewrite the user's latest message into a fully standalone search "
                    "query by resolving pronouns and references from the context. "
                    "Reply with ONLY the rewritten query, no preamble."
                ),
            },
            {"role": "user", "content": f"{context}\n\nLatest message: {query}"},
        ]
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=rewrite_messages,
            )
        except APIError as exc:
            # Rewrite is best-effort — fall back to the raw query on failure.
            logger.warning("query_rewrite_failed", error=str(exc))
            return query
        rewritten = (response.choices[0].message.content or "").strip()
        return rewritten or query

    async def identify_product(
        self,
        message: str,
        standalone: str,
        history: list[dict],
        candidates: list[str],
    ) -> str | None:
        """Return the candidate product the question is genuinely about, or None.

        Constrained to ``candidates`` (canonical DB product names retrieved for
        this query) so name variations normalise to a stable key and general /
        unrelated questions return None. Best-effort: any error → None so a
        classifier hiccup never blocks a normal answer.
        """
        if not candidates:
            return None

        self._guard_key()
        recent = history[-4:]
        transcript = "\n".join(f"{m.get('role')}: {m.get('content')}" for m in recent)
        listing = "\n".join(f"- {name}" for name in candidates)
        messages = [
            {
                "role": "system",
                "content": (
                    "You classify which product a user's question is specifically "
                    "about. Choose EXACTLY ONE name from the provided list if the "
                    "question is genuinely seeking information about that product "
                    "(including via pronouns or paraphrased/variant names). If the "
                    "question is general, unrelated, or not about any listed "
                    "product, reply with NONE. Reply with ONLY the product name "
                    "exactly as listed, or NONE — no other text."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Products:\n{listing}\n\n"
                    f"Recent conversation:\n{transcript or '(none)'}\n\n"
                    f"User message: {message}\n"
                    f"Standalone form: {standalone}"
                ),
            },
        ]
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
            )
        except APIError as exc:
            logger.warning("product_identify_failed", error=str(exc))
            return None

        reply = (response.choices[0].message.content or "").strip()
        if not reply or reply.upper() == "NONE":
            return None
        # Validate against candidates (case-insensitive) so we only ever key the
        # counter on a real canonical product name.
        lowered = reply.lower()
        for name in candidates:
            if name.lower() == lowered:
                return name
        return None

    async def aclose(self) -> None:
        await self._client.close()
