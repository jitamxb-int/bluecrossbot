import { createAsyncThunk } from '@reduxjs/toolkit';
import { getChatMetricsApi, getChatTranscriptsApi, getSessionsApi } from '../api/chatApi';
import { normalizeError } from '../../utils/errorHandler';
import type {
  ChatCountResponse,
  ChatMetricsParams,
  ChatSessionListResponse,
  ChatTranscriptsResponse,
  SessionListParams,
} from '../../types/api/chat.types';

export const fetchChatMetrics = createAsyncThunk<ChatCountResponse, ChatMetricsParams | void, { rejectValue: string }>(
  'chat/fetchMetrics',
  async (params, { rejectWithValue }) => {
    try {
      return await getChatMetricsApi(params ?? {});
    } catch (err) {
      return rejectWithValue(normalizeError(err).message);
    }
  }
);

export const fetchSessions = createAsyncThunk<ChatSessionListResponse, SessionListParams, { rejectValue: string }>(
  'chat/fetchSessions',
  async (params, { rejectWithValue }) => {
    try {
      return await getSessionsApi(params);
    } catch (err) {
      return rejectWithValue(normalizeError(err).message);
    }
  }
);

export const fetchChatTranscripts = createAsyncThunk<ChatTranscriptsResponse, void, { rejectValue: string }>(
  'chat/fetchTranscripts',
  async (_, { rejectWithValue }) => {
    try {
      return await getChatTranscriptsApi();
    } catch (err) {
      return rejectWithValue(normalizeError(err).message);
    }
  }
);
