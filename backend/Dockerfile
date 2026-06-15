# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — resolve & install dependencies with uv into an isolated venv.
# ---------------------------------------------------------------------------
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Copy only dependency manifests first so this layer is cached across code changes.
COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---------------------------------------------------------------------------
# Stage 2 — slim runtime image with the prebuilt venv and application code.
# ---------------------------------------------------------------------------
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Run as a non-root user.
RUN groupadd --system appuser \
    && useradd --system --gid appuser --create-home appuser

WORKDIR /app

# Bring in the resolved virtual environment.
COPY --from=builder /app/.venv /app/.venv

# Application code.
COPY server.py server_run.py ./
COPY src ./src

RUN mkdir -p /app/logs && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "server_run.py"]
