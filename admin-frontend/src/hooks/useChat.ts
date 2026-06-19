import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectChatMetrics,
  selectChatTranscripts,
  selectChatStatus,
  selectChatError,
} from '../features/selectors/chatSelectors';

export function useChat() {
  const dispatch    = useAppDispatch();
  const metrics     = useAppSelector(selectChatMetrics);
  const transcripts = useAppSelector(selectChatTranscripts);
  const status      = useAppSelector(selectChatStatus);
  const error       = useAppSelector(selectChatError);

  return { metrics, transcripts, status, error, dispatch };
}
