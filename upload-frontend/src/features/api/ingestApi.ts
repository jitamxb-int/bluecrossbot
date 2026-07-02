import { request } from '../../shared/api/httpClient';
import type {
  DeleteAllResponse,
  DeleteByDocumentResponse,
  DocumentField,
  IngestKind,
  PdfIngestResponse,
  RawIngestResponse,
} from '../../types/ingest.types';

export interface IngestOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/** Upload one or more .txt files to the chosen ingest pipeline (multipart). */
export async function ingestFiles(
  kind: IngestKind,
  files: File[],
  opts: IngestOptions = {},
): Promise<RawIngestResponse> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  // chunk params only meaningful for descriptive/pdf; product/video ignore them server-side.
  if (kind === 'descriptive' || kind === 'pdf') {
    if (opts.chunkSize !== undefined) form.append('chunk_size', String(opts.chunkSize));
    if (opts.chunkOverlap !== undefined) form.append('chunk_overlap', String(opts.chunkOverlap));
  }
  return request<RawIngestResponse>(`/ingest/${kind}`, {
    method: 'POST',
    body: form,
  });
}

/** Upload PI + PIL .txt files (with a division) to the PI/PIL pipeline. */
export async function ingestPdf(
  piFiles: File[],
  pilFiles: File[],
  division: string,
  opts: IngestOptions = {},
): Promise<PdfIngestResponse> {
  const form = new FormData();
  piFiles.forEach((file) => form.append('pi_files', file));
  pilFiles.forEach((file) => form.append('pil_files', file));
  form.append('division', division);
  if (opts.chunkSize !== undefined) form.append('chunk_size', String(opts.chunkSize));
  if (opts.chunkOverlap !== undefined) form.append('chunk_overlap', String(opts.chunkOverlap));
  return request<PdfIngestResponse>('/ingest/pdf', {
    method: 'POST',
    body: form,
  });
}

/** Delete all points belonging to the given documents (by id OR name). */
export async function deleteByDocument(
  field: DocumentField,
  values: string[],
): Promise<DeleteByDocumentResponse> {
  return request<DeleteByDocumentResponse>('/vectors/by-document', {
    method: 'DELETE',
    json: { field, values },
  });
}

/** Permanently delete every point in the vector collection. */
export async function deleteAllVectors(): Promise<DeleteAllResponse> {
  return request<DeleteAllResponse>('/vectors/all', {
    method: 'DELETE',
  });
}
