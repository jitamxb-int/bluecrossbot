import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RequestStatus } from '../../types/common.types';
import type { ChatCountResponse, ChatTranscriptsMap } from '../../types/chat.types';
import type { ChatSessionItem } from '../../types/api/chat.types';
import { fetchChatMetrics, fetchChatTranscripts, fetchSessions } from '../thunks/chatThunks';

interface ChatState {
  metrics: ChatCountResponse | null;
  transcripts: ChatTranscriptsMap['transcripts'];
  selectedSessionId: string | null;
  status: RequestStatus;
  error: string | null;

  sessions: ChatSessionItem[];
  sessionTotal: number;
  sessionsStatus: RequestStatus;
  sessionsError: string | null;
}

const initialState: ChatState = {
  metrics: null,
  transcripts: {},
  selectedSessionId: null,
  status: 'idle',
  error: null,

  sessions: [],
  sessionTotal: 0,
  sessionsStatus: 'idle',
  sessionsError: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSelectedSession(state, action: PayloadAction<string | null>) {
      state.selectedSessionId = action.payload;
    },
    clearChatError(state) {
      state.error = null;
    },
    clearSessionsError(state) {
      state.sessionsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // metrics
      .addCase(fetchChatMetrics.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchChatMetrics.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.metrics = action.payload;
      })
      .addCase(fetchChatMetrics.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Failed to load chat metrics';
      })
      // transcripts
      .addCase(fetchChatTranscripts.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchChatTranscripts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.transcripts = action.payload.transcripts as unknown as ChatTranscriptsMap['transcripts'];
      })
      .addCase(fetchChatTranscripts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Failed to load transcripts';
      })
      // sessions list
      .addCase(fetchSessions.pending, (state) => {
        state.sessionsStatus = 'loading';
        state.sessionsError = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.sessionsStatus = 'succeeded';
        state.sessions = action.payload.sessions;
        state.sessionTotal = action.payload.total;
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.sessionsStatus = 'failed';
        state.sessionsError = action.payload ?? 'Failed to load sessions';
      });
  },
});

export const { setSelectedSession, clearChatError, clearSessionsError } = chatSlice.actions;
export default chatSlice.reducer;
