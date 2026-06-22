export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null
  json?: unknown
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message: string
  timestamp: string
  errors?: Record<string, string[]>
}
