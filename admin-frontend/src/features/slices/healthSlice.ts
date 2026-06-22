import { createSlice } from '@reduxjs/toolkit';
import type { RequestStatus } from '../../types/common.types';
import type { HealthResponse, ReadinessResponse } from '../../types/health.types';
import { fetchLiveness, fetchReadiness } from '../thunks/healthThunks';

interface HealthState {
  liveness: HealthResponse | null;
  readiness: ReadinessResponse | null;
  livenessStatus: RequestStatus;
  readinessStatus: RequestStatus;
  error: string | null;
}

const initialState: HealthState = {
  liveness: null,
  readiness: null,
  livenessStatus: 'idle',
  readinessStatus: 'idle',
  error: null,
};

const healthSlice = createSlice({
  name: 'health',
  initialState,
  reducers: {
    clearHealthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLiveness.pending, (state) => {
        state.livenessStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchLiveness.fulfilled, (state, action) => {
        state.livenessStatus = 'succeeded';
        state.liveness = action.payload;
      })
      .addCase(fetchLiveness.rejected, (state, action) => {
        state.livenessStatus = 'failed';
        state.error = action.payload ?? 'Failed to fetch liveness.';
      })

      .addCase(fetchReadiness.pending, (state) => {
        state.readinessStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchReadiness.fulfilled, (state, action) => {
        state.readinessStatus = 'succeeded';
        state.readiness = action.payload;
      })
      .addCase(fetchReadiness.rejected, (state, action) => {
        state.readinessStatus = 'failed';
        state.error = action.payload ?? 'Failed to fetch readiness.';
      });
  },
});

export const { clearHealthError } = healthSlice.actions;
export default healthSlice.reducer;
