import { createAsyncThunk } from '@reduxjs/toolkit'
import { getAllFeedbacksApi, createFeedbackApi, deleteFeedbackApi } from '../api/feedbackApi'
import { normalizeError } from '../../utils/errorHandler'
import type {
  CreateFeedbackRequest,
  DeleteFeedbackResponse,
  FeedbackItem,
  FeedbackListResponse,
} from '../../types/api/feedback.types'

export const fetchAllFeedbacks = createAsyncThunk<FeedbackListResponse, void, { rejectValue: string }>(
  'feedback/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      return await getAllFeedbacksApi()
    } catch (err) {
      return rejectWithValue(normalizeError(err).message)
    }
  }
)

export const createFeedback = createAsyncThunk<FeedbackItem, CreateFeedbackRequest, { rejectValue: string }>(
  'feedback/create',
  async (payload, { rejectWithValue }) => {
    try {
      return await createFeedbackApi(payload)
    } catch (err) {
      return rejectWithValue(normalizeError(err).message)
    }
  }
)

export const deleteFeedback = createAsyncThunk<DeleteFeedbackResponse, string, { rejectValue: string }>(
  'feedback/delete',
  async (feedbackId, { rejectWithValue }) => {
    try {
      return await deleteFeedbackApi(feedbackId)
    } catch (err) {
      return rejectWithValue(normalizeError(err).message)
    }
  }
)
