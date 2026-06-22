import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type { IngestResponse, DescriptiveIngestPayload } from '../../types/api/ingestion.types'
export type { IngestResponse, DescriptiveIngestPayload } from '../../types/api/ingestion.types'

export async function ingestDescriptiveApi(payload: DescriptiveIngestPayload | FormData): Promise<IngestResponse> {
  const tokens = getStoredTokens()

  const options: Parameters<typeof request>[1] = {
    method: 'POST',
    headers: {
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  }

  if (payload instanceof FormData) {
    options.body = payload
  } else {
    const form = new FormData()
    payload.files.forEach((file) => form.append('files', file, file.name))
    if (payload.chunkSize !== undefined) form.append('chunk_size', String(payload.chunkSize))
    if (payload.chunkOverlap !== undefined) form.append('chunk_overlap', String(payload.chunkOverlap))
    options.body = form
  }

  return request<IngestResponse>('/ingest/descriptive', options)
}
