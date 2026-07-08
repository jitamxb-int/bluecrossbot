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
    FilterSelector,
    Fusion,
    FusionQuery,
    MatchAny,
    MatchValue,
    Modifier,
    PayloadSchemaType,
    PointStruct,
    Prefetch,
    ScoredPoint,
    SparseVector,
    SparseVectorParams,
    VectorParams,
)

from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.embedding.sparse_provider import SparseEmbeddingProvider

logger = get_logger(__name__)

# Named vectors: dense (OpenAI embedding) + bm25 (sparse, for keyword recall).
_DENSE = "dense"
_SPARSE = "bm25"

_DISTANCE_MAP: dict[str, Distance] = {
    "cosine": Distance.COSINE,
    "dot": Distance.DOT,
    "euclid": Distance.EUCLID,
}

# Provenance fields indexed as keywords to enable metadata filtering on retrieval.
# ``doc_type`` lets retrieval filter between 'descriptive' and 'product' records;
# ``pdf_type`` / ``product_key`` / ``division`` enable scoped PI vs PIL retrieval.
_INDEXED_PAYLOAD_FIELDS = (
    "source_url",
    "document_id",
    "document_name",
    "doc_type",
    "pdf_type",
    "product_key",
    "division",
)


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
    def __init__(
        self,
        client: AsyncQdrantClient,
        settings: Settings,
        sparse: SparseEmbeddingProvider | None = None,
    ) -> None:
        self._client = client
        self._settings = settings
        # When set, ingestion stores a BM25 sparse vector and retrieval goes hybrid.
        self._sparse = sparse

    async def ensure_collection(
        self,
        name: str,
        vector_size: int | None = None,
        distance: str | None = None,
    ) -> None:
        """Create the collection (and payload indexes) if it does not exist.

        If the collection already exists, still (idempotently) ensure the payload
        indexes are present — collections created before new indexed fields were
        added would otherwise miss them (e.g. product_key / pdf_type for scoped
        PI/PIL retrieval).
        """
        if await self._client.collection_exists(name):
            await self._ensure_payload_indexes(name)
            return
        await self.create_collection(name, vector_size, distance)

    async def _ensure_payload_indexes(self, name: str) -> None:
        """Create each indexed payload field; re-creating an existing index is a no-op."""
        for field in _INDEXED_PAYLOAD_FIELDS:
            try:
                await self._client.create_payload_index(
                    collection_name=name,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception as exc:  # noqa: BLE001 - index may already exist
                logger.debug("payload_index_exists_or_failed", field=field, error=str(exc))

    async def create_collection(
        self,
        name: str,
        vector_size: int | None = None,
        distance: str | None = None,
    ) -> None:
        size = vector_size or self._settings.vector_size
        metric = _resolve_distance(distance or self._settings.vector_distance)

        # Named dense vector + a BM25 sparse vector (IDF applied at query time) so
        # dense and keyword signals can be fused with RRF at search time.
        await self._client.create_collection(
            collection_name=name,
            vectors_config={_DENSE: VectorParams(size=size, distance=metric)},
            sparse_vectors_config={_SPARSE: SparseVectorParams(modifier=Modifier.IDF)},
        )
        await self._ensure_payload_indexes(name)
        logger.info("collection_created", collection=name, vector_size=size, distance=metric.value)

    async def upsert_points(self, name: str, points: list[PointStruct]) -> int:
        """Upsert points in configurable batches. Returns the number upserted.

        Callers pass dense-only ``PointStruct``s (``vector`` = the dense embedding,
        ``payload['text']`` = the chunk text). This remaps them to the named-vector
        schema and — when a sparse provider is configured — attaches a BM25 sparse
        vector computed from the chunk text, enabling hybrid retrieval. No caller
        changes required.
        """
        points = self._to_named_vector_points(points)
        batch_size = max(1, self._settings.upsert_batch_size)
        for start in range(0, len(points), batch_size):
            batch = points[start : start + batch_size]
            await self._client.upsert(collection_name=name, points=batch, wait=True)
            logger.debug("upserted_batch", collection=name, count=len(batch), offset=start)
        return len(points)

    def _to_named_vector_points(self, points: list[PointStruct]) -> list[PointStruct]:
        """Convert dense-only points to named-vector points (+ BM25 sparse if enabled)."""
        if self._sparse is None:
            return [
                PointStruct(id=p.id, vector={_DENSE: p.vector}, payload=p.payload)
                for p in points
            ]
        texts = [(p.payload or {}).get("text", "") for p in points]
        sparse_vectors = self._sparse.embed_documents(texts)
        rebuilt: list[PointStruct] = []
        for point, (indices, values) in zip(points, sparse_vectors, strict=True):
            rebuilt.append(
                PointStruct(
                    id=point.id,
                    vector={
                        _DENSE: point.vector,
                        _SPARSE: SparseVector(indices=indices, values=values),
                    },
                    payload=point.payload,
                )
            )
        return rebuilt

    async def delete_points_by_field(self, name: str, field: str, values: list[str]) -> int:
        """Delete all points whose ``field`` matches any of ``values``. Returns count deleted.

        ``field`` is one of the indexed keyword fields (e.g. ``document_id`` /
        ``document_name``), so ``MatchAny`` filtering is efficient. Safe/idempotent: returns 0
        when nothing matches or the collection does not exist.
        """
        if not values or not await self._client.collection_exists(name):
            return 0
        flt = Filter(must=[FieldCondition(key=field, match=MatchAny(any=list(values)))])
        count = await self._client.count(collection_name=name, count_filter=flt, exact=True)
        deleted = count.count
        await self._client.delete(collection_name=name, points_selector=FilterSelector(filter=flt))
        logger.info(
            "points_deleted_by_field",
            collection=name,
            field=field,
            values=len(set(values)),
            deleted=deleted,
        )
        return deleted

    async def clear_collection(self, name: str) -> int:
        """Delete ALL points by recreating the collection (preserves config + payload indexes).

        Returns the number of points that existed beforehand. Returns 0 if the collection does
        not exist.
        """
        if not await self._client.collection_exists(name):
            return 0
        existing = (await self._client.count(collection_name=name, exact=True)).count
        await self._client.delete_collection(collection_name=name)
        await self.create_collection(name)  # re-adds VectorParams + KEYWORD indexes
        logger.info("collection_cleared", collection=name, deleted=existing)
        return existing

    async def search(
        self,
        name: str,
        query_vector: list[float],
        top_k: int = 5,
        metadata_filter: dict[str, Any] | None = None,
        query_text: str | None = None,
    ) -> list[ScoredPoint]:
        """Top-k search, optionally filtered by payload metadata.

        When a sparse provider is configured and ``query_text`` is given, runs a
        **hybrid** search — dense + BM25 sparse candidate pools fused with RRF — so
        exact name/title matches surface even when dense ranks them low. Otherwise
        falls back to dense-only. ``metadata_filter`` is a flat ``{field: value}``
        equality dict (e.g. ``{"doc_type": "product"}``). Returns scored points with
        payloads attached.
        """
        flt = _build_filter(metadata_filter)

        if self._sparse is not None and query_text:
            indices, values = self._sparse.embed_query(query_text)
            pool = max(top_k, self._settings.hybrid_prefetch_limit)
            response = await self._client.query_points(
                collection_name=name,
                prefetch=[
                    Prefetch(query=query_vector, using=_DENSE, limit=pool, filter=flt),
                    Prefetch(
                        query=SparseVector(indices=indices, values=values),
                        using=_SPARSE,
                        limit=pool,
                        filter=flt,
                    ),
                ],
                query=FusionQuery(fusion=Fusion.RRF),
                limit=top_k,
                with_payload=True,
            )
            return response.points

        response = await self._client.query_points(
            collection_name=name,
            query=query_vector,
            using=_DENSE,
            limit=top_k,
            query_filter=flt,
            with_payload=True,
        )
        return response.points
