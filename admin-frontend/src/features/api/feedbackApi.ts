import { request } from '../../shared/api/httpClient'
import { getStoredTokens } from '../storage/authStorage'
import type {
  CreateFeedbackRequest,
  DeleteFeedbackResponse,
  FeedbackItem,
  FeedbackListResponse,
  ResolutionStatus,
} from '../../types/api/feedback.types'
export type {
  CreateFeedbackRequest,
  DeleteFeedbackResponse,
  FeedbackItem,
  FeedbackListResponse,
  ResolutionStatus,
} from '../../types/api/feedback.types'

export async function getAllFeedbacksApi(): Promise<FeedbackListResponse> {
  const tokens = getStoredTokens()
  return request<FeedbackListResponse>('/feedback', {
    method: 'GET',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
  })
}

export async function createFeedbackApi(payload: CreateFeedbackRequest): Promise<FeedbackItem> {
  const tokens = getStoredTokens()
  return request<FeedbackItem>('/feedback', {
    method: 'POST',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
    json: payload,
  })
}

export async function updateFeedbackStatusApi(
  feedbackId: string,
  resolutionStatus: ResolutionStatus,
): Promise<FeedbackItem> {
  const tokens = getStoredTokens()
  return request<FeedbackItem>(`/feedback/${feedbackId}`, {
    method: 'PATCH',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
    json: { resolution_status: resolutionStatus },
  })
}

export async function deleteFeedbackApi(feedbackId: string): Promise<DeleteFeedbackResponse> {
  const tokens = getStoredTokens()
  return request<DeleteFeedbackResponse>(`/feedback/${feedbackId}`, {
    method: 'DELETE',
    headers: { ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}) },
  })
}
