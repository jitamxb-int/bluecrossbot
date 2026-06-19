import { createAsyncThunk } from '@reduxjs/toolkit'
import { getLivenessApi, getReadinessApi } from '../api/healthApi'
import { normalizeError } from '../../utils/errorHandler'
import type { HealthResponse, ReadinessResponse } from '../../types/api/health.types'

export const fetchLiveness = createAsyncThunk<HealthResponse, void, { rejectValue: string }>(
  'health/fetchLiveness',
  async (_, { rejectWithValue }) => {
    try {
      return await getLivenessApi()
    } catch (err) {
      return rejectWithValue(normalizeError(err).message)
    }
  },
)

export const fetchReadiness = createAsyncThunk<ReadinessResponse, void, { rejectValue: string }>(
  'health/fetchReadiness',
  async (_, { rejectWithValue }) => {
    try {
      return await getReadinessApi()
    } catch (err) {
      return rejectWithValue(normalizeError(err).message)
    }
  },
)
