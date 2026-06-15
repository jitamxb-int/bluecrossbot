"""Text chunking via LangChain's ``RecursiveCharacterTextSplitter``.

The splitter is created per call so the user-supplied ``chunk_size`` and
``chunk_overlap`` are honored dynamically on every ingestion request.
"""

from __future__ import annotations

from langchain_text_splitters import RecursiveCharacterTextSplitter

# Split preferring semantic boundaries (paragraphs -> lines -> words -> chars).
_DEFAULT_SEPARATORS = ["\n\n", "\n", " ", ""]


class ChunkingService:
    """Character-based recursive chunking."""

    def split(self, text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
        """Split ``text`` into overlapping chunks.

        Returns an empty list for blank input. Whitespace-only chunks are dropped.
        """
        if not text or not text.strip():
            return []

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=_DEFAULT_SEPARATORS,
            length_function=len,
            keep_separator=True,
        )
        return [chunk for chunk in splitter.split_text(text) if chunk.strip()]
