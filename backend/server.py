"""FastAPI application factory and lifespan.

``build_app()`` configures logging, wires the lifespan (which constructs the
Qdrant client, repository, embedding provider, and ingestion service once and
stores them on ``app.state``), registers middleware, mounts the API router under
``/api/v1``, and installs uniform exception handlers.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from qdrant_client.http.exceptions import ResponseHandlingException, UnexpectedResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.models.common import ErrorResponse
from src.api.routes import api_router
from src.core.config import Settings, get_settings
from src.core.logging.setup import RequestIDMiddleware, configure_logging, get_logger
from src.core.mongo.client import create_mongo_client, init_session_store
from src.core.vector_db.client import create_qdrant_client
from src.services.chat.service import ChatService
from src.services.feedback.service import FeedbackService
from src.services.chunking.service import ChunkingService
from src.services.embedding.errors import EmbeddingError
from src.services.embedding.openai_provider import OpenAIEmbeddingProvider
from src.services.ingestion.product_service import ProductIngestionService
from src.services.ingestion.service import IngestionService
from src.services.ingestion.video_service import VideoIngestionService
from src.services.llm.errors import LLMError
from src.services.llm.openai_chat import OpenAIChatProvider
from src.services.retrieval.service import RetrievalService
from src.storage.mongo.feedback import FeedbackRepository
from src.storage.mongo.session import SessionRepository
from src.storage.qdrant.repository import QdrantRepository

logger = get_logger(__name__)

API_PREFIX = "/api/v1"
APP_VERSION = "0.1.0"

# Swagger UI only renders a file-upload widget when binary fields use the
# OpenAPI 3.0 representation (``type: string, format: binary``). FastAPI/Pydantic
# v2 emit the 3.1 representation (``contentMediaType``), which the bundled
# Swagger UI shows as a plain text box. We rewrite binary fields back to
# ``format: binary`` and serve the doc as 3.0.3 so file inputs render correctly.
OPENAPI_VERSION = "3.0.3"


def _rewrite_binary_schemas(node: object) -> None:
    """Recursively convert ``contentMediaType`` string fields to ``format: binary``."""
    if isinstance(node, dict):
        if node.get("type") == "string" and "contentMediaType" in node:
            node.pop("contentMediaType", None)
            node.pop("contentEncoding", None)
            node["format"] = "binary"
        for value in node.values():
            _rewrite_binary_schemas(value)
    elif isinstance(node, list):
        for item in node:
            _rewrite_binary_schemas(item)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    logger.info("startup_begin", environment=settings.environment, app=settings.app_name)

    client = create_qdrant_client(settings)
    repository = QdrantRepository(client, settings)
    embedding = OpenAIEmbeddingProvider(settings)
    ingestion_service = IngestionService(
        chunking=ChunkingService(),
        embedding=embedding,
        repository=repository,
        settings=settings,
    )
    product_ingestion_service = ProductIngestionService(
        embedding=embedding,
        repository=repository,
        settings=settings,
    )
    video_ingestion_service = VideoIngestionService(
        embedding=embedding,
        repository=repository,
        settings=settings,
    )
    retrieval_service = RetrievalService(embedding, repository, settings)
    llm = OpenAIChatProvider(settings)

    app.state.qdrant_client = client
    app.state.repository = repository
    app.state.embedding = embedding
    app.state.ingestion_service = ingestion_service
    app.state.product_ingestion_service = product_ingestion_service
    app.state.video_ingestion_service = video_ingestion_service
    app.state.retrieval_service = retrieval_service
    app.state.llm = llm
    app.state.mongo_client = None
    app.state.chat_service = None
    app.state.feedback_service = None
    app.state.chat_unavailable_reason = None

    # Best-effort collection bootstrap; readiness probe reflects actual health.
    try:
        await repository.ensure_collection(settings.qdrant_collection_name)
        logger.info("startup_complete", collection=settings.qdrant_collection_name)
    except Exception as exc:  # noqa: BLE001
        logger.warning("qdrant_unavailable_at_startup", error=str(exc))

    # Best-effort MongoDB init; /chat reports a clear 503 if this never succeeds.
    mongo_client = None
    if settings.mongodb_uri:
        try:
            mongo_client = create_mongo_client(settings)
            await init_session_store(mongo_client, settings)
            app.state.mongo_client = mongo_client
            app.state.chat_service = ChatService(
                retrieval=retrieval_service,
                llm=llm,
                sessions=SessionRepository(),
                settings=settings,
            )
            app.state.feedback_service = FeedbackService(FeedbackRepository())
            logger.info("mongo_session_store_ready", database=settings.mongodb_db)
        except Exception as exc:  # noqa: BLE001
            logger.exception("mongo_init_failed", error=str(exc))
            app.state.chat_unavailable_reason = f"{type(exc).__name__}: {exc}"
    else:
        logger.warning("mongodb_uri_not_configured", detail="chat persistence disabled")
        app.state.chat_unavailable_reason = "MongoDB is not configured (set MONGODB_URI)."

    try:
        yield
    finally:
        await client.close()
        await embedding.aclose()
        await llm.aclose()
        if mongo_client is not None:
            await mongo_client.close()
        logger.info("shutdown_complete")


def build_app() -> FastAPI:
    settings = get_settings()
    configure_logging(level=settings.log_level, json_logs=settings.log_json)

    app = FastAPI(
        title=settings.app_name,
        version=APP_VERSION,
        description="Production-ready RAG platform backend — document ingestion pipeline.",
        lifespan=lifespan,
    )
    app.state.settings = settings

    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=API_PREFIX)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(detail=str(exc.detail), error_type="HTTPException").model_dump(),
        )

    @app.exception_handler(EmbeddingError)
    async def embedding_error_handler(request: Request, exc: EmbeddingError) -> JSONResponse:
        logger.error("embedding_error", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorResponse(detail=str(exc), error_type="EmbeddingError").model_dump(),
        )

    @app.exception_handler(LLMError)
    async def llm_error_handler(request: Request, exc: LLMError) -> JSONResponse:
        logger.error("llm_error", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorResponse(detail=str(exc), error_type="LLMError").model_dump(),
        )

    @app.exception_handler(ResponseHandlingException)
    async def qdrant_timeout_handler(
        request: Request, exc: ResponseHandlingException
    ) -> JSONResponse:
        # Connectivity/timeout talking to Qdrant (e.g. slow Cloud upsert).
        logger.error("qdrant_unavailable", error=repr(exc))
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content=ErrorResponse(
                detail=(
                    "Vector store request failed or timed out. Check Qdrant connectivity "
                    "or raise QDRANT_TIMEOUT."
                ),
                error_type="QdrantUnavailable",
            ).model_dump(),
        )

    @app.exception_handler(UnexpectedResponse)
    async def qdrant_unexpected_handler(request: Request, exc: UnexpectedResponse) -> JSONResponse:
        logger.error("qdrant_unexpected_response", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content=ErrorResponse(
                detail=f"Vector store returned an error: {exc}",
                error_type="QdrantUnexpectedResponse",
            ).model_dump(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        content = ErrorResponse(
            detail="Request validation failed.", error_type="RequestValidationError"
        ).model_dump()
        content["errors"] = jsonable_encoder(exc.errors())
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=content)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=ErrorResponse(
                detail="Internal server error.", error_type=type(exc).__name__
            ).model_dump(),
        )

    def custom_openapi() -> dict:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=OPENAPI_VERSION,
            description=app.description,
            routes=app.routes,
        )
        _rewrite_binary_schemas(schema)
        app.openapi_schema = schema
        return schema

    app.openapi = custom_openapi

    return app


app = build_app()
