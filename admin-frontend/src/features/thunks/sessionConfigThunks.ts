import { createAsyncThunk } from '@reduxjs/toolkit'
import { getSessionConfigApi, updateSessionConfigApi } from '../api/sessionConfigApi'
import { normalizeError } from '../../utils/errorHandler'
import type {
  SessionConfigResponse,
  UpdateSessionConfigRequest,
} from '../../types/api/sessionConfig.types'

export const fetchSessionConfig = createAsyncThunk<
  SessionConfigResponse,
  void,
  { rejectValue: string }
>('sessionConfig/fetch', async (_, { rejectWithValue }) => {
  try {
    return await getSessionConfigApi()
  } catch (err) {
    return rejectWithValue(normalizeError(err).message)
  }
})

export const updateSessionConfig = createAsyncThunk<
  SessionConfigResponse,
  UpdateSessionConfigRequest,
  { rejectValue: string }
>('sessionConfig/update', async (payload, { rejectWithValue }) => {
  try {
    return await updateSessionConfigApi(payload)
  } catch (err) {
    return rejectWithValue(normalizeError(err).message)
  }
})
