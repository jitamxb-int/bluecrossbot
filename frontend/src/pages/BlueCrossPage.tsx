import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
    LiveKitRoom,
    RoomAudioRenderer,
    StartAudio,
    useVoiceAssistant,
    useLocalParticipant,
} from '@livekit/components-react';
import { useChatTranscriptions } from '@/hooks/useChatTranscriptions';
import { Track } from 'livekit-client';
import { BlueCrossUI } from '@/components/livekit_bank/bluecross/BlueCrossUI';
import { VisualizerSection } from '@/components/livekit/Visualizer';
import { ChatList } from '@/components/livekit/Chatlist';
import { Mic, MicOff, PhoneOff, X, MessageSquare, Loader2, Send } from 'lucide-react';
import PratikshaSVG from '@/components/assets/bluecross/PratikshaSVG.png';
/* ── CONFIG ───────────────────────────────────────────────────────── */

const BACKEND_URL    = import.meta.env?.VITE_VOICEKIT_URL || 'https://voicekit-api.indusnettechnologies.com';
const LIVEKIT_URL    = import.meta.env?.VITE_LIVEKIT_URL  || '';
const TOKEN_ENDPOINT = `${BACKEND_URL}/api/web-call/get-token`;

const ASSISTANT_ID = '627aea4b-b44d-4567-8ef0-64a879f5ee77';
const USER_ID      = '69a025c0909fa360aa2e8491';

// Brand colours — blue only, no red
const BLUE   = '#1B3D8F';
const BLUE_L = '#3A6BC4';
const BLUE_X = '#EEF3FB';

/* ── TIMER ACCOUNTS ───────────────────────────────────────────────── */

/* ── TIMER ACCOUNTS in BlueCrossPage.tsx ────────────────────────── */
const TIMER_ACCOUNTS = [
    'test@intglobal.com',
    'test_luping@gmail.com',
    'test_sentis@gmail.com',
    'test_neuland@gmail.com',
    'test_rpgls@gmail.com',
    'test_serovia@intglobal.com',
    'test_afli@gmail.com',
    'test_blue@gmail.com', 
    'test_employ@gmail.com',
    'test_aludecor@gmail.com',
];

/* ── TYPES ────────────────────────────────────────────────────────── */

type VisualizerState = 'speaking' | 'listening' | 'connected' | 'disconnected';

function mapAgentState(s: string): VisualizerState {
    if (s === 'connecting') return 'connected';
    if (['speaking', 'listening', 'connected', 'disconnected'].includes(s)) return s as VisualizerState;
    return 'connected';
}

/* ── PRAKSHA AVATAR ──────────────────────────────────────────────────── */
// Replace the inner content with <img src={prakshaAvatar} ... /> once you have the asset.

const PratikshaAvatar: React.FC = () => (
    <div
        className="relative w-28 h-28 rounded-full p-[3px] shadow-xl"
        style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)` }}
    >
        <div
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ background: BLUE_X }}
        >
            {/* Blue cross icon */}
            <div className="relative w-10 h-10">
                <img src={PratikshaSVG} alt="Pratiksha" className="w-full h-full object-cover object-top" />
            </div>
        </div>
        {/* Pulse ring */}
        <span
            className="absolute inset-0 rounded-full opacity-20 animate-ping"
            style={{ background: BLUE }}
        />
    </div>
);

/* ── STANDBY CARD ─────────────────────────────────────────────────── */

const AriaStandbyCard: React.FC<{
    onConnect:  () => void;
    onClose:    () => void;
    connecting: boolean;
}> = ({ onConnect, onClose, connecting }) => (
    <div
        className="w-80 rounded-2xl overflow-hidden shadow-2xl border"
        style={{ background: 'white', borderColor: '#DDEAFF' }}
    >
        {/* Blue header bar */}
        <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{ background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE_L} 100%)` }}
        >
            <div className="flex items-center gap-2">
                {/* Small cross icon */}
                <div className="w-5 h-5 relative shrink-0">
                    <img src={PratikshaSVG} alt="Pratiksha" className="w-full h-full object-cover object-top rounded-sm" />
                </div>
                <span className="font-black text-white text-sm tracking-wide">Pratiksha · Blue Cross AI</span>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                <X size={17} />
            </button>
        </div>

        <div className="flex flex-col items-center gap-5 px-6 pt-8 pb-7">
            <PratikshaAvatar />

            <div className="text-center">
                <p className="font-semibold text-base" style={{ color: '#1A2942' }}>Hello! I'm Pratiksha 👋</p>
                <p className="text-sm mt-1.5 leading-snug text-slate-400">
                    Your Blue Cross Laboratories pharmaceutical assistant.
                    Ask me about products, therapy areas, or global operations.
                </p>
            </div>

            <button
                onClick={onConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl
                    font-bold text-white text-base transition-all
                    hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                    background: connecting
                        ? `${BLUE}80`
                        : `linear-gradient(90deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                    boxShadow: connecting ? 'none' : `0 4px 20px rgba(27,61,143,0.30)`,
                }}
            >
                {connecting
                    ? <><Loader2 size={20} className="animate-spin" />Connecting…</>
                    : <><Mic size={20} />Start Conversation</>
                }
            </button>
        </div>
    </div>
);
/* ── SHARED MESSAGE BUBBLE ────────────────────────────────────────── */
const MessageBubble = ({ msg }: { msg: { role: 'user' | 'bot'; text: string } }) => (
    <div style={{
        display: 'flex',
        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
        animation: 'slideIn 0.25s ease-out forwards',
    }}>
        <div style={{
            maxWidth: '85%',
            padding: '10px 14px',
            borderRadius: '14px',
            fontSize: '13.5px',
            lineHeight: '1.5',
            wordWrap: 'break-word',
            backgroundColor: msg.role === 'user' ? BLUE : '#fff',
            color: msg.role === 'user' ? '#fff' : '#1A2942',
            border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
            boxShadow: msg.role === 'user'
                ? `0 2px 8px rgba(27,61,143,0.18)`
                : '0 1px 2px rgba(0,0,0,0.05)',
            borderBottomRightRadius: msg.role === 'user' ? '2px' : '14px',
            borderBottomLeftRadius: msg.role === 'bot'  ? '2px' : '14px',
        }}>
            {msg.text}
        </div>
    </div>
);
/* ── VOICE ASSISTANT OVERLAY ──────────────────────────────────────── */

const VoiceAssistantOverlay: React.FC<{ onDisconnect: () => void }> = ({ onDisconnect }) => {
    const { localParticipant } = useLocalParticipant();
    const liveTranscriptions = useChatTranscriptions();
    
    const [inputText, setInputText] = useState('');
    const [userMessages, setUserMessages] = useState<Array<{ role: 'user'; text: string; timestamp: number }>>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Ensure microphone is disabled since this is a chat-only interface
    useEffect(() => {
        if (localParticipant) {
            localParticipant.setMicrophoneEnabled(false);
        }
    }, [localParticipant]);

    // Merge manually typed messages with voice transcriptions, sorted by time
    const allMessages = useMemo(() => {
        const transcribed = liveTranscriptions.map(m => ({
            role: (m.sender === 'user' ? 'user' : 'bot') as 'user' | 'bot',
            text: m.text,
            timestamp: m.timestamp,
        }));
        return [...userMessages, ...transcribed].sort((a, b) => a.timestamp - b.timestamp);
    }, [userMessages, liveTranscriptions]);

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [allMessages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !localParticipant) return;
        
        const text = inputText.trim();
        
        // Optimistically add user's message to the local state
        setUserMessages(prev => [...prev, { role: 'user', text, timestamp: Date.now() }]);
        
        try {
            // Send the text message via LiveKit data channel
            await localParticipant.sendText(text, { topic: 'lk.chat' });
            setInputText('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div 
            className="w-[650px] h-[750px] rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
            style={{ background: 'white', borderColor: '#DDEAFF' }}
        >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE_L} 100%)` }}
                >
                    <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.9)]" />
                        <span className="font-black text-white text-base tracking-widest uppercase">Pratiksha Chat</span>
                    </div>
                    <button 
                        onClick={onDisconnect} 
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <span className="text-xs font-semibold uppercase tracking-wider">End</span>
                        <X size={18} />
                    </button>
                </div>

                {/* Chat Message List */}
                <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/50">
                    {allMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                            <MessageSquare size={32} className="opacity-20" />
                            <p className="text-sm font-medium">Send a message to start the conversation.</p>
                        </div>
                    ) : (
                        <>
                            {allMessages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Chat Input Area */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type your message to Pratiksha..."
                            className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="h-12 w-12 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                            style={{ background: BLUE }}
                        >
                            <Send size={18} className="ml-1" />
                        </button>
                    </form>
                </div>
            </div>

            {/* Animation styling for the chat bubbles */}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
/* ── PAGE ROOT ────────────────────────────────────────────────────── */

/* ── PAGE ROOT ────────────────────────────────────────────────────── */

export default function BlueCrossPage({
    authUser,
    onSignOut,
}: {
    authUser: any;
    onSignOut: () => void;
}) {
    const [token,      setToken]      = useState<string>('');
    const [connecting, setConnecting] = useState(false);
    const [timeLeft,   setTimeLeft]   = useState<string>('');

    /* Session timer */
    useEffect(() => {
        // 1. Guard: only run if there is an auth user and they are in the test list
        if (!authUser || !TIMER_ACCOUNTS.includes(authUser.email)) return;

        // Use the v2 key to match HeroSection and ignore old broken 167h caches
        const storageKey = `test_session_expiry_v2_${authUser.email}`;
        let expiryTime = parseInt(localStorage.getItem(storageKey) || "0", 10);

        // 2. If no valid timer is running, start a strict 4-hour countdown RIGHT NOW.
        // We completely ignore authUser.sessionExpiresAt to guarantee identical behavior.
        if (!expiryTime || expiryTime < Date.now()) {
            const FOUR_HOURS_IN_MS = 4 * 60 * 60 * 1000;
            expiryTime = Date.now() + FOUR_HOURS_IN_MS;
            
            localStorage.setItem(storageKey, expiryTime.toString());
        }

        const calculateTime = () => {
            const now = Date.now();
            const distance = expiryTime - now;
            
            // 3. Time is up
            if (distance <= 0) {
                setTimeLeft('Expired');
                localStorage.removeItem(storageKey);
                onSignOut();
                return false;
            }
            
            // 4. Calculate remaining time
            const hours = Math.floor(distance / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
            return true;
        };

        const active = calculateTime();
        if (active) {
            const interval = setInterval(calculateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [authUser, onSignOut]);

    /* Connect */
    const handleConnect = useCallback(async () => {
        setConnecting(true);
        try {
            const res = await fetch(TOKEN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: USER_ID, assistant_id: ASSISTANT_ID, text_only: true }),
                mode: 'cors',
            });

            if (!res.ok) throw new Error(`Server returned ${res.status}: ${res.statusText}`);

            const text = await res.text();
            let tok = text;
            try {
                const d = JSON.parse(text);
                if (d.token)           tok = d.token;
                else if (d.data?.token) tok = d.data.token;
            } catch { /* use raw text */ }

            if (!tok?.trim()) throw new Error('Received empty token');
            setToken(tok);
        } catch (err: any) {
            console.error('Connection failed:', err);
            alert(`Failed to connect: ${err.message}`);
        } finally {
            setConnecting(false);
        }
    }, []);

    /* Disconnect */
    const handleDisconnect = useCallback(() => {
        setToken('');
    }, []);

    return (
        <LiveKitRoom
            video={false}
            audio={false} // <-- Change this to false so the mic is never requested
            token={token}
            connect={!!token}
            serverUrl={LIVEKIT_URL}
            data-lk-theme="default"
            style={{ height: '100vh' }}
            onError={(err) => { console.error(err); alert(err.message); setToken(''); }}
            onDisconnected={handleDisconnect}
        >
            <BlueCrossUI authUser={authUser} timeLeft={timeLeft}>
                {token ? (
                    <VoiceAssistantOverlay onDisconnect={handleDisconnect} />
                ) : (
                    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
                        {/* Floating trigger button that connects directly */}
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="group relative w-16 h-16 rounded-full flex items-center justify-center
                                transition-transform hover:scale-110 active:scale-95
                                disabled:opacity-80 disabled:cursor-not-allowed border-4 border-white/80 shadow-xl"
                            style={{
                                background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                                boxShadow: `0 6px 28px rgba(27,61,143,0.50)`,
                            }}
                        >
                            {/* Tooltip */}
                            <span
                                className="absolute right-full mr-4 px-3 py-1.5 rounded-lg text-xs font-bold
                                    whitespace-nowrap opacity-0 group-hover:opacity-100
                                    transition-opacity pointer-events-none border shadow-sm bg-white"
                                style={{ color: BLUE, borderColor: `${BLUE}25` }}
                            >
                                {connecting ? 'Connecting...' : 'Chat with Pratiksha'}
                            </span>

                            {connecting ? (
                                <Loader2 size={24} className="text-white animate-spin relative z-10" />
                            ) : (
                                <>
                                    {/* Blue cross icon */}
                                    <div className="relative w-7 h-7">
                                        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2 h-full bg-white rounded-sm" />
                                        <div className="absolute top-1/2 -translate-y-1/2 left-0 h-2 w-full bg-white rounded-sm" />
                                    </div>

                                    {/* Pulse ring */}
                                    <span
                                        className="absolute inset-0 rounded-full opacity-25 animate-ping"
                                        style={{ background: BLUE_L }}
                                    />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </BlueCrossUI>
        </LiveKitRoom>
    );
}