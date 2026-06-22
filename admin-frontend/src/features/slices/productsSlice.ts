import { createSlice } from '@reduxjs/toolkit';
import type { RequestStatus } from '../../types/common.types';
import type { ProductReference, ProductIngestResponse } from '../../types/product.types';

interface ProductsState {
  items: ProductReference[];
  lastIngestResult: ProductIngestResponse | null;
  status: RequestStatus;
  error: string | null;
}

const initialState: ProductsState = {
  items: [],
  lastIngestResult: null,
  status: 'idle',
  error: null,
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearProductsError(state) {
      state.error = null;
    },
  },
  // extraReducers: builder => { /* TODO: wire ingestProducts thunk */ }
});

export const { clearProductsError } = productsSlice.actions;
export default productsSlice.reducer;
