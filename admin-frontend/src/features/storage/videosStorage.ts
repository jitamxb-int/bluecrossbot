import { getItem, setItem, removeItem } from '../../utils/storage';
import { LOCAL_STORAGE_KEYS } from '../../utils/constants';

export function saveVideosFilter(filter: Record<string, unknown>): void {
  setItem(LOCAL_STORAGE_KEYS.VIDEOS_FILTER, filter);
}

export function loadVideosFilter(): Record<string, unknown> | null {
  return getItem<Record<string, unknown>>(LOCAL_STORAGE_KEYS.VIDEOS_FILTER);
}

export function clearVideosFilter(): void {
  removeItem(LOCAL_STORAGE_KEYS.VIDEOS_FILTER);
}
