import { ENV } from '../../config/env'
import type { RequestOptions } from '../../types/api.types'

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

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(buildHeaders(options.headers))
  // Let the browser set the multipart boundary for FormData uploads.
  if (options.body instanceof FormData) {
    headers.delete('Content-Type')
  }
  const response = await fetch(buildUrl(endpoint), {
    ...options,
    headers,
    body: serializeBody(options),
  })

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
  if (isRecord(data) && typeof data.detail === 'string') return data.detail
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
