"""Vector-store administration: delete points by document, or clear the whole collection.

Thin orchestration over :class:`QdrantRepository` — injects the fixed collection name so routes
stay agnostic of configuration.
"""

from __future__ import annotations

from src.api.models.vectors import (
    DeleteAllResponse,
    DeleteByDocumentResponse,
    DocumentField,
)
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.storage.qdrant.repository import QdrantRepository

logger = get_logger(__name__)


class VectorAdminService:
    def __init__(self, repository: QdrantRepository, settings: Settings) -> None:
        self._repo = repository
        self._collection = settings.qdrant_collection_name

    async def delete_by_document(
        self, field: DocumentField, values: list[str]
    ) -> DeleteByDocumentResponse:
        deleted = await self._repo.delete_points_by_field(self._collection, field.value, values)
        return DeleteByDocumentResponse(
            collection=self._collection,
            field=field,
            requested=len(set(values)),
            deleted=deleted,
        )

    async def delete_all(self) -> DeleteAllResponse:
        deleted = await self._repo.clear_collection(self._collection)
        return DeleteAllResponse(collection=self._collection, deleted=deleted)
