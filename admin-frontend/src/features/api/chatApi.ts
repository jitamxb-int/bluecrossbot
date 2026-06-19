import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type {
  ChatRequest,
  ChatResponse,
  ChatCountResponse,
  ChatSessionListResponse,
  ChatTranscriptsResponse,
  SessionListParams,
} from '../../types/api/chat.types'
export type {
  ChatRequest,
  ChatResponse,
  ChatCountResponse,
  ChatSessionListResponse,
  ChatTranscriptsResponse,
  SessionListParams,
} from '../../types/api/chat.types'

export async function getChatMetricsApi(): Promise<ChatCountResponse> {
  const tokens = getStoredTokens()

  return request<ChatCountResponse>('/chat/count', {
    method: 'GET',
    headers: {
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  })
}

export async function getChatTranscriptsApi(): Promise<ChatTranscriptsResponse> {
  const tokens = getStoredTokens()

  return request<ChatTranscriptsResponse>('/chat/transcripts', {
    method: 'GET',
    headers: {
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
  })
}

export async function getSessionsApi(params: SessionListParams = {}): Promise<ChatSessionListResponse> {
  const tokens = getStoredTokens()
  const query = new URLSearchParams()
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.offset !== undefined) query.set('offset', String(params.offset))
  if (params.status) query.set('status', params.status)
  if (params.sortBy) query.set('sortBy', params.sortBy)
  if (params.sortOrder) query.set('sortOrder', params.sortOrder)
  const qs = query.toString()
  return request<ChatSessionListResponse>(`/sessions${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
  })
}

export async function sendChatMessageApi(payload: ChatRequest): Promise<ChatResponse> {
  const tokens = getStoredTokens()

  return request<ChatResponse>('/chat', {
    method: 'POST',
    headers: {
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
    json: payload,
  })
}
