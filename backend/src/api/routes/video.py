"""Structured video ingestion route.

``POST /ingest/video`` accepts one or more **attached** ``.txt`` files (multipart
upload) containing structured video JSON. Each video record is stored as a single
vector point (no chunking). ``chunk_size`` / ``chunk_overlap`` are accepted for
API compatibility but ignored. Delegates to :class:`VideoIngestionService`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.api.dependencies import get_video_ingestion_service
from src.api.models.common import ErrorResponse
from src.api.models.video import VideoIngestResponse
from src.services.ingestion.service import UploadedDocument
from src.services.ingestion.video_service import VideoIngestionService
from src.utils.text import decode_bytes

router = APIRouter(tags=["Ingestion - Video"])

_ALLOWED_SUFFIX = ".txt"


@router.post(
    "/ingest/video",
    response_model=VideoIngestResponse,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}},
    summary="Ingest structured video data (one vector per video).",
    description=(
        "Uploads one or more text files containing structured video JSON data.\n\n"
        "Each video record is stored as a single vector point.\n\n"
        "Chunk size and overlap parameters are accepted for API compatibility but "
        "are ignored because video records are never split into multiple chunks.\n\n"
        "Metadata such as video URLs and thumbnail URLs are preserved in Qdrant "
        "payload fields and are not included in the embedded text."
    ),
)
async def ingest_videos(
    files: list[UploadFile] = File(..., description="One or more attached .txt files."),
    # Accepted for API compatibility with /ingest/descriptive — intentionally ignored.
    chunk_size: int | None = Form(
        default=None, description="Ignored — video records are never chunked."
    ),
    chunk_overlap: int | None = Form(
        default=None, description="Ignored — video records are never chunked."
    ),
    service: VideoIngestionService = Depends(get_video_ingestion_service),
) -> VideoIngestResponse:
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided.")

    return await service.ingest_videos(documents)
