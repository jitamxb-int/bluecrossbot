export interface SkippedFile {
  filename: string
  reason: string
}

export interface ProductIngestResponse {
  status: string
  files_processed: number
  total_products_ingested: number
  collection: string
  timestamp: string
  files_skipped: number
  skipped_files: SkippedFile[]
}
