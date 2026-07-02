"""Filename normalization for pairing PI and PIL documents.

A Prescribing Information (PI) file and its Patient Information Leaflet (PIL)
counterpart are matched by a normalized key derived from the filename. The
normalization is resilient to ``PIL_``/``PI_`` prefixes, ``-`` vs space, singular
vs plural words, punctuation (``&``), and case, so e.g.::

    "BLUMOX 250 DT & 500 Capsules.txt"      ->  "blumox 250 dt 500 capsule"
    "PIL_BLUMOX-250 DT & 500 Capsule.txt"   ->  "blumox 250 dt 500 capsule"
"""

from __future__ import annotations

import re

# Leading "PI"/"PIL" followed by a separator (``_``, space, or ``-``). Anchored and
# separator-required so genuine names like "Pilex" are left untouched.
_PREFIX = re.compile(r"^\s*pil?[\s_-]+", re.IGNORECASE)
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def _strip_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[0] if "." in filename else filename


def _singularize(token: str) -> str:
    """Drop a single trailing plural ``s`` (e.g. ``capsules`` -> ``capsule``)."""
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def normalize_product_key(filename: str) -> str:
    """Return the canonical matching key for a PI/PIL filename."""
    name = _strip_extension(filename)
    name = _PREFIX.sub("", name)
    name = name.lower()
    name = _NON_ALNUM.sub(" ", name)
    tokens = [_singularize(t) for t in name.split()]
    return " ".join(t for t in tokens if t)


def clean_product_name(filename: str) -> str:
    """Return a human-friendly product name (extension + PI/PIL prefix removed)."""
    name = _strip_extension(filename)
    name = _PREFIX.sub("", name)
    return name.strip()
