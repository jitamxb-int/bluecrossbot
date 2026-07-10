import { createSlice } from '@reduxjs/toolkit'
import type { RequestStatus } from '../../types/common.types'
import type { FeedbackItem } from '../../types/api/feedback.types'
import { fetchAllFeedbacks, createFeedback, deleteFeedback, updateFeedbackStatus } from '../thunks/feedbackThunks'

interface FeedbackState {
  feedbacks: FeedbackItem[]
  total: number
  fetchStatus: RequestStatus
  fetchError: string | null
  creating: boolean
  createError: string | null
  deletingId: string | null
  deleteError: string | null
  updatingId: string | null
  updateError: string | null
}

const initialState: FeedbackState = {
  feedbacks: [],
  total: 0,
  fetchStatus: 'idle',
  fetchError: null,
  creating: false,
  createError: null,
  deletingId: null,
  deleteError: null,
  updatingId: null,
  updateError: null,
}

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState,
  reducers: {
    clearCreateError(state) {
      state.createError = null
    },
    clearDeleteError(state) {
      state.deleteError = null
    },
    clearUpdateError(state) {
      state.updateError = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch all
      .addCase(fetchAllFeedbacks.pending, (state) => {
        state.fetchStatus = 'loading'
        state.fetchError = null
      })
      .addCase(fetchAllFeedbacks.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded'
        state.feedbacks = action.payload.feedbacks
        state.total = action.payload.total
      })
      .addCase(fetchAllFeedbacks.rejected, (state, action) => {
        state.fetchStatus = 'failed'
        state.fetchError = action.payload ?? 'Failed to load feedbacks'
      })
      // create
      .addCase(createFeedback.pending, (state) => {
        state.creating = true
        state.createError = null
      })
      .addCase(createFeedback.fulfilled, (state, action) => {
        state.creating = false
        state.feedbacks.unshift(action.payload)
        state.total += 1
      })
      .addCase(createFeedback.rejected, (state, action) => {
        state.creating = false
        state.createError = action.payload ?? 'Failed to save feedback'
      })
      // delete
      .addCase(deleteFeedback.pending, (state, action) => {
        state.deletingId = action.meta.arg
        state.deleteError = null
      })
      .addCase(deleteFeedback.fulfilled, (state, action) => {
        state.deletingId = null
        state.feedbacks = state.feedbacks.filter((f) => f.id !== action.payload.id)
        state.total = Math.max(0, state.total - 1)
      })
      .addCase(deleteFeedback.rejected, (state, action) => {
        state.deletingId = null
        state.deleteError = action.payload ?? 'Failed to delete feedback'
      })
      // update status (WIP <-> Resolved)
      .addCase(updateFeedbackStatus.pending, (state, action) => {
        state.updatingId = action.meta.arg.id
        state.updateError = null
      })
      .addCase(updateFeedbackStatus.fulfilled, (state, action) => {
        state.updatingId = null
        const i = state.feedbacks.findIndex((f) => f.id === action.payload.id)
        if (i !== -1) state.feedbacks[i] = action.payload
      })
      .addCase(updateFeedbackStatus.rejected, (state, action) => {
        state.updatingId = null
        state.updateError = action.payload ?? 'Failed to update feedback status'
      })
  },
})

export const { clearCreateError, clearDeleteError, clearUpdateError } = feedbackSlice.actions
export default feedbackSlice.reducer
