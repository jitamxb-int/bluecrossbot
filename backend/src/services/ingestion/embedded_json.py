"""Shared extractor for the embedded category objects in scraped ``.txt`` files.

Both product and video files are scraped page text (``URL``/``Title``/``Scraped``
header, a markdown list, separators) that embed one or more category objects,
followed by malformed trailing junk and a links section::

    "Analgesics": {
      "page_url": "https://...",
      "values": [ { ... }, ... ]
    },=
    ================================================================================
    [LINKS FOUND ON PAGE] ...

``json.loads(whole_file)`` fails on this. :func:`extract_category_objects` locates
each embedded object via brace-matching (string/escape aware), tolerating the
surrounding text and the variable trailing characters (``},=``, ``},``, ``}``).
"""

from __future__ import annotations

import json


def _match_object(text: str, open_index: int) -> int:
    """Return the index just past the ``}`` matching the ``{`` at ``open_index``.

    String- and escape-aware so braces inside string values are ignored.
    """
    depth = 0
    in_string = False
    escaped = False
    for i in range(open_index, len(text)):
        ch = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    raise ValueError("Unexpected structure: unbalanced braces in embedded object.")


def extract_category_objects(content: str) -> list[dict]:
    """Extract every embedded ``{ "page_url": ..., "values": [...] }`` object.

    Raises ``ValueError`` (``"Invalid JSON format"`` / ``"Unexpected structure"``)
    when nothing parseable is present, so callers can skip the file.
    """
    objects: list[dict] = []
    search_from = 0
    while True:
        marker = content.find('"page_url"', search_from)
        if marker == -1:
            break
        open_index = content.rfind("{", 0, marker)
        if open_index == -1:
            raise ValueError("Unexpected structure: no '{' before 'page_url'.")
        end_index = _match_object(content, open_index)
        block = content[open_index:end_index]
        try:
            objects.append(json.loads(block))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON format: {exc}") from exc
        search_from = end_index
    if not objects:
        raise ValueError("Invalid JSON format: no structured data found in file.")
    return objects
