export type IngestKind = 'descriptive' | 'pdf' | 'product' | 'video';

export interface SkippedFile {
  file: string;
  reason: string;
}

export interface DocumentIngestResult {
  document_id: string;
  document_name: string;
  source_url?: string | null;
  chunk_count: number;
}

/** Raw shape of POST /ingest/descriptive. */
export interface DescriptiveIngestResponse {
  collection: string;
  embedding_model: string;
  total_documents: number;
  total_chunks: number;
  documents: DocumentIngestResult[];
  files_skipped: number;
  skipped_files: SkippedFile[];
}

/** Raw shape of POST /ingest/product. */
export interface ProductIngestResponse {
  status: string;
  endpoint: string;
  files_processed: number;
  total_products_ingested: number;
  collection: string;
  timestamp: string;
  files_skipped: number;
  skipped_files: SkippedFile[];
}

/** Raw shape of POST /ingest/video. */
export interface VideoIngestResponse {
  status: string;
  endpoint: string;
  files_processed: number;
  total_videos_ingested: number;
  collection: string;
  timestamp: string;
  files_skipped: number;
  skipped_files: SkippedFile[];
}

export type RawIngestResponse =
  | DescriptiveIngestResponse
  | ProductIngestResponse
  | VideoIngestResponse;

/** Normalized summary so the three differing responses render through one component. */
export interface UploadSummary {
  collection: string;
  filesProcessed: number;
  ingested: number;
  ingestedLabel: string; // e.g. "chunks", "products", "videos"
  filesSkipped: number;
  skippedFiles: SkippedFile[];
  documents?: DocumentIngestResult[]; // descriptive only
}

export type DocumentField = 'document_id' | 'document_name';

export interface DeleteByDocumentResponse {
  collection: string;
  field: DocumentField;
  requested: number;
  deleted: number;
}

export interface DeleteAllResponse {
  collection: string;
  deleted: number;
}

/** Normalize the per-kind ingest response into one display shape. */
export function toUploadSummary(kind: IngestKind, raw: RawIngestResponse): UploadSummary {
  if (kind === 'descriptive' || kind === 'pdf') {
    const r = raw as DescriptiveIngestResponse;
    return {
      collection: r.collection,
      filesProcessed: r.total_documents,
      ingested: r.total_chunks,
      ingestedLabel: 'chunks',
      filesSkipped: r.files_skipped,
      skippedFiles: r.skipped_files ?? [],
      documents: r.documents ?? [],
    };
  }
  if (kind === 'product') {
    const r = raw as ProductIngestResponse;
    return {
      collection: r.collection,
      filesProcessed: r.files_processed,
      ingested: r.total_products_ingested,
      ingestedLabel: 'products',
      filesSkipped: r.files_skipped,
      skippedFiles: r.skipped_files ?? [],
    };
  }
  const r = raw as VideoIngestResponse;
  return {
    collection: r.collection,
    filesProcessed: r.files_processed,
    ingested: r.total_videos_ingested,
    ingestedLabel: 'videos',
    filesSkipped: r.files_skipped,
    skippedFiles: r.skipped_files ?? [],
  };
}
