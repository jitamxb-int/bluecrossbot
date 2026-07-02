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
COPY /backend/pyproject.toml /backend/uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ---------------------------------------------------------------------------
# Frontend builds (Vite) -> static nginx images. Each app is an independent
# target selected by docker-compose via `build.target`. These stages sit BEFORE
# the backend `runtime` stage so `runtime` stays the final/default stage and the
# backend service (which has no `target:`) is unchanged.
# ---------------------------------------------------------------------------

# --- Public site (frontend) — Vite output dir: dist ---
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# VITE_* are read from the copied frontend/.env by Vite at build time. Do NOT set
# them as ENV here — real env vars take precedence over .env and would override it.
RUN npm run build

FROM nginx:alpine AS frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
EOF
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# --- Admin dashboard (admin-frontend) — Vite output dir: build ---
FROM node:20-alpine AS admin-build
WORKDIR /app
COPY admin-frontend/package.json admin-frontend/package-lock.json ./
RUN npm ci
COPY admin-frontend/ ./
# VITE_API_BASE_URL is read from the copied admin-frontend/.env by Vite at build.
RUN npm run build

FROM nginx:alpine AS admin-frontend
COPY --from=admin-build /app/build /usr/share/nginx/html
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
EOF
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# --- Upload console (upload-frontend) — Vite output dir: build ---
FROM node:20-alpine AS upload-build
WORKDIR /app
COPY upload-frontend/package.json upload-frontend/package-lock.json ./
RUN npm ci
COPY upload-frontend/ ./
# VITE_API_BASE_URL is read from the copied upload-frontend/.env by Vite at build.
RUN npm run build

FROM nginx:alpine AS upload-frontend
COPY --from=upload-build /app/build /usr/share/nginx/html
RUN cat > /etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}
EOF
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

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
COPY backend/server.py backend/server_run.py ./
COPY backend/src ./src

RUN mkdir -p /app/logs && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "server_run.py"]
