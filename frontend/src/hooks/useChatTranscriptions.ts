import { useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import type { TextStreamReader } from 'livekit-client';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: number;
}

export function useChatTranscriptions(): ChatMessage[] {
  const room = useRoomContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!room) return;

    const handler = async (
      reader: TextStreamReader,
      participantInfo: { identity: string },
    ) => {
      const segId = reader.info.id;
      const isAgent = participantInfo.identity !== room.localParticipant.identity;

      let text = '';
      for await (const chunk of reader) {
        text += chunk;
        setMessages(prev => upsert(prev, segId, isAgent, text));
      }
    };

    room.registerTextStreamHandler('lk.transcription', handler);
    return () => room.unregisterTextStreamHandler('lk.transcription');
  }, [room]);

  return messages;
}

function upsert(
  prev: ChatMessage[],
  id: string,
  isAgent: boolean,
  text: string,
): ChatMessage[] {
  if (!text.trim()) return prev;
  const msg: ChatMessage = {
    id,
    sender: isAgent ? 'agent' : 'user',
    text,
    timestamp: Date.now(),
  };
  const i = prev.findIndex(m => m.id === id);
  if (i === -1) return [...prev, msg];
  const next = [...prev];
  next[i] = msg;
  return next;
}