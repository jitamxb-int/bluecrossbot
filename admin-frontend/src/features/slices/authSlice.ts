import { createSlice } from '@reduxjs/toolkit'
import type { RequestStatus } from '../../types/common.types'
import type { AdminInfo } from '../../types/api/auth.types'
import { getAdminEmail, isAuthenticated } from '../storage/authStorage'
import { changePassword, login, logout } from '../thunks/authThunks'

interface AuthState {
  user: AdminInfo | null
  authenticated: boolean
  loginStatus: RequestStatus
  loginError: string | null
  changing: boolean
  changeError: string | null
}

// Seed from persisted storage so a reload keeps the admin logged in.
const storedEmail = getAdminEmail()
const initialState: AuthState = {
  user: storedEmail ? { email: storedEmail } : null,
  authenticated: isAuthenticated(),
  loginStatus: 'idle',
  loginError: null,
  changing: false,
  changeError: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearLoginError(state) {
      state.loginError = null
    },
    clearChangeError(state) {
      state.changeError = null
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending, (state) => {
        state.loginStatus = 'loading'
        state.loginError = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loginStatus = 'succeeded'
        state.authenticated = true
        state.user = action.payload.data.user
      })
      .addCase(login.rejected, (state, action) => {
        state.loginStatus = 'failed'
        state.loginError = action.payload ?? 'Login failed'
      })
      // change password
      .addCase(changePassword.pending, (state) => {
        state.changing = true
        state.changeError = null
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.changing = false
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.changing = false
        state.changeError = action.payload ?? 'Failed to change password'
      })
      // logout
      .addCase(logout.fulfilled, (state) => {
        state.authenticated = false
        state.user = null
        state.loginStatus = 'idle'
        state.loginError = null
      })
  },
})

export const { clearLoginError, clearChangeError } = authSlice.actions
export default authSlice.reducer
