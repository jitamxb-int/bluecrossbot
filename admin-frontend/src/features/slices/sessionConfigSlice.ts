import { createSlice } from '@reduxjs/toolkit'
import type { RequestStatus } from '../../types/common.types'
import type { SessionConfigResponse } from '../../types/api/sessionConfig.types'
import { fetchSessionConfig, updateSessionConfig } from '../thunks/sessionConfigThunks'

interface SessionConfigState {
  config: SessionConfigResponse | null
  fetchStatus: RequestStatus
  fetchError: string | null
  updating: boolean
  updateError: string | null
}

const initialState: SessionConfigState = {
  config: null,
  fetchStatus: 'idle',
  fetchError: null,
  updating: false,
  updateError: null,
}

const sessionConfigSlice = createSlice({
  name: 'sessionConfig',
  initialState,
  reducers: {
    clearUpdateError(state) {
      state.updateError = null
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchSessionConfig.pending, (state) => {
        state.fetchStatus = 'loading'
        state.fetchError = null
      })
      .addCase(fetchSessionConfig.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded'
        state.config = action.payload
      })
      .addCase(fetchSessionConfig.rejected, (state, action) => {
        state.fetchStatus = 'failed'
        state.fetchError = action.payload ?? 'Failed to load session configuration'
      })
      // update
      .addCase(updateSessionConfig.pending, (state) => {
        state.updating = true
        state.updateError = null
      })
      .addCase(updateSessionConfig.fulfilled, (state, action) => {
        state.updating = false
        state.config = action.payload
      })
      .addCase(updateSessionConfig.rejected, (state, action) => {
        state.updating = false
        state.updateError = action.payload ?? 'Failed to update session configuration'
      })
  },
})

export const { clearUpdateError } = sessionConfigSlice.actions
export default sessionConfigSlice.reducer
