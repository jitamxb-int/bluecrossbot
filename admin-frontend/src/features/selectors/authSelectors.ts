import type { RootState } from '../../app/store'

export const selectAuthUser        = (state: RootState) => state.auth.user
export const selectAuthenticated   = (state: RootState) => state.auth.authenticated
export const selectLoginStatus     = (state: RootState) => state.auth.loginStatus
export const selectLoginError      = (state: RootState) => state.auth.loginError
export const selectChanging        = (state: RootState) => state.auth.changing
export const selectChangeError     = (state: RootState) => state.auth.changeError
