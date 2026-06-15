"""Retrieval service — embed a query and run top-k vector search over Qdrant.

Wired with the same embedding provider and Qdrant repository the ingestion
pipeline uses. Returns scored chunks with their full stored payload preserved,
so callers (the ``/retrieve`` route and the chat service) can surface
content-type-specific fields like ``image_url`` / ``video_url``.
"""

from __future__ import annotations

from qdrant_client.models import ScoredPoint

from src.api.models.retrieval import RetrievedChunk, RetrieveRequest, RetrieveResponse
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.embedding.base import EmbeddingProvider
from src.storage.qdrant.repository import QdrantRepository

logger = get_logger(__name__)


class RetrievalService:
    """Semantic retrieval over the ingested corpus."""

    def __init__(
        self,
        embedding: EmbeddingProvider,
        repository: QdrantRepository,
        settings: Settings,
    ) -> None:
        self._embedding = embedding
        self._repository = repository
        self._settings = settings

    async def search(
        self,
        query: str,
        top_k: int,
        metadata_filter: dict | None = None,
    ) -> list[ScoredPoint]:
        """Embed ``query`` and return raw scored points (payloads attached)."""
        vectors = await self._embedding.embed_texts([query])
        if not vectors:
            return []
        return await self._repository.search(
            self._settings.qdrant_collection_name,
            query_vector=vectors[0],
            top_k=top_k,
            metadata_filter=metadata_filter,
        )

    async def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        points = await self.search(request.query, request.top_k, request.metadata_filter)
        results = [
            RetrievedChunk(
                chunk_id=(point.payload or {}).get("chunk_id", str(point.id)),
                text=(point.payload or {}).get("text", ""),
                score=point.score,
                metadata=point.payload or {},
            )
            for point in points
        ]
        logger.info("retrieval_complete", query=request.query, result_count=len(results))
        return RetrieveResponse(
            query=request.query,
            collection=self._settings.qdrant_collection_name,
            results=results,
        )
