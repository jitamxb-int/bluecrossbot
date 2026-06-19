import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectVideos,
  selectVideosStatus,
  selectVideosError,
  selectLastVideoIngest,
} from '../features/selectors/videosSelectors';

export function useVideos() {
  const dispatch   = useAppDispatch();
  const items      = useAppSelector(selectVideos);
  const status     = useAppSelector(selectVideosStatus);
  const error      = useAppSelector(selectVideosError);
  const lastIngest = useAppSelector(selectLastVideoIngest);

  return { items, status, error, lastIngest, dispatch };
}
