"""Models for the retrieval API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RetrieveRequest(BaseModel):
    """Semantic search request."""

    query: str = Field(..., description="Natural-language query to embed and search.")
    top_k: int = Field(default=5, ge=1, le=100, description="Number of results to return.")
    metadata_filter: dict[str, Any] | None = Field(
        default=None,
        description="Payload equality filters, e.g. {'doc_type': 'product'}.",
    )
    # TODO: hybrid (dense + sparse) search support.
    hybrid: bool = Field(default=False, description="Enable hybrid dense+sparse search (TODO).")


class RetrievedChunk(BaseModel):
    """A single scored result. ``metadata`` is the full stored Qdrant payload.

    Kept as a plain dict (not a fixed model) so it is lossless across content
    types — descriptive chunks, products (``image_url``/``page_url``) and videos
    (``video_url``) all round-trip without dropping fields.
    """

    chunk_id: str
    text: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrieveResponse(BaseModel):
    """Semantic search response."""

    query: str
    collection: str
    results: list[RetrievedChunk] = Field(default_factory=list)
