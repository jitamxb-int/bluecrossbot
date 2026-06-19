import { createAsyncThunk } from '@reduxjs/toolkit';

export const ingestVideos = createAsyncThunk(
  'videos/ingest',
  async (files: File[], { rejectWithValue }) => {
    // TODO: return await videoService.ingest(files);
  }
);
