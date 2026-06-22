import type { RootState } from '../../app/store';

export const selectProducts          = (state: RootState) => state.products.items;
export const selectLastProductIngest = (state: RootState) => state.products.lastIngestResult;
export const selectProductsStatus    = (state: RootState) => state.products.status;
export const selectProductsError     = (state: RootState) => state.products.error;
