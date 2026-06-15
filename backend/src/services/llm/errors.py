"""LLM-related domain exceptions."""

from __future__ import annotations


class LLMError(RuntimeError):
    """Raised when chat generation fails or the provider is misconfigured.

    Surfaced to the API as a clear ``502 Bad Gateway`` (mirroring
    :class:`~src.services.embedding.errors.EmbeddingError`).
    """
