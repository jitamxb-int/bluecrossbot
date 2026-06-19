import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type { HealthResponse, ReadinessResponse } from '../../types/api/health.types'
export type { HealthResponse, ReadinessResponse } from '../../types/api/health.types'

export async function getLivenessApi(): Promise<HealthResponse> {
  const tokens = getStoredTokens()

  return request<HealthResponse>('/health', {
    method: 'GET',
    headers: {
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  })
}

export async function getReadinessApi(): Promise<ReadinessResponse> {
  const tokens = getStoredTokens()

  return request<ReadinessResponse>('/ready', {
    method: 'GET',
    headers: {
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  })
}
