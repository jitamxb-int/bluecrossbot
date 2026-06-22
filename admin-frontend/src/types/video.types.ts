export interface SkippedFile {
  filename: string;
  reason: string;
}

export interface VideoReference {
  title: string;
  video_url?: string;
  thumbnail_url?: string;
  category?: string;
  division?: string;
  page_url?: string;
  score?: number;
}

export interface VideoIngestResponse {
  status: string;
  files_processed: number;
  total_videos_ingested: number;
  collection: string;
  timestamp: string;
  files_skipped: number;
  skipped_files: SkippedFile[];
}
