import type { RootState } from '../../app/store';

export const selectChatMetrics        = (state: RootState) => state.chat.metrics;
export const selectChatTranscripts    = (state: RootState) => state.chat.transcripts;
export const selectSelectedSessionId  = (state: RootState) => state.chat.selectedSessionId;
export const selectChatStatus         = (state: RootState) => state.chat.status;
export const selectChatError          = (state: RootState) => state.chat.error;

export const selectSessions           = (state: RootState) => state.chat.sessions;
export const selectSessionTotal       = (state: RootState) => state.chat.sessionTotal;
export const selectSessionsStatus     = (state: RootState) => state.chat.sessionsStatus;
export const selectSessionsError      = (state: RootState) => state.chat.sessionsError;
