"""Application configuration loaded from environment variables / `.env`.

All settings are environment-driven via ``pydantic-settings``. Field names map
to environment variables case-insensitively (e.g. ``qdrant_url`` <- ``QDRANT_URL``).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Application ---
    app_name: str = "Blue Cross RAG Backend"
    environment: str = "dev"  # dev | prod
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    log_json: bool = True
    cors_allow_origins: str = "*"

    # --- Qdrant ---
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    # Fixed, single collection for this project (not overridable per request).
    qdrant_collection_name: str = "blue_cross_rag_documents"
    qdrant_prefer_grpc: bool = False
    upsert_batch_size: int = 128
    # REST/httpx timeout (seconds). qdrant-client otherwise leaves httpx at its
    # 5s default, which is too low for remote `upsert(wait=True)` to Qdrant Cloud.
    qdrant_timeout: int = 60

    # --- Vectors ---
    vector_size: int = 1536
    vector_distance: str = "Cosine"  # Cosine | Dot | Euclid

    # --- OpenAI embeddings ---
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_base_url: str | None = None
    openai_embedding_batch_size: int = 100

    # --- OpenAI chat / generation ---
    openai_chat_model: str = "gpt-4o-mini"

    # --- MongoDB (chat session storage) ---
    mongodb_uri: str | None = (
        "mongodb+srv://jitamxb:7AT12-4Ong@meetmind-cluster.ehuyp5e.mongodb.net/?appName=meetmind-cluster"
    )
    mongodb_db: str = "blue_cross_rag"
    mongodb_chat_collection: str = "blue_cross_chat_session"
    mongodb_timeout_ms: int = 5000

    # --- Chat ---
    chat_history_window_turns: int = 10
    chat_retrieval_top_k: int = 6
    # Minimum similarity score for the linked PI document to be considered a
    # sufficient answer before falling back to the PIL. Corpus-dependent — tune
    # against real embeddings.
    pi_relevance_threshold: float = 0.35
    # Minimum similarity score for a retrieved PDF chunk to count as grounding for
    # the HCP-consent gate. Below this (e.g. greetings/chit-chat, which only match
    # weakly) the answer is NOT blurred. Corpus-dependent — tune if needed.
    pdf_consent_min_score: float = 0.3

    # --- Chunking defaults (overridable per request) ---
    default_chunk_size: int = 600
    default_chunk_overlap: int = 100

    # --- Admin portal auth (seeded on startup if the account doesn't exist) ---
    admin_default_email: str = "admin@gmail.com"
    admin_default_password: str = "123456"

    @field_validator("qdrant_api_key", "openai_base_url", "mongodb_uri", mode="before")
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        """Treat empty/whitespace env values as ``None`` (common in ``.env`` files)."""
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @property
    def is_dev(self) -> bool:
        return self.environment.lower() == "dev"

    @property
    def cors_origins_list(self) -> list[str]:
        raw = self.cors_allow_origins.strip()
        if raw in ("", "*"):
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance."""
    return Settings()
