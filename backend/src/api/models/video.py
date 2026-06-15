"""Models for the structured video ingestion API (``POST /ingest/video``)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from src.api.models.ingestion import SkippedFile


class VideoIngestResponse(BaseModel):
    """Response returned by ``POST /ingest/video``."""

    status: str = Field(default="success")
    endpoint: str = Field(default="video")
    files_processed: int = Field(..., ge=0, description="Files successfully parsed and ingested.")
    total_videos_ingested: int = Field(
        ..., ge=0, description="Total video vectors written to Qdrant."
    )
    collection: str = Field(..., description="Qdrant collection the vectors were written to.")
    timestamp: datetime = Field(..., description="UTC time the batch was ingested.")
    files_skipped: int = Field(default=0, ge=0)
    skipped_files: list[SkippedFile] = Field(default_factory=list)
