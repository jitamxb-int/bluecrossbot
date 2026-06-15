"""Product ingestion: parse -> flatten -> embed -> store, one vector per product.

Unlike :class:`IngestionService`, product records are **never chunked** — each
product becomes exactly one embedding and one Qdrant point. Files that cannot be
parsed are logged, skipped, and reported; the rest of the batch still ingests.
"""

from __future__ import annotations

from datetime import UTC, datetime

from qdrant_client.models import PointStruct

from src.api.models.ingestion import SkippedFile
from src.api.models.product import ProductIngestResponse
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.embedding.base import EmbeddingProvider
from src.services.ingestion.product_parser import (
    ProductRecord,
    flatten_product,
    parse_products,
)
from src.services.ingestion.service import UploadedDocument
from src.storage.qdrant.repository import QdrantRepository
from src.utils.ids import build_product_chunk_id, md5_document_id, new_point_id

logger = get_logger(__name__)


class ProductIngestionService:
    def __init__(
        self,
        embedding: EmbeddingProvider,
        repository: QdrantRepository,
        settings: Settings,
    ) -> None:
        self._embedding = embedding
        self._repository = repository
        self._settings = settings

    async def ingest_products(
        self, documents: list[UploadedDocument]
    ) -> ProductIngestResponse:
        collection_name = self._settings.qdrant_collection_name
        await self._repository.ensure_collection(collection_name)

        # One timestamp for the whole batch keeps provenance consistent.
        upload_ts = datetime.now(UTC)

        texts: list[str] = []
        payloads: list[dict] = []
        skipped: list[SkippedFile] = []
        files_processed = 0

        for document in documents:
            try:
                records = parse_products(document.content)
            except Exception as exc:  # noqa: BLE001 - skip the file, keep the batch going
                logger.error("product_file_skipped", file=document.filename, error=str(exc))
                skipped.append(SkippedFile(file=document.filename, reason=str(exc)))
                continue

            files_processed += 1
            for record in records:
                texts.append(flatten_product(record))
                payloads.append(self._build_payload(document.filename, record, upload_ts))
            logger.info(
                "product_file_parsed",
                file=document.filename,
                product_count=len(records),
            )

        total_products = 0
        if texts:
            vectors = await self._embedding.embed_texts(texts)
            if len(vectors) != len(texts):
                raise RuntimeError(
                    f"Embedding count mismatch: {len(vectors)} vectors for {len(texts)} products."
                )
            points = [
                PointStruct(id=new_point_id(), vector=vector, payload=payload)
                for payload, vector in zip(payloads, vectors, strict=True)
            ]
            total_products = await self._repository.upsert_points(collection_name, points)

        logger.info(
            "product_ingestion_complete",
            collection=collection_name,
            files_processed=files_processed,
            total_products_ingested=total_products,
            files_skipped=len(skipped),
        )

        return ProductIngestResponse(
            files_processed=files_processed,
            total_products_ingested=total_products,
            collection=collection_name,
            timestamp=upload_ts,
            files_skipped=len(skipped),
            skipped_files=skipped,
        )

    @staticmethod
    def _build_payload(
        filename: str, record: ProductRecord, upload_ts: datetime
    ) -> dict:
        # Deterministic id so re-ingesting the same product is idempotent.
        document_id = md5_document_id(filename, record.name)
        return {
            "document_id": document_id,
            "document_name": filename,
            "product_name": record.name,
            "category": record.category,
            "division": record.division,
            "image_url": record.image,
            "page_url": record.page_url,
            "chunk_id": build_product_chunk_id(document_id),
            "chunk_index": 0,
            "upload_timestamp": upload_ts.isoformat(),
            "text": flatten_product(record),
            "doc_type": "product",
        }
