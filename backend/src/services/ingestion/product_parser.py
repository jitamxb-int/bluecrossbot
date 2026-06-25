"""Parsing and flattening for structured product ``.txt`` files.

The product files are **not** clean JSON. Each file is scraped page text
(``URL``/``Title``/``Scraped`` header, a markdown product list, separators)
that embeds a single category object, followed by malformed trailing junk and a
links section::

    "Analgesics": {
      "page_url": "https://...",
      "values": [ { "name", "image", "description", "category", "division" }, ... ]
    },=
    ================================================================================
    [LINKS FOUND ON PAGE] ...

So ``json.loads(whole_file)`` fails. :func:`parse_products` instead locates each
embedded category object via brace-matching (string/escape aware), tolerating
the surrounding text and the variable trailing characters (``},=``, ``},``,
``}``). ``page_url`` lives at the category level and is shared by every product
beneath it; each product additionally carries its own ``category``/``division``.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.services.ingestion.embedded_json import extract_category_objects


@dataclass(slots=True)
class ProductRecord:
    """A single product flattened out of a category object."""

    name: str
    description: str
    category: str
    division: str
    product_type: str
    image: str | None
    page_url: str | None


def parse_products(content: str) -> list[ProductRecord]:
    """Parse all product records out of a single product ``.txt`` file.

    Raises ``ValueError`` (``"Invalid JSON format"`` / ``"Unexpected structure"``)
    if no parseable product data is present so the caller can skip the file.
    """
    records: list[ProductRecord] = []
    for obj in extract_category_objects(content):
        page_url = obj.get("page_url")
        values = obj.get("values")
        if not isinstance(values, list):
            raise ValueError("Unexpected structure: 'values' is missing or not a list.")
        for item in values:
            if not isinstance(item, dict):
                continue
            name = (item.get("name") or "").strip()
            if not name:
                continue  # a product without a name cannot be embedded meaningfully
            records.append(
                ProductRecord(
                    name=name,
                    description=(item.get("description") or "").strip(),
                    category=(item.get("category") or "").strip(),
                    division=(item.get("division") or "").strip(),
                    product_type=(item.get("product_type") or "").strip(),
                    image=item.get("image"),
                    page_url=page_url,
                )
            )
    if not records:
        raise ValueError("Unexpected structure: no products found in file.")
    return records


def flatten_product(record: ProductRecord) -> str:
    """Flatten a product into the natural-language string that gets embedded.

    Format: ``Product: {name}. Type: {product_type}. Category: {category}.
    Division: {division}. {description}`` — the ``Type:`` segment is omitted when
    ``product_type`` is empty.

    Only name / type / category / division / description are included — ``image``
    and ``page_url`` are intentionally excluded (they belong in metadata only).
    """
    parts = [f"Product: {record.name}."]
    if record.product_type:
        parts.append(f"Type: {record.product_type}.")
    parts.append(f"Category: {record.category}.")
    parts.append(f"Division: {record.division}.")
    parts.append(record.description)
    return " ".join(parts)
