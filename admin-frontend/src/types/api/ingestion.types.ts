export interface SkippedFile {
  file: string
  reason: string
}

export interface DocumentIngestResult {
  document_id: string
  document_name: string
  source_url?: string
  chunk_count: number
}

export interface IngestResponse {
  collection: string
  embedding_model: string
  total_documents: number
  total_chunks: number
  documents: DocumentIngestResult[]
  files_skipped: number
  skipped_files: SkippedFile[]
}

export interface DescriptiveIngestPayload {
  files: File[]
  chunkSize?: number
  chunkOverlap?: number
}
