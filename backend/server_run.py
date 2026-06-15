"""Uvicorn entrypoint.

Reads host/port/reload from settings. ``log_config=None`` and ``access_log=False``
hand logging entirely to structlog (configured in ``build_app``).
"""

from __future__ import annotations

import uvicorn

from src.core.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=settings.is_dev,
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
