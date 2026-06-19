import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectActiveUploads,
  selectIngestionStatus,
  selectIngestionError,
} from '../features/selectors/ingestionSelectors';

export function useIngestion() {
  const dispatch      = useAppDispatch();
  const activeUploads = useAppSelector(selectActiveUploads);
  const status        = useAppSelector(selectIngestionStatus);
  const error         = useAppSelector(selectIngestionError);

  return { activeUploads, status, error, dispatch };
}
