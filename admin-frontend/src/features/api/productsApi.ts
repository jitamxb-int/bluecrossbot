import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type { ProductIngestResponse } from '../../types/api/product.types'
export type { ProductIngestResponse } from '../../types/api/product.types'

export async function ingestProductsApi(payload: File[] | FormData): Promise<ProductIngestResponse> {
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

  return request<ProductIngestResponse>('/ingest/product', options)
}
