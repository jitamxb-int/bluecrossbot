import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RequestStatus } from '../../types/common.types';

interface IngestionState {
  activeUploads: string[];
  status: RequestStatus;
  error: string | null;
}

const initialState: IngestionState = {
  activeUploads: [],
  status: 'idle',
  error: null,
};

const ingestionSlice = createSlice({
  name: 'ingestion',
  initialState,
  reducers: {
    addUpload(state, action: PayloadAction<string>) {
      state.activeUploads.push(action.payload);
    },
    removeUpload(state, action: PayloadAction<string>) {
      state.activeUploads = state.activeUploads.filter(id => id !== action.payload);
    },
    clearIngestionError(state) {
      state.error = null;
    },
  },
  // extraReducers: builder => { /* TODO: wire ingestProductFiles, ingestVideoFiles thunks */ }
});

export const { addUpload, removeUpload, clearIngestionError } = ingestionSlice.actions;
export default ingestionSlice.reducer;
