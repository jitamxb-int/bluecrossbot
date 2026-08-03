import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RequestStatus } from '../../types/common.types';
import type { ChatCountResponse, ChatTranscriptsMap } from '../../types/chat.types';
import type { ChatSessionItem } from '../../types/api/chat.types';
import { currentMonthRange, type DateRange } from '../../utils/dateRange';
import { fetchChatMetrics, fetchChatTranscripts, fetchSessions } from '../thunks/chatThunks';
import { login, logout } from '../thunks/authThunks';

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

  sessionsPage: number;
  sessionsPageSize: number;
  sessionsRange: DateRange;
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

  sessionsPage: 1,
  sessionsPageSize: 10,
  sessionsRange: currentMonthRange(),
};

function resetSessionsUi(state: ChatState) {
  state.sessionsPage = 1;
  state.sessionsPageSize = 10;
  state.sessionsRange = currentMonthRange();
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setSelectedSession(state, action: PayloadAction<string | null>) {
      state.selectedSessionId = action.payload;
    },
    setSessionsPage(state, action: PayloadAction<number>) {
      state.sessionsPage = action.payload;
    },
    setSessionsPageSize(state, action: PayloadAction<number>) {
      state.sessionsPageSize = action.payload;
    },
    setSessionsRange(state, action: PayloadAction<DateRange>) {
      state.sessionsRange = action.payload;
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
      // Reset the sessions list UI on a fresh admin session.
      .addCase(login.fulfilled, resetSessionsUi)
      .addCase(logout.fulfilled, resetSessionsUi)
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

export const {
  setSelectedSession,
  setSessionsPage,
  setSessionsPageSize,
  setSessionsRange,
  clearChatError,
  clearSessionsError,
} = chatSlice.actions;
export default chatSlice.reducer;
