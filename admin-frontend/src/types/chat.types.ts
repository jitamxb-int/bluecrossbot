export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatSession {
  session_id: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds: number;
  is_active: boolean;
}

// POST /chat — request body
export interface ChatRequest {
  message: string;
  session_id?: string;
  top_k?: number;
}

export interface ProductReference {
  product_name: string;
  category?: string;
  division?: string;
  image_url?: string;
  page_url?: string;
  score?: number;
}

export interface VideoReference {
  title: string;
  video_url?: string;
  thumbnail_url?: string;
  category?: string;
  division?: string;
  page_url?: string;
  score?: number;
}

// POST /chat — response
export interface ChatResponse {
  answer: string;
  session: ChatSession;
  citations: string;
  products: ProductReference[];
  videos: VideoReference[];
}

// GET /chat/count — response
export interface ChatCountResponse {
  total_chats: number;
  total_chat_messages: number;
  total_chat_minutes: number;
  minutes_of_meetings: Record<string, Record<string, unknown>[]>;
}

// GET /chat/transcripts — response
export interface ChatTranscriptsResponse {
  transcripts: Record<string, Record<string, unknown>[]>;
}

// Kept for store slice compatibility
export interface ChatTranscriptsMap {
  transcripts: Record<string, ChatMessage[]>;
}
