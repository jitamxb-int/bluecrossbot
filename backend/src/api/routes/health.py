"""Health and readiness probes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from src.api.models.common import HealthResponse, ReadinessResponse
from src.core.config import Settings, get_settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(service=settings.app_name, environment=settings.environment)


@router.get("/ready", response_model=ReadinessResponse, summary="Readiness probe")
async def ready(request: Request, response: Response) -> ReadinessResponse:
    client = request.app.state.qdrant_client
    try:
        await client.get_collections()
        return ReadinessResponse(status="ready", qdrant="ok")
    except Exception as exc:  # noqa: BLE001 - report any failure as 'degraded'
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(status="degraded", qdrant=f"unavailable: {exc}")
