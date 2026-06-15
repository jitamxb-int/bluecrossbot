"""Embedding provider interface.

Defining a provider abstraction keeps the embedding backend swappable — the
ingestion pipeline depends only on this interface, so a local provider
(FastEmbed / sentence-transformers) can be added later without touching callers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    """Async embedding generation contract."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Identifier of the underlying embedding model."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Dimensionality of the produced vectors."""

    @abstractmethod
    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts, preserving input order in the output."""

    async def aclose(self) -> None:
        """Release any underlying resources (optional override)."""
        return None
