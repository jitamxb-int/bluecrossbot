"""BM25 sparse-embedding provider (fastembed) for hybrid retrieval.

Produces sparse term vectors (indices + weights) for documents and queries. Qdrant
applies IDF at query time via the sparse vector's ``Modifier.IDF`` config, so this
only needs to emit term frequencies. The model is loaded once (cached on disk).
"""

from __future__ import annotations

from fastembed import SparseTextEmbedding

from src.core.logging.setup import get_logger

logger = get_logger(__name__)


class SparseEmbeddingProvider:
    def __init__(self, model_name: str = "Qdrant/bm25") -> None:
        self._model = SparseTextEmbedding(model_name=model_name)
        logger.info("sparse_model_loaded", model=model_name)

    def embed_documents(self, texts: list[str]) -> list[tuple[list[int], list[float]]]:
        """Return (indices, values) per document, in input order."""
        return [
            (emb.indices.tolist(), emb.values.tolist())
            for emb in self._model.embed(texts)
        ]

    def embed_query(self, text: str) -> tuple[list[int], list[float]]:
        """Return (indices, values) for a single query string."""
        emb = next(iter(self._model.query_embed(text)))
        return emb.indices.tolist(), emb.values.tolist()
