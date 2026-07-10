import type { RootState } from '../../app/store'

export const selectFeedbacks      = (state: RootState) => state.feedback.feedbacks
export const selectFeedbackTotal  = (state: RootState) => state.feedback.total
export const selectFetchStatus    = (state: RootState) => state.feedback.fetchStatus
export const selectFetchError     = (state: RootState) => state.feedback.fetchError
export const selectCreating       = (state: RootState) => state.feedback.creating
export const selectCreateError    = (state: RootState) => state.feedback.createError
export const selectDeletingId     = (state: RootState) => state.feedback.deletingId
export const selectDeleteError    = (state: RootState) => state.feedback.deleteError
export const selectUpdatingId     = (state: RootState) => state.feedback.updatingId
export const selectUpdateError    = (state: RootState) => state.feedback.updateError
