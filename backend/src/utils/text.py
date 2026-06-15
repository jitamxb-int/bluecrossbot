"""Text helpers shared across the ingestion pipeline."""

from __future__ import annotations

from charset_normalizer import from_bytes


def decode_bytes(data: bytes) -> str:
    """Decode uploaded file bytes to text, robust to non-UTF-8 encodings.

    Scraped documents may arrive as UTF-8 (with or without a BOM), Windows-1252,
    Latin-1, etc. We take a fast UTF-8 path (the common case) and fall back to
    charset detection, so characters like em-dashes (—) and curly quotes (’)
    survive instead of being mangled into U+FFFD replacement characters.
    """
    if not data:
        return ""
    if data.startswith(b"\xef\xbb\xbf"):
        return data.decode("utf-8-sig")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        pass
    match = from_bytes(data).best()
    if match is not None:
        return str(match)
    # Latin-1 maps every byte, so this never raises — last-resort fallback.
    return data.decode("latin-1")
