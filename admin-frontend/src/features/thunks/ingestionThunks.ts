import { createAsyncThunk } from '@reduxjs/toolkit';

export const ingestProductFiles = createAsyncThunk(
  'ingestion/ingestProducts',
  async (files: File[], { rejectWithValue }) => {
    // TODO: return await ingestionService.uploadProducts(files);
  }
);

export const ingestVideoFiles = createAsyncThunk(
  'ingestion/ingestVideos',
  async (files: File[], { rejectWithValue }) => {
    // TODO: return await ingestionService.uploadVideos(files);
  }
);
