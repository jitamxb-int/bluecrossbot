export type ResolutionStatus = 'WIP' | 'Resolved'

export interface FeedbackItem {
  id: string
  session_id: string
  original_text: string
  feedback_text: string
  status: number
  resolution_status: ResolutionStatus
  created_at: string
}

export interface UpdateFeedbackStatusRequest {
  resolution_status: ResolutionStatus
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
