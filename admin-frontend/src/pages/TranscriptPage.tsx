import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Hash, MessageSquare, Clock, Bot, User, Loader2, X } from 'lucide-react';
import AdminLayout from '../components/layout/AdminLayout';
import { Button } from '../components/ui/button';
import { TooltipProvider } from '../components/ui/tooltip';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchChatTranscripts } from '../features/thunks/chatThunks';
import { createFeedback, fetchAllFeedbacks } from '../features/thunks/feedbackThunks';
import {
    selectChatTranscripts,
    selectChatStatus,
    selectChatError,
    selectSessions,
} from '../features/selectors/chatSelectors';
import {
    selectFeedbacks,
    selectCreating,
    selectCreateError,
} from '../features/selectors/feedbackSelectors';
import { clearCreateError } from '../features/slices/feedbackSlice';
import { formatMinutes } from '../utils/formatters';

const TranscriptPage = () => {
    const navigate = useNavigate();
    const { sessionId } = useParams<{ sessionId: string }>();

    const dispatch = useAppDispatch();
    const location = useLocation();
    const transcripts = useAppSelector(selectChatTranscripts);
    const status = useAppSelector(selectChatStatus);
    const error = useAppSelector(selectChatError);
    const sessions = useAppSelector(selectSessions);
    const allFeedbacks = useAppSelector(selectFeedbacks);
    const creating = useAppSelector(selectCreating);
    const createError = useAppSelector(selectCreateError);

    const [showPopover, setShowPopover] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [comment, setComment] = useState('');
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [highlightFeedbackId] = useState<string | null>(location.state?.feedbackId ?? null);

    useEffect(() => {
        if (Object.keys(transcripts).length === 0) {
            dispatch(fetchChatTranscripts());
        }
        dispatch(fetchAllFeedbacks());
    }, [dispatch]);

    const messages = sessionId ? (transcripts[sessionId] ?? null) : null;
    const sessionMeta = sessions.find((s) => s.session_id === sessionId);
    const sessionFeedbacks = allFeedbacks.filter((f) => f.session_id === sessionId);

    useEffect(() => {
        if (!highlightFeedbackId || allFeedbacks.length === 0 || !messages) return;
        const el = document.getElementById(`msg-highlight-${highlightFeedbackId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightFeedbackId, allFeedbacks, messages]);

    // Feedback-popover drag handling. Kept above the early returns below so hook
    // order stays constant across renders (React Rules of Hooks).
    useEffect(() => {
        if (!dragging) return;
        const onMove = (e: MouseEvent) => {
            const x = Math.min(Math.max(e.clientX - dragOffset.current.x, 0), window.innerWidth - 320);
            const y = Math.min(Math.max(e.clientY - dragOffset.current.y, 0), window.innerHeight - 60);
            setPopoverPos({ x, y });
        };
        const onUp = () => setDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragging]);

    if (status === 'loading' && Object.keys(transcripts).length === 0) {
        return (
            <AdminLayout>
                <div className="p-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground mt-2">Loading transcript...</p>
                </div>
            </AdminLayout>
        );
    }

    if (status === 'succeeded' && messages === null) {
        return (
            <AdminLayout>
                <div className="p-20 text-center">
                    <p className="text-muted-foreground">No transcript found for this session.</p>
                    <Button onClick={() => navigate('/chat')} className="mt-4">Back to Sessions</Button>
                </div>
            </AdminLayout>
        );
    }

    const messageCount = messages?.length ?? 0;
    const duration = sessionMeta?.duration_seconds ?? 0;
    const startedAt = sessionMeta?.started_at;

    const handleMouseUp = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (text && text.length > 2) {
            // `fixed` positioning is viewport-relative, so use raw clientX/clientY
            // (no scroll offset). Clamp so the popover always opens fully on-screen.
            setPopoverPos({
                x: Math.min(e.clientX, window.innerWidth - 340),
                y: Math.min(e.clientY + 12, window.innerHeight - 260),
            });
            setSelectedText(text);
            setComment('');
            dispatch(clearCreateError());
            setShowPopover(true);
        }
    };

    // Drag the feedback popover by its header so the transcript underneath stays
    // visible while writing feedback.
    const startDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        dragOffset.current = { x: e.clientX - popoverPos.x, y: e.clientY - popoverPos.y };
        setDragging(true);
    };

    const handleSubmitComment = async () => {
        if (!comment.trim() || !sessionId) return;
        const result = await dispatch(createFeedback({
            session_id: sessionId,
            original_text: selectedText,
            feedback_text: comment,
        }));
        if (createFeedback.fulfilled.match(result)) {
            setShowPopover(false);
            navigate("/ai-feedback-log");
        }
    };

    return (
        <AdminLayout>
            <TooltipProvider>
                <div className="container mx-auto p-6 max-w-5xl">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-8">
                        <Button variant="ghost" onClick={() => navigate(-1)}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mb-6">
                            {error}
                        </div>
                    )}

                    {/* Session Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white border p-4 rounded-xl flex items-center gap-4 shadow-sm">
                            <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                                <Hash className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Session ID</p>
                                <p className="font-semibold text-sm font-mono truncate">{sessionId}</p>
                            </div>
                        </div>

                        <div className="bg-white border p-4 rounded-xl flex items-center gap-4 shadow-sm">
                            <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Messages</p>
                                <p className="font-semibold text-sm">{messageCount}</p>
                            </div>
                        </div>

                        <div className="bg-white border p-4 rounded-xl flex items-center gap-4 shadow-sm">
                            <div className="bg-green-50 p-2 rounded-lg text-green-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                    {startedAt ? 'Started At' : 'Duration'}
                                </p>
                                <p className="font-semibold text-sm">
                                    {startedAt
                                        ? new Date(startedAt).toLocaleString()
                                        : duration > 0
                                            ? formatMinutes(duration / 60)
                                            : '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Transcript Panel */}
                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b px-6 py-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Chat Transcript</h2>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                Highlight any AI text to leave feedback.
                            </p>
                        </div>

                        <div className="p-6 space-y-4 min-h-[400px]">
                            {!messages || messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
                                    <p className="text-sm">No transcript available for this session.</p>
                                </div>
                            ) : (
                                messages.map((m, i) => {
                                    const isBot = m.role === 'assistant';
                                    const matchingFeedbacks = sessionFeedbacks.filter(
                                        (f) => isBot && m.content.includes(f.original_text.trim())
                                    );
                                    const isHighlighted = matchingFeedbacks.some((f) => f.id === highlightFeedbackId);
                                    const hasFeedback = matchingFeedbacks.length > 0;
                                    return (
                                        <div key={i} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`flex gap-3 max-w-[80%] ${isBot ? 'flex-row' : 'flex-row-reverse'}`}>
                                                <div
                                                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white ${isBot ? 'bg-slate-800' : 'bg-blue-600'
                                                        }`}
                                                >
                                                    {isBot ? <Bot size={15} /> : <User size={15} />}
                                                </div>
                                                <div
                                                    id={isHighlighted ? `msg-highlight-${highlightFeedbackId}` : undefined}
                                                    onMouseUp={isBot ? handleMouseUp : undefined}
                                                    className={`p-4 rounded-2xl text-sm shadow-sm select-text relative ${isBot
                                                            ? `bg-slate-100 rounded-tl-none cursor-text ${isHighlighted ? 'ring-2 ring-yellow-400 bg-yellow-50' : hasFeedback ? 'ring-1 ring-blue-300 bg-blue-50' : ''}`
                                                            : "bg-blue-600 text-white rounded-tr-none"
                                                        }`}
                                                >
                                                    <p className="text-[9px] font-bold uppercase mb-1 tracking-widest opacity-40">
                                                        {isBot ? 'AI Assistant' : 'User'}
                                                    </p>
                                                    <p className="leading-relaxed whitespace-pre-line">{m.content}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Feedback Popover */}
                {showPopover && (
                    <>
                        <div className="fixed inset-0 z-[99]" onClick={() => setShowPopover(false)} />
                        <div
                            className={`fixed z-[100] p-4 rounded-xl bg-slate-900 text-white shadow-2xl w-80 ring-2 ring-blue-500 ${dragging ? 'select-none' : ''}`}
                            style={{ left: popoverPos.x, top: popoverPos.y }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                className="flex justify-between items-center mb-2 -mx-4 -mt-4 px-4 pt-4 pb-2 cursor-move"
                                onMouseDown={startDrag}
                                title="Drag to move"
                            >
                                <span className="text-[10px] font-light text-slate-400 tracking-widest select-none">⠿ ADD FEEDBACK</span>
                                <button
                                    onClick={() => setShowPopover(false)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="opacity-60 hover:opacity-100"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <p className="text-xs italic mb-3 opacity-60 border-l-2 border-blue-500 pl-2 line-clamp-2">
                                "{selectedText}"
                            </p>
                            <textarea
                                className="w-full p-2 text-black text-xs bg-white rounded mb-2 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="What should the AI have said differently?"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                autoFocus
                            />
                            {createError && (
                                <p className="text-red-400 text-[10px] mb-2">{createError}</p>
                            )}
                            <Button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8"
                                onClick={handleSubmitComment}
                                disabled={creating || !comment.trim()}
                            >
                                {creating ? 'Saving...' : 'Save Feedback'}
                            </Button>
                        </div>
                    </>
                )}
            </TooltipProvider>
        </AdminLayout>
    );
};

export default TranscriptPage;
