import { createAsyncThunk } from '@reduxjs/toolkit';

export const ingestProducts = createAsyncThunk(
  'products/ingest',
  async (files: File[], { rejectWithValue }) => {
    // TODO: return await productService.ingest(files);
  }
);
