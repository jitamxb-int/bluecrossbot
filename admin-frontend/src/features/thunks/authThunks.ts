import { createAsyncThunk } from '@reduxjs/toolkit'
import { changePasswordApi, loginApi } from '../api/authApi'
import { clearTokens, saveAdminEmail, saveTokens } from '../storage/authStorage'
import { normalizeError } from '../../utils/errorHandler'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginResponse,
} from '../../types/api/auth.types'

export const login = createAsyncThunk<
  LoginResponse,
  { email: string; password: string },
  { rejectValue: string }
>('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await loginApi(email, password)
    // Persist tokens + email so the session survives a reload.
    saveTokens(res.data.tokens)
    saveAdminEmail(res.data.user.email)
    return res
  } catch (err) {
    return rejectWithValue(normalizeError(err).message)
  }
})

export const changePassword = createAsyncThunk<
  ChangePasswordResponse,
  ChangePasswordRequest,
  { rejectValue: string }
>('auth/changePassword', async (payload, { rejectWithValue }) => {
  try {
    return await changePasswordApi(payload)
  } catch (err) {
    return rejectWithValue(normalizeError(err).message)
  }
})

// Logout is synchronous local cleanup; a thunk keeps it consistent with the feature.
export const logout = createAsyncThunk<void, void>('auth/logout', async () => {
  clearTokens()
})
