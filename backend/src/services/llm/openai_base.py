"""Shared OpenAI base-URL resolution for the embedding and chat providers.

Centralizes the defensive ``.env`` handling so both providers behave identically:
a blank value falls back to the default endpoint, a stray inline comment leaking
in as the value is treated as blank, and a scheme-less host gets ``https://``.
Passing an explicit URL also bypasses the OpenAI SDK's broken empty-env fallback
(an empty ``OPENAI_BASE_URL`` would otherwise yield relative request URLs and
fail with ``UnsupportedProtocol`` / ``APIConnectionError``).
"""

from __future__ import annotations

from src.core.logging.setup import get_logger

logger = get_logger(__name__)

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"


def resolve_base_url(raw: str | None) -> str:
    """Return a valid, scheme-qualified base URL (never ``None`` or empty)."""
    candidate = (raw or "").strip()
    if not candidate or candidate.startswith("#"):
        return DEFAULT_OPENAI_BASE_URL
    if not candidate.startswith(("http://", "https://")):
        logger.warning("openai_base_url_missing_scheme", value=candidate)
        return f"https://{candidate}"
    return candidate
