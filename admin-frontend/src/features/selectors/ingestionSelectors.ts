import type { RootState } from '../../app/store';

export const selectActiveUploads  = (state: RootState) => state.ingestion.activeUploads;
export const selectIngestionStatus = (state: RootState) => state.ingestion.status;
export const selectIngestionError  = (state: RootState) => state.ingestion.error;
