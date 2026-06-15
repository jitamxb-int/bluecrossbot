"""Embedding-related domain exceptions."""

from __future__ import annotations


class EmbeddingError(RuntimeError):
    """Raised when embedding generation fails or the provider is misconfigured.

    Surfaced to the API as a clear ``502 Bad Gateway`` with the message, instead
    of a generic 500 / cryptic connection traceback.
    """
