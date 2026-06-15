"""Metadata extraction for ingested documents.

Each document begins with a source URL line, e.g.::

    URL      : https://www.bluecrosslabs.com/#

``extract_source_url`` pulls that URL out and returns the remaining body with
the URL line removed, so it is not embedded as content.
"""

from __future__ import annotations

import re

# Match a single line like "URL : <url>" (case-insensitive, flexible spacing).
_URL_LINE = re.compile(r"^\s*URL\s*:\s*(\S+)\s*$", re.IGNORECASE)


def extract_source_url(text: str) -> tuple[str | None, str]:
    """Return ``(source_url, body)``.

    The first matching ``URL:`` line is removed from the body. If no URL line is
    present, ``source_url`` is ``None`` and the body is returned unchanged.
    """
    url: str | None = None
    body_lines: list[str] = []

    for line in text.splitlines():
        if url is None:
            match = _URL_LINE.match(line)
            if match:
                url = match.group(1)
                continue  # drop the URL line from the body
        body_lines.append(line)

    body = "\n".join(body_lines).lstrip("\n")
    return url, body
