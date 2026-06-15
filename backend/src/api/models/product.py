"""Models for the structured product ingestion API (``POST /ingest/product``)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from src.api.models.ingestion import SkippedFile


class ProductIngestResponse(BaseModel):
    """Response returned by ``POST /ingest/product``."""

    status: str = Field(default="success")
    endpoint: str = Field(default="product")
    files_processed: int = Field(..., ge=0, description="Files successfully parsed and ingested.")
    total_products_ingested: int = Field(
        ..., ge=0, description="Total product vectors written to Qdrant."
    )
    collection: str = Field(..., description="Qdrant collection the vectors were written to.")
    timestamp: datetime = Field(..., description="UTC time the batch was ingested.")
    files_skipped: int = Field(default=0, ge=0)
    skipped_files: list[SkippedFile] = Field(default_factory=list)
