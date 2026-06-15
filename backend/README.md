# RAG Backend

Production-ready backend service for a Retrieval-Augmented Generation (RAG)
platform. It delivers three ingestion pipelines (descriptive / product / video),
semantic retrieval, and a **RAG chat endpoint** with per-session memory.

Ingest `.txt` documents → chunk (descriptive) or one-vector-per-record (product /
video) → embed (OpenAI) → store vectors + metadata in **Qdrant**. Then `/chat`
retrieves relevant context, answers with an LLM, persists the conversation in
**MongoDB**, and surfaces product/video references with their real image/video URLs.

---

## Tech stack

| Concern        | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Language       | Python 3.13+                                             |
| Web framework  | FastAPI (async)                                          |
| Validation     | Pydantic v2 / pydantic-settings                          |
| Vector DB      | Qdrant (`qdrant-client`, async)                          |
| Chat history   | MongoDB (`beanie` + PyMongo async, one doc per session)  |
| Embeddings     | OpenAI `text-embedding-3-small` (1536-dim, configurable) |
| Generation     | OpenAI Chat Completions (structured outputs, configurable) |
| Chunking       | `langchain-text-splitters` (RecursiveCharacterTextSplitter) |
| Logging        | `structlog` (JSON in prod, console in dev)               |
| Packaging      | `uv`                                                     |
| Deployment     | Docker + Docker Compose                                  |

---

## Architecture

```
        ┌──────────────┐
client →│   API layer   │  routes + Pydantic models  (src/api)
        └──────┬───────┘
               │ Depends
        ┌──────▼───────┐
        │ Service layer │  ingestion · chunking · embedding   (src/services)
        │               │  retrieval · llm · chat
        └──────┬───────┘
               │
        ┌──────▼───────┐        ┌──────────────┐
        │ Storage layer │ ─────▶ │    Qdrant     │  vectors  (src/storage/qdrant)
        │               │ ─────▶ │   MongoDB     │  sessions (src/storage/mongo)
        └──────────────┘        └──────────────┘

  Core layer (src/core): config · logging · vector_db client · mongo client
```

### Project layout

```
backend/
├── server.py            # FastAPI app factory + lifespan
├── server_run.py        # uvicorn entrypoint
├── pyproject.toml       # deps (uv)
├── Dockerfile           # multi-stage uv build
├── docker-compose.yml   # qdrant + backend
├── .env.example
├── logs/
├── src/
│   ├── api/             # models/ + routes/ (ingestion, product, video, retrieval, chat, health)
│   ├── core/            # config.py, logging/, vector_db/, mongo/
│   ├── services/        # ingestion/ chunking/ embedding/ llm/ retrieval/ chat/
│   ├── storage/         # qdrant/ (vectors) + mongo/ (chat sessions)
│   └── utils/
└── tests/
```

---

## Configuration

All configuration is environment-driven (see `.env.example`). Copy it and fill in
your values:

```bash
cp .env.example .env
# set OPENAI_API_KEY=... at minimum
```

Key variables: `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`,
`VECTOR_SIZE` (must match the model: 1536 for `-small`, 3072 for `-large`),
`QDRANT_URL`, `QDRANT_COLLECTION_NAME`, `MONGODB_URI` (your existing MongoDB /
Atlas — required for `/chat`), `MONGODB_DB`, `CHAT_HISTORY_WINDOW_TURNS`,
`CHAT_RETRIEVAL_TOP_K`, `DEFAULT_CHUNK_SIZE`, `DEFAULT_CHUNK_OVERLAP`,
`LOG_JSON`, `ENVIRONMENT`.

> **Single fixed collection:** this project uses exactly one Qdrant collection,
> configured via `QDRANT_COLLECTION_NAME` (default `blue_cross_rag_documents`).
> It is **not** selectable per request — all ingested vectors go to that one
> collection.

---

## Run with Docker Compose (recommended)

```bash
cp .env.example .env          # then set OPENAI_API_KEY
docker compose up --build
```

- API:        http://localhost:8000
- Swagger UI:  http://localhost:8000/docs
- Qdrant dash: http://localhost:6333/dashboard

## Run locally with uv

```bash
uv sync                       # create venv + install deps
uv run python server_run.py   # starts uvicorn (reload in dev)
```

You'll need a Qdrant instance reachable at `QDRANT_URL` (e.g.
`docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant`).

---

## API

Base path: `/api/v1`

| Method | Path                       | Status        | Description                                       |
| ------ | -------------------------- | ------------- | ------------------------------------------------- |
| GET    | `/health`                  | ✅ implemented | Liveness probe                                    |
| GET    | `/ready`                   | ✅ implemented | Readiness probe (pings Qdrant)                    |
| POST   | `/ingest/descriptive`      | ✅ implemented | Ingest scraped website `.txt` files (chunked)     |
| POST   | `/ingest/product`          | ✅ implemented | Ingest product `.txt` files (one vector / product)|
| POST   | `/ingest/video`            | ✅ implemented | Ingest video `.txt` files (one vector / video)    |
| POST   | `/retrieve`                | ✅ implemented | Semantic search (optional `doc_type` filter)      |
| POST   | `/chat`                    | ✅ implemented | RAG chat with session memory + product/video refs |

All three ingest endpoints write into the **same** Qdrant collection and tag every
point with `doc_type` (`"descriptive"`, `"product"`, or `"video"`) so retrieval
can filter by content type. Only `.txt` files are accepted (non-`.txt` → HTTP 400).
Files that cannot be parsed are skipped (logged + reported in `skipped_files`)
while the rest of the batch still ingests.

### Descriptive ingest example

A document begins with a URL header line:

```text
URL      : https://www.bluecrosslabs.com/#

This is paragraph 1...
This is paragraph 2...
```

Attach one or more `.txt` files. The chunking parameters are **optional** — when
omitted, the configured defaults (`DEFAULT_CHUNK_SIZE` / `DEFAULT_CHUNK_OVERLAP`)
are used, so you can simply attach the file(s):

```bash
# Just attach the file(s):
curl -X POST http://localhost:8000/api/v1/ingest/descriptive \
  -F "files=@file1.txt" \
  -F "files=@file2.txt"

# ...or optionally override the chunking parameters:
curl -X POST http://localhost:8000/api/v1/ingest/descriptive \
  -F "files=@file1.txt" \
  -F "chunk_size=600" \
  -F "chunk_overlap=100"
```

Response:

```json
{
  "collection": "blue_cross_rag_documents",
  "embedding_model": "text-embedding-3-small",
  "total_documents": 2,
  "total_chunks": 14,
  "documents": [
    {
      "document_id": "a1b2c3...",
      "document_name": "file1.txt",
      "source_url": "https://www.bluecrosslabs.com/#",
      "chunk_count": 7
    }
  ]
}
```

Each stored vector carries this payload, preserved through the full lifecycle:

```json
{
  "document_id": "a1b2c3...",
  "document_name": "file1.txt",
  "source_url": "https://www.bluecrosslabs.com/#",
  "chunk_id": "a1b2c3..._chunk_0",
  "chunk_index": 0,
  "upload_timestamp": "2026-06-08T12:00:00Z",
  "text": "...",
  "doc_type": "descriptive"
}
```

> `document_id` is `md5(filename + content)` — deterministic, so re-ingesting the
> same file is idempotent.

### Product ingest example

`POST /api/v1/ingest/product` ingests structured product `.txt` files. Each
product record becomes **exactly one vector** (no chunking). `chunk_size` /
`chunk_overlap` are accepted for API compatibility but **ignored**. The embedded
text is a flattened string — `Product: {name}. Category: {category}. Division:
{division}. {description}` — while `image_url` / `page_url` are kept in the
payload only (never embedded).

```bash
curl -X POST http://localhost:8000/api/v1/ingest/product \
  -F "files=@5.txt" \
  -F "files=@6.txt"
```

Response:

```json
{
  "status": "success",
  "endpoint": "product",
  "files_processed": 2,
  "total_products_ingested": 18,
  "collection": "blue_cross_rag_documents",
  "timestamp": "2026-06-10T12:00:00Z",
  "files_skipped": 0,
  "skipped_files": []
}
```

Per-product Qdrant payload:

```json
{
  "document_id": "<md5(filename + product_name)>",
  "document_name": "5.txt",
  "product_name": "Dolostat Gel",
  "category": "Analgesics",
  "division": "Blue Cross Division",
  "image_url": "https://.../Dolostat-Gel.png",
  "page_url": "https://www.bluecrosslabs.com/product-category/...",
  "chunk_id": "<document_id>_product_0",
  "chunk_index": 0,
  "upload_timestamp": "2026-06-10T12:00:00Z",
  "text": "Product: Dolostat Gel. Category: Analgesics. Division: Blue Cross Division. ...",
  "doc_type": "product"
}
```

### Video ingest example

`POST /api/v1/ingest/video` mirrors the product endpoint — one vector per video,
chunk params accepted-but-ignored. Each video file uses the same embedded-JSON
shape as products; `video_url` is required, while `thumbnail`, `category`,
`division`, and `description` are optional. The flattened embedded text is
`Video: {title}. Category: {category}. {description}` (optional parts omitted);
`video_url`/`thumbnail` live in the payload only.

```bash
curl -X POST http://localhost:8000/api/v1/ingest/video -F "files=@videos.txt"
```

Per-video Qdrant payload (`doc_type="video"`): `document_id` =
`md5(filename + title)`, `video_name`, `video_url`, `thumbnail_url`, `category`,
`division`, `page_url`, `chunk_id` = `<document_id>_video_0`, `chunk_index: 0`,
`upload_timestamp`, `text`.

### Retrieve example

```bash
curl -X POST http://localhost:8000/api/v1/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query": "gel for muscle pain", "top_k": 5, "metadata_filter": {"doc_type": "product"}}'
```

Returns scored chunks, each with its full stored payload (`metadata`), so
product/video URLs survive.

### Chat example

`POST /api/v1/chat` answers grounded in the corpus, persists the conversation per
`session_id` in **MongoDB** (transcript + rolling summary + timing — see
`docs/CONVERSATION_HISTORY.md`), and surfaces relevant products/videos with their
real `image_url`/`video_url` pulled from the vector store. Requires `MONGODB_URI`,
`OPENAI_API_KEY`, and `OPENAI_CHAT_MODEL`; returns **503** if Mongo isn't configured.

```bash
# First turn — omit session_id; the response returns the minted one.
curl -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "suggest something for muscle pain"}'

# Follow-up — reuse the returned session_id to continue the thread.
curl -X POST http://localhost:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "does it come as a tablet?", "session_id": "<from previous response>"}'
```

Response:

```json
{
  "answer": "Dolostat Gel is a good topical option for muscle pain...",
  "session": {
    "session_id": "8f3c...",
    "started_at": "2026-06-12T10:00:00Z",
    "ended_at": "2026-06-12T10:00:04Z",
    "duration_seconds": 4.0,
    "is_active": true
  },
  "citations": "https://www.bluecrosslabs.com/#, https://www.bluecrosslabs.com/product/...",
  "products": [
    {
      "product_name": "Dolostat Gel",
      "category": "Analgesics",
      "image_url": "https://.../Dolostat-Gel.png",
      "page_url": "https://www.bluecrosslabs.com/product/...",
      "score": 0.83
    }
  ],
  "videos": [
    { "title": "Dolostat Gel Demo", "video_url": "https://youtube.com/watch?v=...", "score": 0.79 }
  ]
}
```

---

## Testing

```bash
uv run pytest          # unit + API tests (OpenAI & Qdrant are mocked — no network/keys needed)
```

---

## Roadmap (TODO)

- **Hybrid retrieval** (`POST /retrieve`): dense + sparse search (currently dense only).
- **Streaming chat** responses (SSE) and explicit session-end / inactivity timeout.
- Optional local embedding provider (FastEmbed / sentence-transformers) behind
  the existing `EmbeddingProvider` interface.
```
