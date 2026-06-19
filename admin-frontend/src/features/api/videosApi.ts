import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type { VideoIngestResponse } from '../../types/api/video.types'
export type { VideoIngestResponse } from '../../types/api/video.types'

export async function ingestVideosApi(payload: File[] | FormData): Promise<VideoIngestResponse> {
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
    payload.forEach((file) => form.append('files', file, file.name))
    options.body = form
  }

  return request<VideoIngestResponse>('/ingest/video', options)
}
