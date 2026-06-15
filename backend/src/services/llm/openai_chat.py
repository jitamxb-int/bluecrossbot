"""OpenAI chat-completion provider for RAG answering.

Produces a structured response in a single call — the answer, the next rolling
conversation summary, and the ids of any retrieved products/videos worth
referencing — using Chat Completions structured outputs (JSON schema). A small
``rewrite_standalone`` helper rewrites follow-up queries into standalone form for
accurate retrieval (see ``docs/CONVERSATION_HISTORY.md`` §6.3).
"""

from __future__ import annotations

import json

from openai import APIError, AsyncOpenAI

from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.llm.errors import LLMError
from src.services.llm.openai_base import resolve_base_url

logger = get_logger(__name__)

# API-key values that indicate the key was never configured.
_PLACEHOLDER_KEYS = {"", "sk-replace-me"}

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
            },
            "required": ["answer", "conversation_summary", "product_ids", "video_ids"],
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
            raise LLMError(
                "OPENAI_API_KEY is not configured. Set a valid key in your .env file."
            )

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
        }

    async def rewrite_standalone(
        self, query: str, summary: str | None, history: list[dict]
    ) -> str:
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

    async def aclose(self) -> None:
        await self._client.close()
