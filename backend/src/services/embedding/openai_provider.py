"""OpenAI embedding provider using the async client.

Texts are embedded in batches (``OPENAI_EMBEDDING_BATCH_SIZE``) and results are
re-ordered by the API's returned ``index`` to guarantee input/output alignment.

The base URL is always resolved to an explicit, scheme-qualified URL before
constructing the client. This is deliberate: if ``base_url`` is left as ``None``,
the OpenAI SDK falls back to the ``OPENAI_BASE_URL`` environment variable — and an
*empty* env var becomes ``''``, which makes the SDK issue requests to a relative
path ("/embeddings") and fail with a confusing ``UnsupportedProtocol`` /
``APIConnectionError``. Passing an explicit URL bypasses that broken fallback.
"""

from __future__ import annotations

from openai import APIError, AsyncOpenAI

from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.embedding.base import EmbeddingProvider
from src.services.embedding.errors import EmbeddingError
from src.services.llm.openai_base import DEFAULT_OPENAI_BASE_URL, resolve_base_url

logger = get_logger(__name__)

# API-key values that indicate the key was never configured.
_PLACEHOLDER_KEYS = {"", "sk-replace-me"}

# Re-exported for backwards compatibility; the implementation now lives in
# ``src.services.llm.openai_base`` and is shared with the chat provider.
_resolve_base_url = resolve_base_url

__all__ = ["DEFAULT_OPENAI_BASE_URL", "OpenAIEmbeddingProvider"]


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, settings: Settings, client: AsyncOpenAI | None = None) -> None:
        self._model = settings.openai_embedding_model
        self._dimension = settings.vector_size
        self._batch_size = max(1, settings.openai_embedding_batch_size)
        self._api_key = (settings.openai_api_key or "").strip()
        self._base_url = _resolve_base_url(settings.openai_base_url)
        self._client = client or AsyncOpenAI(api_key=self._api_key, base_url=self._base_url)

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def base_url(self) -> str:
        return self._base_url

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self._api_key in _PLACEHOLDER_KEYS:
            raise EmbeddingError(
                "OPENAI_API_KEY is not configured. Set a valid key in your .env file."
            )

        vectors: list[list[float]] = []
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            try:
                response = await self._client.embeddings.create(model=self._model, input=batch)
            except APIError as exc:
                raise EmbeddingError(
                    f"OpenAI embeddings request failed ({type(exc).__name__}): {exc}"
                ) from exc
            ordered = sorted(response.data, key=lambda item: item.index)
            vectors.extend(item.embedding for item in ordered)
            logger.debug("embedded_batch", model=self._model, batch_size=len(batch), offset=start)

        return vectors

    async def aclose(self) -> None:
        await self._client.close()
