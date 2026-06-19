import { getItem, setItem, removeItem } from '../../utils/storage';
import { LOCAL_STORAGE_KEYS } from '../../utils/constants';

export function saveProductsFilter(filter: Record<string, unknown>): void {
  setItem(LOCAL_STORAGE_KEYS.PRODUCTS_FILTER, filter);
}

export function loadProductsFilter(): Record<string, unknown> | null {
  return getItem<Record<string, unknown>>(LOCAL_STORAGE_KEYS.PRODUCTS_FILTER);
}

export function clearProductsFilter(): void {
  removeItem(LOCAL_STORAGE_KEYS.PRODUCTS_FILTER);
}
