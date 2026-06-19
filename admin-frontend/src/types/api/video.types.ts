export interface SkippedFile {
  filename: string
  reason: string
}

export interface VideoIngestResponse {
  status: string
  files_processed: number
  total_videos_ingested: number
  collection: string
  timestamp: string
  files_skipped: number
  skipped_files: SkippedFile[]
}
