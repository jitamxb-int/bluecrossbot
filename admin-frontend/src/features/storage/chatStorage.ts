import { getItem, setItem, removeItem } from '../../utils/storage';
import { LOCAL_STORAGE_KEYS } from '../../utils/constants';

export function saveChatFilter(filter: Record<string, unknown>): void {
  setItem(LOCAL_STORAGE_KEYS.CHAT_FILTER, filter);
}

export function loadChatFilter(): Record<string, unknown> | null {
  return getItem<Record<string, unknown>>(LOCAL_STORAGE_KEYS.CHAT_FILTER);
}

export function clearChatFilter(): void {
  removeItem(LOCAL_STORAGE_KEYS.CHAT_FILTER);
}
