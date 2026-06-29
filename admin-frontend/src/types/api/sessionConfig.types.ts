// Mirrors the backend SessionConfigResponse / UpdateSessionConfigRequest
// (snake_case — the HTTP client does not transform field names).

export interface SessionConfigResponse {
  max_session_duration_minutes: number
  updated_at?: string | null
}

export interface UpdateSessionConfigRequest {
  max_session_duration_minutes: number
}
