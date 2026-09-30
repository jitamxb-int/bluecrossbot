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
        *,
        hybrid: bool = True,
    ) -> list[ScoredPoint]:
        """Embed ``query`` and return raw scored points (payloads attached).

        ``hybrid=True`` (default) fuses dense + BM25 via RRF for best recall, but the
        returned ``point.score`` is then a rank-derived RRF score (NOT a cosine
        similarity). Pass ``hybrid=False`` to force the dense-only branch, whose
        ``point.score`` IS a cosine similarity (0..1) — required by callers that
        compare scores against a cosine-calibrated threshold (HCP-consent gate,
        PI/PIL relevance).
        """
        vectors = await self._embedding.embed_texts([query])
        if not vectors:
            return []
        return await self._repository.search(
            self._settings.qdrant_collection_name,
            query_vector=vectors[0],
            top_k=top_k,
            metadata_filter=metadata_filter,
            # query_text enables the BM25 branch; omit it to stay dense-only (cosine).
            query_text=query if hybrid else None,
        )

    async def pdf_product_catalog(self) -> dict[str, dict]:
        """Every product with an ingested PI/PIL document -> ``{"keys", "divisions"}``.

        The Blue Cross product catalog, read with a light payload-only scroll
        (names, keys and divisions only — no text, no vectors, no search).
        """
        rows = await self._repository.scroll_payloads(
            self._settings.qdrant_collection_name,
            ["product_name", "product_key", "division"],
            require_field="pdf_type",
        )
        catalog: dict[str, dict] = {}
        for row in rows:
            name, key = row.get("product_name"), row.get("product_key")
            if isinstance(name, str) and name.strip() and isinstance(key, str) and key:
                entry = catalog.setdefault(name, {"keys": set(), "divisions": set()})
                entry["keys"].add(key)
                if row.get("division"):
                    entry["divisions"].add(row["division"])
        return catalog

    async def pdf_texts_for_products(self, product_keys: list[str]) -> list[str]:
        """Texts of all PI/PIL chunks of the given ``product_key``s (indexed filter)."""
        if not product_keys:
            return []
        rows = await self._repository.scroll_payloads(
            self._settings.qdrant_collection_name, ["text"],
            match_any=("product_key", product_keys),
        )
        return [row.get("text") or "" for row in rows]

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
