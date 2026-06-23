"""Vector-store administration routes.

``DELETE /vectors/by-document`` removes every point belonging to one or more documents, selected by
a single identifier type (``document_id`` OR ``document_name``). ``DELETE /vectors/all`` wipes the
entire collection. Delegates to :class:`VectorAdminService`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.dependencies import get_vector_admin_service
from src.api.models.common import ErrorResponse
from src.api.models.vectors import (
    DeleteAllResponse,
    DeleteByDocumentRequest,
    DeleteByDocumentResponse,
)
from src.services.vectorstore.service import VectorAdminService

router = APIRouter(tags=["Vector Store"])


@router.delete(
    "/vectors/by-document",
    response_model=DeleteByDocumentResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Delete vector points for one or more documents.",
    description=(
        "Deletes all Qdrant points belonging to the given documents, selected by a single "
        "identifier type: either a list of document_ids or a list of document_names."
    ),
)
async def delete_by_document(
    payload: DeleteByDocumentRequest,
    service: VectorAdminService = Depends(get_vector_admin_service),
) -> DeleteByDocumentResponse:
    return await service.delete_by_document(payload.field, payload.values)


@router.delete(
    "/vectors/all",
    response_model=DeleteAllResponse,
    responses={503: {"model": ErrorResponse}},
    summary="Delete all vector points.",
    description="Permanently removes every point from the vector collection.",
)
async def delete_all(
    service: VectorAdminService = Depends(get_vector_admin_service),
) -> DeleteAllResponse:
    return await service.delete_all()
