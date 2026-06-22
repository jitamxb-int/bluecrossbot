export interface HealthResponse {
  status: string
  service: string
  environment: string
  version: string
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded'
  qdrant: string
}
