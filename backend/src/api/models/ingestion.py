"""Models for the document ingestion API.

``chunk_size`` and ``chunk_overlap`` are not modelled here — they arrive as
multipart *form fields* alongside the uploaded files and are validated in the
route (see ``src/api/routes/ingestion.py``).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ChunkMetadata(BaseModel):
    """Provenance metadata attached to every chunk and persisted in Qdrant.

    This metadata is preserved throughout the entire ingestion → retrieval
    lifecycle so that future retrieval can identify the source document, track
    chunk order, and filter across the corpus.
    """

    document_id: str = Field(..., description="Stable id for the source document.")
    document_name: str = Field(..., description="Original uploaded filename.")
    source_url: str | None = Field(
        default=None, description="URL extracted from the document header, if present."
    )
    chunk_id: str = Field(..., description="Stable id for this chunk within the document.")
    chunk_index: int = Field(..., ge=0, description="0-based position within the document.")
    upload_timestamp: datetime = Field(..., description="UTC time the batch was ingested.")
    doc_type: str = Field(
        default="descriptive",
        description="Content type tag for retrieval filtering ('descriptive' | 'product').",
    )


class IngestedChunk(BaseModel):
    """A single chunk plus its metadata (returned when previewing chunks)."""

    chunk_id: str
    text: str
    metadata: ChunkMetadata


class DocumentIngestResult(BaseModel):
    """Per-document summary of an ingestion run."""

    document_id: str
    document_name: str
    source_url: str | None = None
    chunk_count: int = Field(..., ge=0)


class SkippedFile(BaseModel):
    """A file that could not be processed and was skipped."""

    file: str = Field(..., description="Name of the skipped file.")
    reason: str = Field(..., description="Why the file was skipped.")


class IngestResponse(BaseModel):
    """Response returned by ``POST /ingest/descriptive``."""

    collection: str = Field(..., description="Qdrant collection the vectors were written to.")
    embedding_model: str = Field(..., description="Model used to generate embeddings.")
    total_documents: int = Field(..., ge=0)
    total_chunks: int = Field(..., ge=0)
    documents: list[DocumentIngestResult] = Field(default_factory=list)
    files_skipped: int = Field(default=0, ge=0)
    skipped_files: list[SkippedFile] = Field(default_factory=list)
