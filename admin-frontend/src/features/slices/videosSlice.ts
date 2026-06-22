import { createSlice } from '@reduxjs/toolkit';
import type { RequestStatus } from '../../types/common.types';
import type { VideoReference, VideoIngestResponse } from '../../types/video.types';

interface VideosState {
  items: VideoReference[];
  lastIngestResult: VideoIngestResponse | null;
  status: RequestStatus;
  error: string | null;
}

const initialState: VideosState = {
  items: [],
  lastIngestResult: null,
  status: 'idle',
  error: null,
};

const videosSlice = createSlice({
  name: 'videos',
  initialState,
  reducers: {
    clearVideosError(state) {
      state.error = null;
    },
  },
  // extraReducers: builder => { /* TODO: wire ingestVideos thunk */ }
});

export const { clearVideosError } = videosSlice.actions;
export default videosSlice.reducer;
