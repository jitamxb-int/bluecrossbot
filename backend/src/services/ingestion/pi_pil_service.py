"""PI/PIL ingestion: pair Prescribing Information with Patient Information Leaflets.

Each uploaded ``.txt`` is chunked, embedded, and stored as a ``doc_type='descriptive'``
point with ``source_url='pdf'`` (so existing HCP-consent gating and 'pdf' citations
keep working). The PI/PIL distinction and their linkage live in extra payload
fields (``pdf_type``, ``product_name``, ``product_key``, ``division``,
``linked_document_id``). Matching PI and PIL files are linked by a normalized key
derived from the filename (see :mod:`pi_pil_matching`).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from qdrant_client.models import PointStruct

from src.api.models.ingestion import (
    PdfDocumentResult,
    PdfIngestResponse,
    PdfPair,
    SkippedFile,
)
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.chunking.service import ChunkingService
from src.services.embedding.base import EmbeddingProvider
from src.services.ingestion.pi_pil_matching import clean_product_name, normalize_product_key
from src.services.ingestion.service import UploadedDocument
from src.storage.qdrant.repository import QdrantRepository
from src.utils.ids import build_chunk_id, md5_document_id, new_point_id

logger = get_logger(__name__)


@dataclass(slots=True)
class _Doc:
    """A PI or PIL document resolved to its identity within a product pair."""

    document: UploadedDocument
    pdf_type: str  # "PI" | "PIL"
    document_id: str
    product_key: str


class PiPilIngestionService:
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
        pi_documents: list[UploadedDocument],
        pil_documents: list[UploadedDocument],
        division: str,
        chunk_size: int,
        chunk_overlap: int,
    ) -> PdfIngestResponse:
        collection_name = self._settings.qdrant_collection_name
        await self._repository.ensure_collection(collection_name)
        upload_ts = datetime.now(UTC)

        docs: list[_Doc] = []
        skipped: list[SkippedFile] = []
        for document, pdf_type in [(d, "PI") for d in pi_documents] + [
            (d, "PIL") for d in pil_documents
        ]:
            if not document.content.strip():
                skipped.append(SkippedFile(file=document.filename, reason="Empty file."))
                continue
            docs.append(
                _Doc(
                    document=document,
                    pdf_type=pdf_type,
                    document_id=md5_document_id(document.filename, document.content),
                    product_key=normalize_product_key(document.filename),
                )
            )

        # Group by product_key so a PI can be linked to its PIL (and vice versa).
        by_key: dict[str, dict[str, _Doc]] = {}
        for doc in docs:
            by_key.setdefault(doc.product_key, {})[doc.pdf_type] = doc

        pairs: list[PdfPair] = []
        for key, members in by_key.items():
            pi = members.get("PI")
            pil = members.get("PIL")
            source = pi or pil  # PI is authoritative for the display name when present
            pairs.append(
                PdfPair(
                    product_key=key,
                    product_name=clean_product_name(source.document.filename),
                    pi_document_id=pi.document_id if pi else None,
                    pil_document_id=pil.document_id if pil else None,
                )
            )

        texts: list[str] = []
        payloads: list[dict] = []
        results: list[PdfDocumentResult] = []
        for doc in docs:
            members = by_key[doc.product_key]
            pi = members.get("PI")
            pil = members.get("PIL")
            product_name = clean_product_name((pi or pil).document.filename)
            linked = pil if doc.pdf_type == "PI" else pi
            linked_id = linked.document_id if linked else None

            chunks = self._chunking.split(doc.document.content, chunk_size, chunk_overlap)
            for index, chunk_text in enumerate(chunks):
                texts.append(chunk_text)
                payloads.append(
                    {
                        "document_id": doc.document_id,
                        "document_name": doc.document.filename,
                        "source_url": "pdf",
                        "chunk_id": build_chunk_id(doc.document_id, index),
                        "chunk_index": index,
                        "upload_timestamp": upload_ts.isoformat(),
                        "text": chunk_text,
                        "doc_type": "descriptive",
                        "pdf_type": doc.pdf_type,
                        "product_name": product_name,
                        "product_key": doc.product_key,
                        "division": division,
                        "linked_document_id": linked_id,
                    }
                )
            results.append(
                PdfDocumentResult(
                    document_id=doc.document_id,
                    document_name=doc.document.filename,
                    pdf_type=doc.pdf_type,
                    product_name=product_name,
                    product_key=doc.product_key,
                    division=division,
                    linked_document_id=linked_id,
                    chunk_count=len(chunks),
                )
            )
            logger.info(
                "pi_pil_document_chunked",
                file=doc.document.filename,
                pdf_type=doc.pdf_type,
                product_key=doc.product_key,
                chunk_count=len(chunks),
                linked=bool(linked_id),
            )

        total_chunks = 0
        if texts:
            vectors = await self._embedding.embed_texts(texts)
            if len(vectors) != len(texts):
                raise RuntimeError(
                    f"Embedding count mismatch: {len(vectors)} vectors for {len(texts)} chunks."
                )
            points = [
                PointStruct(id=new_point_id(), vector=vector, payload=payload)
                for payload, vector in zip(payloads, vectors, strict=True)
            ]
            total_chunks = await self._repository.upsert_points(collection_name, points)

        logger.info(
            "pi_pil_ingestion_complete",
            collection=collection_name,
            division=division,
            total_documents=len(results),
            total_chunks=total_chunks,
            pairs=len(pairs),
            files_skipped=len(skipped),
        )

        return PdfIngestResponse(
            collection=collection_name,
            embedding_model=self._embedding.model_name,
            division=division,
            total_documents=len(results),
            total_chunks=total_chunks,
            documents=results,
            pairs=pairs,
            files_skipped=len(skipped),
            skipped_files=skipped,
        )
