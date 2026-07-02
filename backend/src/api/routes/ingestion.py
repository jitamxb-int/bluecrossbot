"""Descriptive document ingestion route.

``POST /ingest/descriptive`` accepts one or more **attached** ``.txt`` files
(multipart file upload) containing scraped website / document content. The
chunking parameters are *optional* form fields — when omitted, the configured
defaults (``DEFAULT_CHUNK_SIZE`` / ``DEFAULT_CHUNK_OVERLAP``) are used, so a
client can simply attach the file(s). Each chunk is stored with
``doc_type='descriptive'``. Delegates to :class:`IngestionService`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.api.dependencies import get_ingestion_service, get_pi_pil_ingestion_service
from src.api.models.common import ErrorResponse
from src.api.models.ingestion import IngestResponse, PdfIngestResponse
from src.core.config import Settings, get_settings
from src.services.ingestion.pi_pil_service import PiPilIngestionService
from src.services.ingestion.service import IngestionService, UploadedDocument
from src.utils.text import decode_bytes

router = APIRouter(tags=["Ingestion"])

_ALLOWED_SUFFIX = ".txt"


@router.post(
    "/ingest/descriptive",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    summary="Ingest descriptive website content with configurable chunking.",
    description=(
        "Uploads one or more text files containing website or document content.\n"
        "Content is split into chunks using the supplied chunk size and overlap "
        "values, embedded, and stored in Qdrant with doc_type='descriptive'."
    ),
)
async def ingest_documents(
    files: list[UploadFile] = File(..., description="One or more attached .txt files."),
    chunk_size: int | None = Form(
        default=None, gt=0, description="Characters per chunk (defaults to DEFAULT_CHUNK_SIZE)."
    ),
    chunk_overlap: int | None = Form(
        default=None, ge=0, description="Chunk overlap (defaults to DEFAULT_CHUNK_OVERLAP)."
    ),
    service: IngestionService = Depends(get_ingestion_service),
    settings: Settings = Depends(get_settings),
) -> IngestResponse:
    resolved_chunk_size = chunk_size if chunk_size is not None else settings.default_chunk_size
    resolved_chunk_overlap = (
        chunk_overlap if chunk_overlap is not None else settings.default_chunk_overlap
    )

    if resolved_chunk_overlap >= resolved_chunk_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="chunk_overlap must be smaller than chunk_size.",
        )

    documents: list[UploadedDocument] = []
    for upload in files:
        filename = upload.filename or "untitled.txt"
        if not filename.lower().endswith(_ALLOWED_SUFFIX):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file '{filename}'. Only {_ALLOWED_SUFFIX} files are accepted.",
            )
        raw = await upload.read()
        documents.append(UploadedDocument(filename=filename, content=decode_bytes(raw)))

    if not documents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided.")

    return await service.ingest(
        documents=documents,
        chunk_size=resolved_chunk_size,
        chunk_overlap=resolved_chunk_overlap,
    )


async def _read_txt_uploads(uploads: list[UploadFile]) -> list[UploadedDocument]:
    documents: list[UploadedDocument] = []
    for upload in uploads:
        filename = upload.filename or "untitled.txt"
        if not filename.lower().endswith(_ALLOWED_SUFFIX):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file '{filename}'. Only {_ALLOWED_SUFFIX} files are accepted.",
            )
        raw = await upload.read()
        documents.append(UploadedDocument(filename=filename, content=decode_bytes(raw)))
    return documents


@router.post(
    "/ingest/pdf",
    response_model=PdfIngestResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
    },
    summary="Ingest Prescribing Information (PI) and Patient Information Leaflet (PIL) documents.",
    description=(
        "Uploads PI and PIL `.txt` files (extracted from PDFs) as separate fields, "
        "plus the product `division`. Matching PI and PIL files are automatically "
        "linked by a normalized product name derived from the filename. Each chunk "
        "is stored with doc_type='descriptive' and source_url='pdf' (so HCP-consent "
        "gating and 'pdf' citations apply), plus pdf_type/product_name/product_key/"
        "division/linked_document_id metadata. At retrieval time the linked PI is "
        "searched first, falling back to the PIL when the PI is not relevant enough."
    ),
)
async def ingest_pdf_documents(
    pi_files: list[UploadFile] | None = File(
        default=None, description="Prescribing Information (PI) .txt files."
    ),
    pil_files: list[UploadFile] | None = File(
        default=None, description="Patient Information Leaflet (PIL) .txt files."
    ),
    division: str = Form(..., description="Division for all products in this upload."),
    chunk_size: int | None = Form(
        default=None, gt=0, description="Characters per chunk (defaults to DEFAULT_CHUNK_SIZE)."
    ),
    chunk_overlap: int | None = Form(
        default=None, ge=0, description="Chunk overlap (defaults to DEFAULT_CHUNK_OVERLAP)."
    ),
    service: PiPilIngestionService = Depends(get_pi_pil_ingestion_service),
    settings: Settings = Depends(get_settings),
) -> PdfIngestResponse:
    resolved_chunk_size = chunk_size if chunk_size is not None else settings.default_chunk_size
    resolved_chunk_overlap = (
        chunk_overlap if chunk_overlap is not None else settings.default_chunk_overlap
    )
    if resolved_chunk_overlap >= resolved_chunk_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="chunk_overlap must be smaller than chunk_size.",
        )
    if not division.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="division is required.")

    pi_docs = await _read_txt_uploads(pi_files or [])
    pil_docs = await _read_txt_uploads(pil_files or [])
    if not pi_docs and not pil_docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one PI or PIL file.",
        )

    return await service.ingest(
        pi_documents=pi_docs,
        pil_documents=pil_docs,
        division=division.strip(),
        chunk_size=resolved_chunk_size,
        chunk_overlap=resolved_chunk_overlap,
    )
