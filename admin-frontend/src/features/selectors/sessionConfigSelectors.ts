import type { RootState } from '../../app/store'

export const selectSessionConfig      = (state: RootState) => state.sessionConfig.config
export const selectConfigFetchStatus  = (state: RootState) => state.sessionConfig.fetchStatus
export const selectConfigFetchError   = (state: RootState) => state.sessionConfig.fetchError
export const selectConfigUpdating     = (state: RootState) => state.sessionConfig.updating
export const selectConfigUpdateError  = (state: RootState) => state.sessionConfig.updateError
