# upload-frontend

Standalone ingestion console for the Blue Cross RAG backend. Lets content operators upload source
documents into the vector store and manage what's stored — separate from `admin-frontend`.

## Stack

Vite + React 19 + TypeScript, Tailwind CSS 4 (`@tailwindcss/vite`), shadcn/ui, `sonner` toasts.
Same conventions as `admin-frontend` (shared `httpClient` / `env` pattern), but its own app with no
authentication and lightweight local state (no Redux).

## Features

- **Upload Documents** (`/upload`) — three tabs (Descriptive / Product / Video). Drag-and-drop or
  browse to select **multiple `.txt` files**, then upload them in a single request to
  `POST /api/v1/ingest/{descriptive|product|video}`. Descriptive supports optional chunk size /
  overlap. Shows a per-run summary (collection, counts, skipped files).
- **Manage Vector Store** (`/manage`)
  - **Delete by document** — pick an identifier type (`document_name` or `document_id`), add one or
    more values as chips, and delete all matching points via `DELETE /api/v1/vectors/by-document`.
  - **Danger zone** — clear the entire collection via `DELETE /api/v1/vectors/all` (type-to-confirm).

## Develop

```bash
npm install
npm run dev      # http://localhost:3001
npm run build    # tsc + vite build → build/
```

Configure the backend base URL in `.env` (`VITE_API_BASE_URL`, default `http://localhost:8000`);
`/api/v1` is appended automatically.
