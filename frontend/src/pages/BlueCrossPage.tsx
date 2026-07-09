import React, { useState, useEffect, useRef } from 'react';
import { BlueCrossUI } from '@/components/livekit_bank/bluecross/BlueCrossUI';
import { X, MessageSquare, Send, ExternalLink } from 'lucide-react';

/* ── CONFIG ───────────────────────────────────────────────────────── */

// Backend base URL comes from the .env (VITE_API_URL); falls back to localhost for dev.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_URL = `${API_BASE}/api/v1/chat`;

const BLUE   = '#1B3D8F';
const BLUE_L = '#3A6BC4';
const BLUE_X = '#EEF3FB';

/* ── TIMER ACCOUNTS ───────────────────────────────────────────────── */

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

interface Video {
    title: string;
    video_url: string;
    thumbnail_url: string;
    category: string;
    division: string;
    page_url: string;
    score: number;
}

interface Product {
    product_name: string;
    category: string;
    division: string;
    image_url: string;
    page_url: string;
    score: number;
}

interface Message {
    role: 'user' | 'bot';
    text: string;
    products?: Product[];
    videos?: Video[];
    citations?: string;
}

/* ── COMPONENTS ───────────────────────────────────────────────────── */

const FALLBACK_IMAGE = 'https://placehold.co/120x120/EEF3FB/1B3D8F?text=Rx';

const ProductCard = ({ products }: { products: Product }) => {
    const proxiedImageUrl = products.image_url
        ? `https://wsrv.nl/?url=${encodeURIComponent(products.image_url)}`
        : FALLBACK_IMAGE;

    return (
        <a
            href={products.page_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px',
                width: '90px',
                flexShrink: 0,
                textDecoration: 'none',
                cursor: 'pointer',
            }}
        >
            <img
                src={proxiedImageUrl}
                alt={products.product_name}
                referrerPolicy="no-referrer"
                style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== FALLBACK_IMAGE) {
                        target.src = FALLBACK_IMAGE;
                    } else {
                        target.style.display = 'none';
                    }
                }}
            />
            <span style={{
                fontSize: '10.5px',
                fontWeight: 600,
                color: BLUE,
                textAlign: 'center',
                marginTop: '5px',
                lineHeight: '1.3',
            }}>
                {products.product_name}
            </span>
        </a>
    );
};

const VideoCard = ({ video }: { video: Video }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const clickCountRef = useRef(0);
    const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isYouTubeUrl = (url: string): boolean => {
        return /(?:youtube\.com|youtu\.be)/.test(url);
    };

    const extractYouTubeId = (url: string): string | null => {
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        return match ? match[1] : null;
    };

    const isDirectVideo = (url: string): boolean => {
        return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
    };

    const youtubeId = isYouTubeUrl(video.video_url) ? extractYouTubeId(video.video_url) : null;
    const isDirect = isDirectVideo(video.video_url);

    const handleClick = () => {
        clickCountRef.current += 1;

        if (clickCountRef.current === 1) {
            clickTimerRef.current = setTimeout(() => {
                if (clickCountRef.current === 1) {
                    setIsPlaying(true);
                }
                clickCountRef.current = 0;
            }, 250);
        } else if (clickCountRef.current === 2) {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            window.open(video.video_url, '_blank', 'noopener,noreferrer');
            clickCountRef.current = 0;
        }
    };

    useEffect(() => {
        return () => {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        };
    }, []);

    if (isPlaying) {
        return (
            <div style={{
                width: '280px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#000',
            }}>
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                    {youtubeId ? (
                        <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none',
                            }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={video.title}
                        />
                    ) : (
                        <video
                            src={video.video_url}
                            controls
                            autoPlay
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                            }}
                        />
                    )}
                </div>
                <div style={{
                    padding: '8px 10px',
                    background: '#fff',
                    borderTop: '1px solid #e2e8f0',
                }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#1A2942', lineHeight: '1.3' }}>
                        {video.title}
                    </p>
                    <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                        {video.category} · {video.division}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={handleClick}
            style={{
                width: '280px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#fff',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                {video.thumbnail_url ? (
                    <img
                        src={video.thumbnail_url}
                        alt={video.title}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/480x270/EEF3FB/1B3D8F?text=Video';
                        }}
                    />
                ) : (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #EEF3FB 0%, #DDEAFF 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <div style={{
                                width: 0,
                                height: 0,
                                borderTop: '12px solid transparent',
                                borderBottom: '12px solid transparent',
                                borderLeft: '20px solid white',
                                marginLeft: '4px',
                            }} />
                        </div>
                    </div>
                )}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: video.thumbnail_url ? 'rgba(0,0,0,0.2)' : 'transparent',
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.95)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}>
                        <div style={{
                            width: 0,
                            height: 0,
                            borderTop: '10px solid transparent',
                            borderBottom: '10px solid transparent',
                            borderLeft: `16px solid ${BLUE}`,
                            marginLeft: '3px',
                        }} />
                    </div>
                </div>
            </div>
            <div style={{ padding: '8px 10px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#1A2942', lineHeight: '1.3' }}>
                    {video.title}
                </p>
                <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                    {video.category} · {video.division}
                </p>
            </div>
        </div>
    );
};

const CitationBar = ({ citations }: { citations: string }) => {
    const links = citations
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '7px' }}>
            {links.map((url, i) => {
                let label = '';
                try {
                    const u = new URL(url);
                    const pathPart = u.pathname.split('/').filter(Boolean).slice(-1)[0];
                    label = u.hostname.replace('www.', '') + (u.pathname !== '/' && pathPart ? ' · ' + pathPart.replace(/-/g, ' ') : '');
                } catch {
                    label = url;
                }
                return (
                    <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            color: BLUE_L,
                            background: BLUE_X,
                            border: `1px solid ${BLUE_L}30`,
                            borderRadius: '4px',
                            padding: '2px 7px',
                            textDecoration: 'none',
                            fontWeight: 500,
                            maxWidth: '200px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                        }}
                    >
                        <ExternalLink size={9} />
                        {label || `Source ${i + 1}`}
                    </a>
                );
            })}
        </div>
    );
};

const HCPConsentBar = ({ citations, messageId }: { citations: string; messageId: string }) => {
    const [accepted, setAccepted] = useState(false);
    const [acceptedAll, setAcceptedAll] = useState(() => {
        return localStorage.getItem('hcp_consent_accepted_all') === 'true';
    });

    const links = citations
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'pdf' && s !== 'PDF');

    useEffect(() => {
        if (acceptedAll) {
            setAccepted(true);
        }
    }, [acceptedAll]);

    const handleAccept = () => {
        setAccepted(true);
    };

    const handleAcceptAll = () => {
        localStorage.setItem('hcp_consent_accepted_all', 'true');
        setAcceptedAll(true);
        setAccepted(true);
    };

    if (accepted) {
        return (
            <div style={{ marginTop: '8px' }}>
                <div style={{ 
                    padding: '8px 10px', 
                    background: '#f0f9ff', 
                    borderRadius: '6px', 
                    border: `1px solid ${BLUE_L}30`,
                    marginBottom: '6px',
                }}>
                    <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                        <strong style={{ color: BLUE }}>HCP Consent and Disclaimer</strong>
                    </p>
                    <p style={{ fontSize: '9.5px', color: '#94a3b8', margin: '3px 0 0 0', lineHeight: '1.4' }}>
                        This information is intended for healthcare professionals. Any medical decision-making should rely on clinical judgment and independently verified information.
                    </p>
                </div>
                {links.length > 0 && (
                    <CitationBar citations={links.join(', ')} />
                )}
            </div>
        );
    }

    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ 
                padding: '10px 12px', 
                background: '#f8fafc', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
            }}>
                <h3 style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    color: BLUE, 
                    margin: '0 0 6px 0',
                }}>
                    HCP Consent and Disclaimer
                </h3>
                <p style={{ 
                    fontSize: '11px', 
                    color: '#475569', 
                    margin: '0 0 8px 0', 
                    lineHeight: '1.5',
                }}>
                    This information is intended for healthcare professionals. Any medical decision-making should rely on clinical judgment and independently verified information. The content provided herein does not replace professional discretion and should be considered supplementary to established clinical guidelines. Healthcare providers should verify all information against primary literature and current practice standards before application in patient care. Blue Cross Labs assumes no liability for clinical decisions based on this content.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleAccept}
                        style={{
                            padding: '6px 14px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: BLUE,
                            background: 'white',
                            border: `1px solid ${BLUE}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = BLUE_X;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                        }}
                    >
                        Accept
                    </button>
                    <button
                        onClick={handleAcceptAll}
                        style={{
                            padding: '6px 14px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'white',
                            background: BLUE,
                            border: `1px solid ${BLUE}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        Accept All
                    </button>
                </div>
            </div>
        </div>
    );
};

function parseBold(text: string): React.ReactNode {
    const parts = text.split(/(\*\*[^*]*\*\*)/g);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: BLUE }}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

function renderFormattedText(text: string): React.ReactNode {
    const numberedItems = text.match(/\d+\.\s+/g);
    if (numberedItems && numberedItems.length >= 2) {
        return renderNumberedList(text);
    }

    const boldItems = [...text.matchAll(/\*\*[^*]+\*\*/g)];
    if (boldItems.length >= 2 && isBoldProductList(text, boldItems)) {
        return renderBoldProductList(text, boldItems);
    }

    const commaList = tryRenderCommaProductList(text);
    if (commaList) return commaList;

    return <>{parseBold(text)}</>;
}

function renderNumberedList(text: string): React.ReactNode {
    const parts = text.split(/(\d+\.\s+)/);
    const elements: React.ReactNode[] = [];
    let key = 0;

    if (parts[0]) {
        elements.push(<span key={key++}>{parseBold(parts[0])}</span>);
    }

    for (let i = 1; i < parts.length; i += 2) {
        const content = parts[i + 1] || '';
        elements.push(
            <div key={key++} style={{ marginTop: '4px' }}>
                {parseBold(content)}
            </div>
        );
    }

    return <>{elements}</>;
}

function isBoldProductList(text: string, matches: RegExpMatchArray[]): boolean {
    for (let i = 0; i < matches.length - 1; i++) {
        const after = text.slice(matches[i].index! + matches[i][0].length, matches[i + 1].index!).trim();
        if (after && !after.startsWith(':') && !after.startsWith(',') && !after.startsWith('and')) {
            return false;
        }
    }
    return true;
}

function renderBoldProductList(text: string, matches: RegExpMatchArray[]): React.ReactNode {
    const elements: React.ReactNode[] = [];
    let key = 0;

    const intro = text.slice(0, matches[0].index!).trim();
    if (intro) {
        elements.push(<div key={key++} style={{ marginBottom: '4px' }}>{parseBold(intro)}</div>);
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index!;
        const end = i < matches.length - 1 ? matches[i + 1].index! : text.length;
        const segment = text.slice(start, end).replace(/,\s*$/, '').trim();
        if (segment) {
            elements.push(<div key={key++} style={{ marginTop: '2px' }}>{parseBold(segment)}</div>);
        }
    }

    return <>{elements}</>;
}

function tryRenderCommaProductList(text: string): React.ReactNode | null {
    const productRegex = /[A-Z][a-z]+(?:\s+[A-Z][A-Za-z]*)+/g;
    const matches = [...text.matchAll(productRegex)];

    if (matches.length < 3) return null;

    for (let i = 0; i < matches.length - 1; i++) {
        const after = text.slice(matches[i].index! + matches[i][0].length, matches[i + 1].index!);
        if (!/^,\s*$/.test(after) && !/^\s+and\s+/i.test(after)) {
            return null;
        }
    }

    const elements: React.ReactNode[] = [];
    let key = 0;

    const intro = text.slice(0, matches[0].index!).trim();
    if (intro) {
        elements.push(<div key={key++} style={{ marginBottom: '4px' }}>{intro}</div>);
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index!;
        const end = i < matches.length - 1 ? matches[i + 1].index! : text.length;
        const segment = text.slice(start, end).replace(/,\s*$/, '').trim();
        if (segment) {
            elements.push(<div key={key++} style={{ marginTop: '2px' }}>{segment}</div>);
        }
    }

    return <>{elements}</>;
}

function renderStructuredText(text: string): React.ReactNode {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            elements.push(<div key={key++} style={{ height: '6px' }} />);
            continue;
        }

        const bulletMatch = trimmed.match(/^-\s+(.+)/);
        if (bulletMatch) {
            elements.push(
                <div key={key++} style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    marginTop: '3px',
                    paddingLeft: '8px',
                }}>
                    <span style={{ color: BLUE, fontWeight: 600, flexShrink: 0 }}>•</span>
                    <span>{parseBold(bulletMatch[1])}</span>
                </div>
            );
            continue;
        }

        const sectionMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*:?\s*(.*)/);
        if (sectionMatch) {
            const sectionTitle = sectionMatch[1];
            const sectionContent = sectionMatch[2];
            
            if (sectionContent) {
                elements.push(
                    <div key={key++} style={{ marginTop: '10px', marginBottom: '4px' }}>
                        <strong style={{ color: BLUE, fontSize: '14px' }}>{sectionTitle}</strong>
                        <span style={{ color: '#64748b' }}>: {sectionContent}</span>
                    </div>
                );
            } else {
                elements.push(
                    <div key={key++} style={{ 
                        marginTop: '10px', 
                        marginBottom: '4px',
                        fontWeight: 700,
                        color: BLUE,
                        fontSize: '14px',
                    }}>
                        {sectionTitle}
                    </div>
                );
            }
            continue;
        }

        elements.push(
            <div key={key++} style={{ marginTop: '2px' }}>
                {parseBold(trimmed)}
            </div>
        );
    }

    return <>{elements}</>;
}

const MessageBubble = ({ msg, messageIndex }: { msg: Message; messageIndex: number }) => {
    const isUser = msg.role === 'user';
    const hasProducts = !isUser && !!msg.products && msg.products.length > 0;
    const hasVideos = !isUser && !!msg.videos && msg.videos.length > 0;
    const hasCitations = !isUser && !!msg.citations && msg.citations.trim().length > 0;
    const hasPdf = hasCitations && /\bpdf\b/i.test(msg.citations!);

    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '12px',
            animation: 'slideIn 0.25s ease-out forwards',
        }}>
            <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                    padding: '10px 14px',
                    borderRadius: '14px',
                    fontSize: '13.5px',
                    lineHeight: '1.55',
                    wordWrap: 'break-word',
                    backgroundColor: isUser ? BLUE : '#fff',
                    color: isUser ? '#fff' : '#1A2942',
                    border: isUser ? 'none' : '1px solid #e2e8f0',
                    boxShadow: isUser ? '0 2px 8px rgba(27,61,143,0.18)' : '0 1px 2px rgba(0,0,0,0.05)',
                    borderBottomRightRadius: isUser ? '2px' : '14px',
                    borderBottomLeftRadius: !isUser ? '2px' : '14px',
                }}>
                    {isUser ? msg.text : renderStructuredText(msg.text)}
                </div>

                {hasProducts && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '2px' }}>
                        {msg.products!.map((p, i) => (
                            <ProductCard key={i} products={p} />
                        ))}
                    </div>
                )}

                {hasVideos && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingLeft: '2px' }}>
                        {msg.videos!.map((v, i) => (
                            <VideoCard key={i} video={v} />
                        ))}
                    </div>
                )}

                {hasCitations && hasPdf && (
                    <div style={{ paddingLeft: '2px' }}>
                        <HCPConsentBar citations={msg.citations!} messageId={`msg-${messageIndex}`} />
                    </div>
                )}

                {hasCitations && !hasPdf && (
                    <div style={{ paddingLeft: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.03em' }}>
                            SOURCES
                        </span>
                        <CitationBar citations={msg.citations!} />
                    </div>
                )}
            </div>
        </div>
    );
};

const TypingBubble = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
        <div style={{
            padding: '10px 16px',
            borderRadius: '14px',
            borderBottomLeftRadius: '2px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
        }}>
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: BLUE_L,
                        display: 'inline-block',
                        animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                    }}
                />
            ))}
        </div>
    </div>
);

const ChatOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || isLoading) return;

        setMessages((prev) => [...prev, { role: 'user', text }]);
        setInputText('');
        setIsLoading(true);

        try {
            const payload: Record<string, unknown> = { message: text, top_k: 20 };
            if (sessionId) payload.session_id = sessionId;

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', accept: 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (data.session?.session_id && !sessionId) {
                setSessionId(data.session.session_id);
            }

            setMessages((prev) => [...prev, {
                role: 'bot',
                text: data.answer ?? 'Sorry, I could not get a response. Please try again.',
                products: data.products ?? [],
                videos: data.videos ?? [],
                citations: data.citations ?? '',
            }]);
        } catch {
            setMessages((prev) => [...prev, {
                role: 'bot',
                text: 'Something went wrong. Please check your connection and try again.',
            }]);
        } finally {
            setIsLoading(false);
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
                        <span className="font-black text-white text-base tracking-widest uppercase">Luna Chat</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <span className="text-xs font-semibold uppercase tracking-wider">End</span>
                        <X size={18} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/50">
                    {messages.length === 0 && !isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                            <MessageSquare size={32} className="opacity-20" />
                            <p className="text-sm font-medium">Send a message to start the conversation.</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => (
                                <MessageBubble key={i} msg={msg} messageIndex={i} />
                            ))}
                            {isLoading && <TypingBubble />}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                    <form onSubmit={handleSend} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Type your message to Pratiksha..."
                            disabled={isLoading}
                            className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isLoading}
                            className="h-12 w-12 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                            style={{ background: BLUE }}
                        >
                            <Send size={18} className="ml-1" />
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-5px); }
                }
            `}</style>
        </div>
    );
};

/* ── PAGE ROOT ────────────────────────────────────────────────────── */

export default function BlueCrossPage({
    authUser,
    onSignOut,
}: {
    authUser: any;
    onSignOut: () => void;
}) {
    const [chatOpen, setChatOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('');

    /* Session timer */
    useEffect(() => {
        if (!authUser || !TIMER_ACCOUNTS.includes(authUser.email)) return;

        const storageKey = `test_session_expiry_v2_${authUser.email}`;
        let expiryTime = parseInt(localStorage.getItem(storageKey) || '0', 10);

        if (!expiryTime || expiryTime < Date.now()) {
            const FOUR_HOURS_IN_MS = 4 * 60 * 60 * 1000;
            expiryTime = Date.now() + FOUR_HOURS_IN_MS;
            localStorage.setItem(storageKey, expiryTime.toString());
        }

        const calculateTime = () => {
            const now = Date.now();
            const distance = expiryTime - now;

            if (distance <= 0) {
                setTimeLeft('Expired');
                localStorage.removeItem(storageKey);
                onSignOut();
                return false;
            }

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

    return (
        <div style={{ height: '100vh' }}>
            <BlueCrossUI authUser={authUser} timeLeft={timeLeft}>
                {!chatOpen && (
                    <div className="fixed bottom-6 right-6 z-50">
                        <button
                            onClick={() => setChatOpen(true)}
                            className="group relative w-16 h-16 rounded-full flex items-center justify-center
                                transition-transform hover:scale-110 active:scale-95
                                border-4 border-white/80 shadow-xl"
                            style={{
                                background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                                boxShadow: `0 6px 28px rgba(27,61,143,0.50)`,
                            }}
                        >
                            <span
                                className="absolute right-full mr-4 px-3 py-1.5 rounded-lg text-xs font-bold
                                    whitespace-nowrap opacity-0 group-hover:opacity-100
                                    transition-opacity pointer-events-none border shadow-sm bg-white"
                                style={{ color: BLUE, borderColor: `${BLUE}25` }}
                            >
                                Need help? Ask Luna!
                            </span>
                            <div className="relative w-7 h-7">
                                <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2 h-full bg-white rounded-sm" />
                                <div className="absolute top-1/2 -translate-y-1/2 left-0 h-2 w-full bg-white rounded-sm" />
                            </div>
                            <span className="absolute inset-0 rounded-full opacity-25 animate-ping" style={{ background: BLUE_L }} />
                        </button>
                    </div>
                )}
                {chatOpen && <ChatOverlay onClose={() => setChatOpen(false)} />}
            </BlueCrossUI>
        </div>
    );
}
