import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type {
  SessionConfigResponse,
  UpdateSessionConfigRequest,
} from '../../types/api/sessionConfig.types'
export type {
  SessionConfigResponse,
  UpdateSessionConfigRequest,
} from '../../types/api/sessionConfig.types'

export async function getSessionConfigApi(): Promise<SessionConfigResponse> {
  const tokens = getStoredTokens()
  return request<SessionConfigResponse>('/config/session', {
    method: 'GET',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
  })
}

export async function updateSessionConfigApi(
  payload: UpdateSessionConfigRequest,
): Promise<SessionConfigResponse> {
  const tokens = getStoredTokens()
  return request<SessionConfigResponse>('/config/session', {
    method: 'PUT',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
    json: payload,
  })
}
