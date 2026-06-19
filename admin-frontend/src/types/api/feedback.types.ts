export interface FeedbackItem {
  id: string
  session_id: string
  original_text: string
  feedback_text: string
  status: number
  created_at: string
}

export interface FeedbackListResponse {
  total: number
  feedbacks: FeedbackItem[]
}

export interface CreateFeedbackRequest {
  session_id: string
  original_text: string
  feedback_text: string
}

export interface DeleteFeedbackResponse {
  deleted: boolean
  id: string
}
