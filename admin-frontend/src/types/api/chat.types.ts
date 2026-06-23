export interface ChatRequest {
  message: string
  session_id?: string
  top_k?: number
}

export interface ChatSession {
  session_id: string
  started_at?: string
  ended_at?: string
  duration_seconds: number
  is_active: boolean
}

export interface ProductReference {
  product_name: string
  category?: string
  division?: string
  image_url?: string
  page_url?: string
  score?: number
}

export interface VideoReference {
  title: string
  video_url?: string
  thumbnail_url?: string
  category?: string
  division?: string
  page_url?: string
  score?: number
}

export interface ChatResponse {
  answer: string
  session: ChatSession
  citations: string
  products: ProductReference[]
  videos: VideoReference[]
}

export interface ChatCountResponse {
  total_chats: number
  total_chat_messages: number
  total_chat_minutes: number
  minutes_of_meetings: Record<string, Record<string, unknown>[]>
}

export interface ChatTranscriptsResponse {
  transcripts: Record<string, Record<string, unknown>[]>
}

export interface ChatSessionItem {
  session_id: string
  started_at?: string
  ended_at?: string
  duration_seconds: number
  is_active: boolean
  message_count: number
  created_at: string
  updated_at: string
}

export interface ChatSessionListResponse {
  total: number
  limit: number
  offset: number
  sessions: ChatSessionItem[]
}

export type SessionSortField = 'id' | 'started_at' | 'ended_at' | 'duration_seconds' | 'created_at'
export type SortOrder = 'asc' | 'desc'

export interface SessionListParams {
  limit?: number
  offset?: number
  status?: string
  sortBy?: SessionSortField
  sortOrder?: SortOrder
  startDate?: string // ISO datetime, sent as ?start_date=
  endDate?: string // ISO datetime, sent as ?end_date=
}

export interface ChatMetricsParams {
  startDate?: string // ISO datetime, sent as ?start_date=
  endDate?: string // ISO datetime, sent as ?end_date=
}

export interface DeleteSessionsRequest {
  session_ids: string[]
}

export interface DeleteSessionsResponse {
  deleted: number
  requested: number
}
