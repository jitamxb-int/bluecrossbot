"""Retrieval route — semantic search over the ingested corpus."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.dependencies import get_retrieval_service
from src.api.models.retrieval import RetrieveRequest, RetrieveResponse
from src.services.retrieval.service import RetrievalService

router = APIRouter(tags=["Retrieval"])


@router.post(
    "/retrieve",
    response_model=RetrieveResponse,
    summary="Semantic retrieval over the ingested corpus.",
    description=(
        "Embeds the query and returns the top-k most similar chunks from Qdrant. "
        "Optionally filter by payload fields (e.g. {'doc_type': 'product'}). Each "
        "result carries its full stored payload, including image/video URLs."
    ),
)
async def retrieve(
    payload: RetrieveRequest,
    service: RetrievalService = Depends(get_retrieval_service),
) -> RetrieveResponse:
    return await service.retrieve(payload)
