import { useState } from 'react';
import { PAGINATION_DEFAULTS } from '../utils/constants';

export function usePagination(initialPageSize = PAGINATION_DEFAULTS.PAGE_SIZE) {
  const [page, setPage]         = useState(PAGINATION_DEFAULTS.PAGE);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const goToPage = (n: number) => setPage(n);
  const reset    = () => setPage(PAGINATION_DEFAULTS.PAGE);

  return { page, pageSize, goToPage, setPageSize, reset };
}
