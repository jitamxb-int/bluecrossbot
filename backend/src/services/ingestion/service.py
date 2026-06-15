"""Ingestion orchestration: parse -> chunk -> embed -> store.

The service is intentionally decoupled from FastAPI: routes convert ``UploadFile``
objects into :class:`UploadedDocument` instances, which keeps the pipeline easy
to unit-test with in-memory inputs and mocked dependencies.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from qdrant_client.models import PointStruct

from src.api.models.ingestion import (
    ChunkMetadata,
    DocumentIngestResult,
    IngestResponse,
    SkippedFile,
)
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.chunking.service import ChunkingService
from src.services.embedding.base import EmbeddingProvider
from src.services.ingestion.metadata import extract_source_url
from src.storage.qdrant.repository import QdrantRepository
from src.utils.ids import build_chunk_id, md5_document_id, new_point_id

logger = get_logger(__name__)


@dataclass(slots=True)
class UploadedDocument:
    """A decoded document handed to the ingestion service."""

    filename: str
    content: str


class IngestionService:
    def __init__(
        self,
        chunking: ChunkingService,
        embedding: EmbeddingProvider,
        repository: QdrantRepository,
        settings: Settings,
    ) -> None:
        self._chunking = chunking
        self._embedding = embedding
        self._repository = repository
        self._settings = settings

    async def ingest(
        self,
        documents: list[UploadedDocument],
        chunk_size: int,
        chunk_overlap: int,
        doc_type: str = "descriptive",
    ) -> IngestResponse:
        # The collection is fixed for this project (configured, not per-request).
        collection_name = self._settings.qdrant_collection_name
        await self._repository.ensure_collection(collection_name)

        # One timestamp for the whole batch keeps provenance consistent.
        upload_ts = datetime.now(UTC)

        texts: list[str] = []
        metadatas: list[ChunkMetadata] = []
        doc_results: list[DocumentIngestResult] = []
        skipped: list[SkippedFile] = []

        for document in documents:
            # A failure on one document must not abort the whole batch.
            try:
                source_url, body = extract_source_url(document.content)
                # Deterministic id so re-ingesting the same file is idempotent.
                document_id = md5_document_id(document.filename, document.content)
                chunks = self._chunking.split(body, chunk_size, chunk_overlap)

                for index, chunk_text in enumerate(chunks):
                    metadatas.append(
                        ChunkMetadata(
                            document_id=document_id,
                            document_name=document.filename,
                            source_url=source_url,
                            chunk_id=build_chunk_id(document_id, index),
                            chunk_index=index,
                            upload_timestamp=upload_ts,
                            doc_type=doc_type,
                        )
                    )
                    texts.append(chunk_text)

                doc_results.append(
                    DocumentIngestResult(
                        document_id=document_id,
                        document_name=document.filename,
                        source_url=source_url,
                        chunk_count=len(chunks),
                    )
                )
                logger.info(
                    "document_chunked",
                    document_id=document_id,
                    document_name=document.filename,
                    source_url=source_url,
                    chunk_count=len(chunks),
                )
            except Exception as exc:  # noqa: BLE001 - skip the file, keep the batch going
                logger.error(
                    "document_skipped", document_name=document.filename, error=str(exc)
                )
                skipped.append(SkippedFile(file=document.filename, reason=str(exc)))

        total_chunks = 0
        if texts:
            vectors = await self._embedding.embed_texts(texts)
            if len(vectors) != len(texts):
                raise RuntimeError(
                    f"Embedding count mismatch: {len(vectors)} vectors for {len(texts)} chunks."
                )

            points: list[PointStruct] = []
            for chunk_text, metadata, vector in zip(texts, metadatas, vectors, strict=True):
                payload = metadata.model_dump(mode="json")
                payload["text"] = chunk_text
                points.append(PointStruct(id=new_point_id(), vector=vector, payload=payload))

            total_chunks = await self._repository.upsert_points(collection_name, points)

        logger.info(
            "ingestion_complete",
            collection=collection_name,
            total_documents=len(doc_results),
            total_chunks=total_chunks,
            files_skipped=len(skipped),
        )

        return IngestResponse(
            collection=collection_name,
            embedding_model=self._embedding.model_name,
            total_documents=len(doc_results),
            total_chunks=total_chunks,
            documents=doc_results,
            files_skipped=len(skipped),
            skipped_files=skipped,
        )
