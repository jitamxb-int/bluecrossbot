export const ROUTES = {
  LOGIN: '/login',
  CHANGE_PASSWORD: '/change-password',
  DASHBOARD: '/dashboard',
  SESSIONS: '/sessions',
  TRANSCRIPT: '/transcript/:sessionId',
  FEEDBACK_LOGS: '/ai-feedback-log',
  SESSION_CONFIG: '/session-config',
  PRODUCTS: '/products',
  PRODUCT_INGEST: '/products/ingest',
  VIDEOS: '/videos',
  VIDEO_INGEST: '/videos/ingest',
  CHAT_SESSIONS: '/chat',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
