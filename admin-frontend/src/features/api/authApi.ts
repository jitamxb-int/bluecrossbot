import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginResponse,
} from '../../types/api/auth.types'
export type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginResponse,
} from '../../types/api/auth.types'

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    json: { email, password },
  })
}

export async function changePasswordApi(
  payload: ChangePasswordRequest,
): Promise<ChangePasswordResponse> {
  const tokens = getStoredTokens()
  return request<ChangePasswordResponse>('/auth/change-password', {
    method: 'POST',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
    json: payload,
  })
}
