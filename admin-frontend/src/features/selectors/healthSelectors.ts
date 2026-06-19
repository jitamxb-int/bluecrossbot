import type { RootState } from '../../app/store';

export const selectLiveness         = (state: RootState) => state.health.liveness;
export const selectReadiness        = (state: RootState) => state.health.readiness;
export const selectLivenessStatus   = (state: RootState) => state.health.livenessStatus;
export const selectReadinessStatus  = (state: RootState) => state.health.readinessStatus;
export const selectHealthError      = (state: RootState) => state.health.error;

export const selectIsBackendReady   = (state: RootState) =>
  state.health.readiness?.status === 'ready';
