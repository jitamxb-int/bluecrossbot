export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const REQUEST_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;

export const ROUTE_PATHS = {
  DASHBOARD: '/',
  PRODUCTS: '/products',
  PRODUCT_INGEST: '/products/ingest',
  VIDEOS: '/videos',
  VIDEO_INGEST: '/videos/ingest',
  CHAT_SESSIONS: '/chat',
  CHAT_TRANSCRIPT: '/chat/:sessionId',
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
};

export const LOCAL_STORAGE_KEYS = {
  THEME: 'bcb_admin_theme',
  CHAT_FILTER: 'bcb_chat_filter',
  PRODUCTS_FILTER: 'bcb_products_filter',
  VIDEOS_FILTER: 'bcb_videos_filter',
} as const;
