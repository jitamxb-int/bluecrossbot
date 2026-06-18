import React, { useEffect, useRef, useState } from 'react';
import { FlashcardBlock } from './Flashcard'; 

// 1. UPDATE THE INTERFACE HERE
export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  // New fields for handling Flashcards
  type: 'text' | 'flashcard'; 
  text?: string;               // Text is now optional (flashcards might not have text)
  cardData?: {                 // Data for the flashcard
    title: string;
    value: string;
  };
  isInterim?: boolean;
  timestamp?: number;
}

interface ChatListProps {
  messages: ChatMessage[];
}

// --------------------------------------------------------------------------
// Helper: Typewriter Component
// --------------------------------------------------------------------------
const TypewriterText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 10 }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayedText(''); 
    
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayedText}</span>;
};

// --------------------------------------------------------------------------
// Main ChatList Component
// --------------------------------------------------------------------------
export const ChatList: React.FC<ChatListProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div 
      className="flex-1 w-full overflow-y-auto px-4 custom-scrollbar font-sans"
      style={{
        // Remove the fade masks so the scroll behavior is consistent with the design.
        maskImage: 'none',
        WebkitMaskImage: 'none',
      }}
    >
      <div className="w-full max-w-[95%] mx-auto flex flex-col pt-20 pb-32 gap-6">
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 opacity-30">
               <div className="w-12 h-1 bg-zinc-300 rounded-full" />
               <p className="text-sm text-zinc-500 font-medium font-mono uppercase tracking-widest">
                 System Ready
               </p>
            </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isInterim = msg.isInterim;

          // --- FLASHCARD RENDER ---
          // Now TypeScript knows 'type' and 'cardData' exist because we updated the interface above
          if (msg.type === 'flashcard' && msg.cardData) {
            return (
              <div key={msg.id} className="flex w-full justify-start pl-4 animate-in fade-in slide-in-from-bottom-2">
                 {/* Render the Flashcard Component Inline */}
                 <FlashcardBlock data={msg.cardData} />
              </div>
            );
          }
          
          // --- TEXT RENDER (Standard) ---
          // We only render this block if there is actual text to show
          if (!msg.text) return null;

          return (
            <div 
              key={msg.id} 
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`
                  relative max-w-[78%] px-5 py-4 text-base leading-relaxed rounded-3xl
                  shadow-[0_12px_35px_rgba(0,0,0,0.22)] transition-all duration-300 border
                  ${isInterim ? 'opacity-80 scale-[0.99]' : 'opacity-100 scale-100 animate-fade-in-up'}
                  ${isUser 
                    ? `max-w-[70%] bg-gradient-to-br from-sky-500 to-blue-600 text-white border-transparent rounded-tr-[28px]`
                    : `bg-white text-slate-900 border-white/10 rounded-tl-[28px]`
                  }
                `}
                style={{ wordBreak: 'break-word' }}
              >
                 {!isUser && (
                   <div className="flex items-center gap-2 mb-2 text-[10px] font-semibold tracking-widest text-emerald-500">
                     <span className="h-2 w-2 rounded-full bg-emerald-400" />
                     INT. AI
                   </div>
                 )}

                 <div className={isUser ? 'font-semibold' : 'font-normal'}>
                    {(!isUser && !isInterim && msg.text) ? (
                       <TypewriterText text={msg.text} speed={15} />
                    ) : (
                       msg.text
                    )}
                 </div>
              </div>
            </div>
          );
        })}
        
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};