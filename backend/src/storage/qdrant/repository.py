"""Qdrant vector-store repository.

Encapsulates all Qdrant access: collection lifecycle, batched upserts, and
(future) semantic search. Payload indexes are created on the provenance fields
so future retrieval can filter efficiently by ``source_url`` / ``document_id`` /
``document_name``.
"""

from __future__ import annotations

from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    ScoredPoint,
    VectorParams,
)

from src.core.config import Settings
from src.core.logging.setup import get_logger

logger = get_logger(__name__)

_DISTANCE_MAP: dict[str, Distance] = {
    "cosine": Distance.COSINE,
    "dot": Distance.DOT,
    "euclid": Distance.EUCLID,
}

# Provenance fields indexed as keywords to enable metadata filtering on retrieval.
# ``doc_type`` lets retrieval filter between 'descriptive' and 'product' records.
_INDEXED_PAYLOAD_FIELDS = ("source_url", "document_id", "document_name", "doc_type")


def _resolve_distance(distance: str) -> Distance:
    return _DISTANCE_MAP.get(distance.lower(), Distance.COSINE)


def _build_filter(metadata_filter: dict[str, Any] | None) -> Filter | None:
    """Build a Qdrant equality ``Filter`` from a flat ``{field: value}`` dict."""
    if not metadata_filter:
        return None
    conditions = [
        FieldCondition(key=field, match=MatchValue(value=value))
        for field, value in metadata_filter.items()
        if value is not None
    ]
    return Filter(must=conditions) if conditions else None


class QdrantRepository:
    def __init__(self, client: AsyncQdrantClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    async def ensure_collection(
        self,
        name: str,
        vector_size: int | None = None,
        distance: str | None = None,
    ) -> None:
        """Create the collection (and payload indexes) if it does not exist."""
        if await self._client.collection_exists(name):
            return
        await self.create_collection(name, vector_size, distance)

    async def create_collection(
        self,
        name: str,
        vector_size: int | None = None,
        distance: str | None = None,
    ) -> None:
        size = vector_size or self._settings.vector_size
        metric = _resolve_distance(distance or self._settings.vector_distance)

        await self._client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=size, distance=metric),
        )
        for field in _INDEXED_PAYLOAD_FIELDS:
            await self._client.create_payload_index(
                collection_name=name,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        logger.info("collection_created", collection=name, vector_size=size, distance=metric.value)

    async def upsert_points(self, name: str, points: list[PointStruct]) -> int:
        """Upsert points in configurable batches. Returns the number upserted."""
        batch_size = max(1, self._settings.upsert_batch_size)
        for start in range(0, len(points), batch_size):
            batch = points[start : start + batch_size]
            await self._client.upsert(collection_name=name, points=batch, wait=True)
            logger.debug("upserted_batch", collection=name, count=len(batch), offset=start)
        return len(points)

    async def search(
        self,
        name: str,
        query_vector: list[float],
        top_k: int = 5,
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[ScoredPoint]:
        """Top-k semantic search, optionally filtered by payload metadata.

        ``metadata_filter`` is a flat ``{field: value}`` dict of equality
        constraints (e.g. ``{"doc_type": "product"}``). Returns the scored points
        with their payloads attached.
        """
        response = await self._client.query_points(
            collection_name=name,
            query=query_vector,
            limit=top_k,
            query_filter=_build_filter(metadata_filter),
            with_payload=True,
        )
        return response.points
