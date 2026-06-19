import type { ApiError } from '../types/common.types';

export function normalizeError(error: unknown): ApiError {
  // TODO: extract message from axios error, Error instance, or unknown
  if (error instanceof Error) return { message: error.message };
  return { message: 'An unexpected error occurred.' };
}
