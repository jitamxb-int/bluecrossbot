"""Parsing and flattening for structured video ``.txt`` files.

Mirrors the product pipeline: the file is scraped page text embedding a category
object with a ``values`` array, parsed via the shared brace-matching extractor.
Each video becomes one vector. ``title`` and ``video_url`` are required; the
``title`` is read from ``name``/``title`` and the URL from
``video_url``/``url``. ``thumbnail``/``description``/``category``/``division`` are
optional. The embedded text never includes the video/thumbnail URLs.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.services.ingestion.embedded_json import extract_category_objects


@dataclass(slots=True)
class VideoRecord:
    """A single video flattened out of a category object."""

    title: str
    video_url: str
    thumbnail: str | None = None
    description: str = ""
    category: str | None = None
    division: str | None = None
    page_url: str | None = None


def parse_videos(content: str) -> list[VideoRecord]:
    """Parse all video records out of a single video ``.txt`` file.

    Raises ``ValueError`` if no parseable video data is present so the caller can
    skip the file.
    """
    records: list[VideoRecord] = []
    for obj in extract_category_objects(content):
        page_url = obj.get("page_url")
        values = obj.get("values")
        if not isinstance(values, list):
            raise ValueError("Unexpected structure: 'values' is missing or not a list.")
        for item in values:
            if not isinstance(item, dict):
                continue
            title = (item.get("name") or item.get("title") or "").strip()
            video_url = (item.get("video_url") or item.get("url") or "").strip()
            if not title or not video_url:
                continue  # title + video_url are required to be useful
            records.append(
                VideoRecord(
                    title=title,
                    video_url=video_url,
                    thumbnail=item.get("thumbnail") or item.get("image"),
                    description=(item.get("description") or "").strip(),
                    category=(item.get("category") or "").strip() or None,
                    division=(item.get("division") or "").strip() or None,
                    page_url=page_url,
                )
            )
    if not records:
        raise ValueError("Unexpected structure: no videos found in file.")
    return records


def flatten_video(record: VideoRecord) -> str:
    """Flatten a video into the natural-language string that gets embedded.

    Format: ``Video: {title}. Category: {category}. {description}`` — optional
    empty parts are omitted. ``video_url``/``thumbnail`` are never embedded.
    """
    parts = [f"Video: {record.title}."]
    if record.category:
        parts.append(f"Category: {record.category}.")
    if record.division:
        parts.append(f"Division: {record.division}.")
    if record.description:
        parts.append(record.description)
    return " ".join(parts)
