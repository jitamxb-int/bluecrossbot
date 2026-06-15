"""Video ingestion: parse -> flatten -> embed -> store, one vector per video.

Mirrors :class:`~src.services.ingestion.product_service.ProductIngestionService`
but for videos (``doc_type="video"``). Videos are never chunked. Files that
cannot be parsed are logged, skipped, and reported; the rest of the batch still
ingests.
"""

from __future__ import annotations

from datetime import UTC, datetime

from qdrant_client.models import PointStruct

from src.api.models.ingestion import SkippedFile
from src.api.models.video import VideoIngestResponse
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.embedding.base import EmbeddingProvider
from src.services.ingestion.service import UploadedDocument
from src.services.ingestion.video_parser import VideoRecord, flatten_video, parse_videos
from src.storage.qdrant.repository import QdrantRepository
from src.utils.ids import md5_document_id, new_point_id

logger = get_logger(__name__)


class VideoIngestionService:
    def __init__(
        self,
        embedding: EmbeddingProvider,
        repository: QdrantRepository,
        settings: Settings,
    ) -> None:
        self._embedding = embedding
        self._repository = repository
        self._settings = settings

    async def ingest_videos(
        self, documents: list[UploadedDocument]
    ) -> VideoIngestResponse:
        collection_name = self._settings.qdrant_collection_name
        await self._repository.ensure_collection(collection_name)

        upload_ts = datetime.now(UTC)
        texts: list[str] = []
        payloads: list[dict] = []
        skipped: list[SkippedFile] = []
        files_processed = 0

        for document in documents:
            try:
                records = parse_videos(document.content)
            except Exception as exc:  # noqa: BLE001 - skip the file, keep the batch going
                logger.error("video_file_skipped", file=document.filename, error=str(exc))
                skipped.append(SkippedFile(file=document.filename, reason=str(exc)))
                continue

            files_processed += 1
            for record in records:
                texts.append(flatten_video(record))
                payloads.append(self._build_payload(document.filename, record, upload_ts))
            logger.info("video_file_parsed", file=document.filename, video_count=len(records))

        total_videos = 0
        if texts:
            vectors = await self._embedding.embed_texts(texts)
            if len(vectors) != len(texts):
                raise RuntimeError(
                    f"Embedding count mismatch: {len(vectors)} vectors for {len(texts)} videos."
                )
            points = [
                PointStruct(id=new_point_id(), vector=vector, payload=payload)
                for payload, vector in zip(payloads, vectors, strict=True)
            ]
            total_videos = await self._repository.upsert_points(collection_name, points)

        logger.info(
            "video_ingestion_complete",
            collection=collection_name,
            files_processed=files_processed,
            total_videos_ingested=total_videos,
            files_skipped=len(skipped),
        )

        return VideoIngestResponse(
            files_processed=files_processed,
            total_videos_ingested=total_videos,
            collection=collection_name,
            timestamp=upload_ts,
            files_skipped=len(skipped),
            skipped_files=skipped,
        )

    @staticmethod
    def _build_payload(
        filename: str, record: VideoRecord, upload_ts: datetime
    ) -> dict:
        document_id = md5_document_id(filename, record.title)
        return {
            "document_id": document_id,
            "document_name": filename,
            "video_name": record.title,
            "video_url": record.video_url,
            "thumbnail_url": record.thumbnail,
            "category": record.category,
            "division": record.division,
            "page_url": record.page_url,
            "chunk_id": f"{document_id}_video_0",
            "chunk_index": 0,
            "upload_timestamp": upload_ts.isoformat(),
            "text": flatten_video(record),
            "doc_type": "video",
        }
