export interface SkippedFile {
  filename: string;
  reason: string;
}

export interface ProductReference {
  product_name: string;
  category?: string;
  division?: string;
  image_url?: string;
  page_url?: string;
  score?: number;
}

export interface ProductIngestResponse {
  status: string;
  files_processed: number;
  total_products_ingested: number;
  collection: string;
  timestamp: string;
  files_skipped: number;
  skipped_files: SkippedFile[];
}
