"""Models for vector-store administration (deleting points from Qdrant).

Delete by a chosen identifier type — ``document_id`` OR ``document_name`` — passing one or more
values of that type, or delete every point in the collection.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class DocumentField(str, Enum):
    document_id = "document_id"
    document_name = "document_name"


class DeleteByDocumentRequest(BaseModel):
    """Delete points belonging to one or more documents, selected by a single identifier type."""

    field: DocumentField = Field(
        ..., description="Which identifier the values are: document_id | document_name."
    )
    values: list[str] = Field(
        ..., min_length=1, description="One or more ids/names (of the chosen field) to delete."
    )


class DeleteByDocumentResponse(BaseModel):
    collection: str
    field: DocumentField
    requested: int = Field(..., ge=0, description="Distinct identifier values requested.")
    deleted: int = Field(..., ge=0, description="Number of points deleted.")


class DeleteAllResponse(BaseModel):
    collection: str
    deleted: int = Field(..., ge=0, description="Number of points removed.")
