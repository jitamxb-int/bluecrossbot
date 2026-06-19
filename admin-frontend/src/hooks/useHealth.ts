import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchLiveness, fetchReadiness } from '../features/thunks/healthThunks';
import {
  selectLiveness,
  selectReadiness,
  selectLivenessStatus,
  selectReadinessStatus,
  selectHealthError,
  selectIsBackendReady,
} from '../features/selectors/healthSelectors';

export function useHealth(autoFetch = true) {
  const dispatch = useAppDispatch();

  const liveness        = useAppSelector(selectLiveness);
  const readiness       = useAppSelector(selectReadiness);
  const livenessStatus  = useAppSelector(selectLivenessStatus);
  const readinessStatus = useAppSelector(selectReadinessStatus);
  const error           = useAppSelector(selectHealthError);
  const isReady         = useAppSelector(selectIsBackendReady);

  useEffect(() => {
    if (!autoFetch) return;
    dispatch(fetchLiveness());
    dispatch(fetchReadiness());
  }, [autoFetch, dispatch]);

  const refetch = () => {
    dispatch(fetchLiveness());
    dispatch(fetchReadiness());
  };

  return {
    liveness,
    readiness,
    livenessStatus,
    readinessStatus,
    error,
    isReady,
    refetch,
  };
}
