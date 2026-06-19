import { ENV } from '../../config/env'
import type { RequestOptions } from '../../types/api.types'
import { clearTokens, getStoredTokens, saveTokens } from '../../features/storage/authStorage'

export class HttpError extends Error {
  status: number
  data: unknown
  errors?: Record<string, string[]>

  constructor(message: string, status: number, data: unknown, errors?: Record<string, string[]>) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
    this.errors = errors
  }
}

// Single shared promise prevents multiple simultaneous refresh calls
let refreshPromise: Promise<string> | null = null

async function getRefreshedToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const tokens = getStoredTokens()
    if (!tokens?.refreshToken) throw new Error('No refresh token')

    const res = await fetch(buildUrl('/auth/refresh-token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    })

    if (!res.ok) throw new Error('Refresh failed')

    const data = await res.json()
    const newTokens = data?.data?.tokens
    if (!newTokens?.accessToken) throw new Error('Invalid refresh response')

    saveTokens(newTokens)
    return newTokens.accessToken as string
  })().finally(() => { refreshPromise = null })

  return refreshPromise
}

// Skip refresh for these endpoints to avoid loops
// const SKIP_REFRESH = ['/auth/login', '/auth/refresh-token', '/auth/google', '/auth/forgot-password']

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(buildHeaders(options.headers))
  if (options.body instanceof FormData) {
    headers.delete('Content-Type')
  }
  const response = await fetch(buildUrl(endpoint), {
    ...options,
    headers,
    body: serializeBody(options),
  })
  
  // if (response.status === 401 && !SKIP_REFRESH.some((p) => endpoint.includes(p))) {
  //   try {
  //     const newToken = await getRefreshedToken()
  //     const retry = await fetch(buildUrl(endpoint), {
  //       ...options,
  //       headers: buildHeaders({ ...options.headers as Record<string, string>, Authorization: `Bearer ${newToken}` }),
  //       body: serializeBody(options),
  //     })
  //     const retryData = await parseResponse(retry)
  //     if (!retry.ok) {
  //       throw new HttpError(getErrorMessage(retryData, retry.statusText), retry.status, retryData, getErrors(retryData))
  //     }
  //     return retryData as T
  //   } catch {
  //     clearTokens()
  //     window.location.href = '/'
  //     throw new HttpError('Session expired', 401, null)
  //   }
  // }

  const data = await parseResponse(response)
  if (!response.ok) {
    throw new HttpError(getErrorMessage(data, response.statusText), response.status, data, getErrors(data))
  }

  return data as T
}

function buildUrl(endpoint: string) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint
  return `${ENV.VITE_API_BASE_URL}${endpoint}`
}

function buildHeaders(headers: HeadersInit | undefined): HeadersInit {
  return { 'Content-Type': 'application/json', ...headers }
}

function serializeBody(options: RequestOptions): BodyInit | undefined {
  if (options.json !== undefined) return JSON.stringify(options.json)
  const { body } = options
  if (body === undefined || body === null) return undefined
  return body
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try { return JSON.parse(text) } catch (_) { return text }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data) && typeof data.message === 'string') return data.message
  return fallback || 'Request failed.'
}

function getErrors(data: unknown) {
  if (isRecord(data) && isRecord(data.errors)) return data.errors as Record<string, string[]>
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
