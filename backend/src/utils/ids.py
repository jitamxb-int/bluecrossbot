"""Identifier helpers for documents, chunks, and vector points."""

from __future__ import annotations

import hashlib
import uuid


def md5_document_id(*parts: str) -> str:
    """Return a deterministic document id: the MD5 hex of the joined parts.

    Used so re-ingesting the same input yields the same ``document_id`` (e.g.
    ``md5(filename + content)`` for descriptive docs, ``md5(filename +
    product_name)`` for products).
    """
    return hashlib.md5("".join(parts).encode("utf-8")).hexdigest()


def build_chunk_id(document_id: str, index: int) -> str:
    """Return a deterministic chunk id scoped to its document."""
    return f"{document_id}_chunk_{index}"


def build_product_chunk_id(document_id: str) -> str:
    """Return the chunk id for a product point.

    Each product is its own single-chunk document, so the index is always 0.
    """
    return f"{document_id}_product_0"


def new_point_id() -> str:
    """Return a Qdrant-compatible point id (UUID string)."""
    return str(uuid.uuid4())
