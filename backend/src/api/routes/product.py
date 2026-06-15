"""Structured product ingestion route.

``POST /ingest/product`` accepts one or more **attached** ``.txt`` files
(multipart upload) containing structured product JSON. Each product record is
stored as a single vector point (no chunking). ``chunk_size`` / ``chunk_overlap``
are accepted for API compatibility but ignored. Delegates to
:class:`ProductIngestionService`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.api.dependencies import get_product_ingestion_service
from src.api.models.common import ErrorResponse
from src.api.models.product import ProductIngestResponse
from src.services.ingestion.product_service import ProductIngestionService
from src.services.ingestion.service import UploadedDocument
from src.utils.text import decode_bytes

router = APIRouter(tags=["Ingestion - Product/Video"])

_ALLOWED_SUFFIX = ".txt"


@router.post(
    "/ingest/product",
    response_model=ProductIngestResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
    summary="Ingest structured product data.",
    description=(
        "Uploads one or more text files containing structured product JSON data.\n\n"
        "Each product record is stored as a single vector point.\n\n"
        "Chunk size and overlap parameters are accepted for API compatibility but "
        "are ignored because product records are never split into multiple chunks.\n\n"
        "Metadata such as image URLs and page URLs are preserved in Qdrant payload "
        "fields and are not included in the embedded text."
    ),
)
async def ingest_products(
    files: list[UploadFile] = File(..., description="One or more attached .txt files."),
    # Accepted for API compatibility with /ingest/descriptive — intentionally ignored.
    chunk_size: int | None = Form(
        default=None, description="Ignored — product records are never chunked."
    ),
    chunk_overlap: int | None = Form(
        default=None, description="Ignored — product records are never chunked."
    ),
    service: ProductIngestionService = Depends(get_product_ingestion_service),
) -> ProductIngestResponse:
    documents: list[UploadedDocument] = []
    for upload in files:
        filename = upload.filename or "untitled.txt"
        if not filename.lower().endswith(_ALLOWED_SUFFIX):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .txt files are supported.",
            )
        raw = await upload.read()
        documents.append(UploadedDocument(filename=filename, content=decode_bytes(raw)))

    if not documents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided."
        )

    return await service.ingest_products(documents)
