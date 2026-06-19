export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface ApiError {
  message: string;
  code?: string | number;
}
