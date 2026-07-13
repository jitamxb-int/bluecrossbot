import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlueCrossUI } from '@/components/livekit_bank/bluecross/BlueCrossUI';
import { X, MessageSquare, Send, ExternalLink } from 'lucide-react';
import DisclaimerModal from '@/components/DisclaimerModal';
import { renderInlineText } from '@/lib/renderRichText';
 
const BLUE   = '#1B3D8F';
const BLUE_L = '#3A6BC4';
const BLUE_X = '#EEF3FB';
// Backend base URL. When embedded as a widget, the loader passes the partner's
// backend URL via `window.__BCB_API_BASE__` (see src/widget/main.tsx); otherwise
// it comes from the .env (VITE_API_URL, baked at build), falling back to localhost.
const API_BASE =
    (typeof window !== 'undefined' && (window as any).__BCB_API_BASE__) ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:8000';
const API_URL = `${API_BASE}/api/v1/chat`;

// Frontend-only proactive greeting shown the moment the chat opens (after the
// user accepts the disclaimer). Never sent to the backend; the real session
// still starts on the user's first message.
const GREETING_MESSAGE = "👋 Hello! I'm Luna. How can I help you today?";

// Shown in place of the (blurred) RAG response when the user denies HCP consent.
const CONSENT_DENIED_MESSAGE =
    'You have chosen not to provide your consent. As a result, we are unable to ' +
    'continue this conversation or provide further assistance through the chatbot. ' +
    'If you would like to start a new session, please refresh the page. If you ' +
    'require any additional information or assistance, feel free to email us at ' +
    'info@bluecrosslabs.com, and our team will get back to you as soon as possible.';
 
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
    // HCP consent: decided at stream start (from the backend `requires_consent`
    // flag) so the message can blur from its very first token.
    hcpGated?: boolean;
    // Set when the user explicitly denies consent for this gated message. The
    // message stays blurred but its overlay prompt is dismissed.
    denied?: boolean;
}
 
// Add a generic placeholder URL (you can replace this with a local asset like '/assets/default-medicine.png')
const FALLBACK_IMAGE = 'https://placehold.co/120x120/EEF3FB/1B3D8F?text=Rx';
 
const ProductCard = ({ products }: { products: Product }) => {
    // 1. Wrap the original URL in the proxy URL
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
                // 2. Use the proxied URL here
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
 
// Consent overlay shown on top of a blurred HCP-gated message. Accept grants
// consent for the whole session (revealing this and all other gated messages);
// Deny keeps the message blurred but lets the conversation continue (the next
// gated message will prompt again).
const HCPConsentBar = ({ onAccept, onDeny }: { onAccept: () => void; onDeny: () => void }) => {
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                zIndex: 2,
            }}
        >
            <div style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.97)',
                borderRadius: '10px',
                border: `1px solid ${BLUE_L}40`,
                boxShadow: '0 6px 24px rgba(27,61,143,0.18)',
                maxWidth: '92%',
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
                    margin: '0 0 10px 0',
                    lineHeight: '1.5',
                }}>
                    This information is intended for healthcare professionals. Any medical decision-making should rely on clinical judgment and independently verified information. The content provided herein does not replace professional discretion and should be considered supplementary to established clinical guidelines. Blue Cross Labs assumes no liability for clinical decisions based on this content.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onDeny}
                        style={{
                            padding: '6px 14px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#64748b',
                            background: 'white',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                    >
                        Deny
                    </button>
                    <button
                        onClick={onAccept}
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
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                    >
                        Accept
                    </button>
                </div>
            </div>
        </div>
    );
};
 
function parseBold(text: string): React.ReactNode {
    return renderInlineText(text);
}

// Turn inline "- " list separators (" - a - b - c") into real newline bullets so
// the per-line bullet renderer picks them up. Requires whitespace on BOTH sides of
// the dash, so hyphenated words ("Community-acquired") are never split. Only fires
// when there are >=2 such separators (clearly a list) — avoids touching a lone dash
// in prose. Handles en/em dashes too.
function normalizeInlineLists(text: string): string {
    const sepCount = (text.match(/\s[-–—]\s+/g) || []).length;
    if (sepCount >= 2) {
        return text.replace(/\s+[-–—]\s+/g, '\n- ');
    }
    return text;
}

function renderStructuredText(text: string): React.ReactNode {
    const lines = normalizeInlineLists(text).split('\n');
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
 
const MessageBubble = ({
    msg,
    messageIndex,
    hcpConsent,
    onAccept,
    onDeny,
}: {
    msg: Message;
    messageIndex: number;
    hcpConsent: boolean;
    onAccept: () => void;
    onDeny: (index: number) => void;
}) => {
    const isUser = msg.role === 'user';
    const hasProducts = !isUser && !!msg.products && msg.products.length > 0;
    const hasVideos = !isUser && !!msg.videos && msg.videos.length > 0;
    const hasCitations = !isUser && !!msg.citations && msg.citations.trim().length > 0;

    // HCP-gated: decided at stream start (msg.hcpGated) so the message blurs from
    // its first token. Blur the whole message until consent is granted.
    const isGated = msg.hcpGated === true;
    const gatedBlur = isGated && !hcpConsent;
    const showOverlay = gatedBlur && !msg.denied;

    // Citation links excluding the "pdf" sentinel (which is not a real URL).
    const visibleCitations = hasCitations
        ? msg.citations!
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s && s.toLowerCase() !== 'pdf')
              .join(', ')
        : '';

    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '12px',
            animation: 'slideIn 0.25s ease-out forwards',
        }}>
            <div style={{ maxWidth: '88%', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    filter: gatedBlur ? 'blur(6px)' : 'none',
                    pointerEvents: gatedBlur ? 'none' : 'auto',
                    userSelect: gatedBlur ? 'none' : 'auto',
                    transition: 'filter 0.2s ease',
                }}>
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

                    {hasCitations && visibleCitations && (
                        <div style={{ paddingLeft: '2px' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.03em' }}>
                                SOURCES
                            </span>
                            <CitationBar citations={visibleCitations} />
                        </div>
                    )}
                </div>

                {showOverlay && (
                    <HCPConsentBar onAccept={onAccept} onDeny={() => onDeny(messageIndex)} />
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
    // Start "loading" so the typing indicator shows immediately; the greeting is
    // revealed a moment later (see the mount effect below) so it reads like Luna
    // is actually replying rather than a message that was there all along.
    const [isLoading, setIsLoading] = useState(true);
    // Session-wide HCP consent. Once true, all HCP-gated messages (past and
    // future) are shown without blurring. Seeded from the backend session.
    const [hcpConsent, setHcpConsent] = useState(false);
    // Set true when the user denies HCP consent: the session is locked (no further
    // messages). deniedRef mirrors it so an in-flight stream (whose closure can't
    // see updated state) stops mutating the replaced message immediately.
    const [sessionDenied, setSessionDenied] = useState(false);
    const deniedRef = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
 
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Proactive greeting: show the typing indicator briefly, then drop in Luna's
    // welcome message so it feels like the bot is responding. Purely local — no
    // backend call, and the real session still starts on the user's first message.
    useEffect(() => {
        const t = setTimeout(() => {
            setMessages([{ role: 'bot', text: GREETING_MESSAGE }]);
            setIsLoading(false);
        }, 1000);
        return () => clearTimeout(t);
    }, []);
 
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || isLoading || deniedRef.current) return;
 
        setMessages((prev) => [...prev, { role: 'user', text }]);
        setInputText('');
        setIsLoading(true);
 
        try {
            const payload: Record<string, unknown> = { message: text, top_k: 20 };
            if (sessionId) payload.session_id = sessionId;

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', accept: 'text/event-stream' },
                body: JSON.stringify(payload),
            });

            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

            // The bot message is created on the first chunk and is always the LAST
            // message during streaming, so we update by tail index.
            let acc = '';
            let botStarted = false;
            // Whether this response must stream behind the HCP-consent blur,
            // decided by the backend `start` event before any token arrives.
            let gated = false;

            const startBot = () => {
                botStarted = true;
                setIsLoading(false); // swap the typing indicator for the live message
                setMessages((prev) => [...prev, { role: 'bot', text: '', hcpGated: gated }]);
            };
            const setBot = (patch: Message) => {
                setMessages((prev) => {
                    const next = prev.slice();
                    const i = next.length - 1;
                    if (i >= 0 && next[i].role === 'bot') next[i] = patch;
                    return next;
                });
            };

            const handleEvent = (evt: any) => {
                // If the user denied consent mid-stream, ignore any further events
                // so the denial message we swapped in is never overwritten.
                if (deniedRef.current) return;
                if (evt.type === 'start') {
                    if (evt.session_id) setSessionId((cur) => cur ?? evt.session_id);
                    if (evt.hcp_consent) setHcpConsent(true);
                    // Blur from the first token if this response is HCP-gated.
                    gated = !!evt.requires_consent;
                } else if (evt.type === 'delta') {
                    if (!botStarted) startBot();
                    acc += evt.text ?? '';
                    setBot({ role: 'bot', text: acc, hcpGated: gated });
                } else if (evt.type === 'done') {
                    if (!botStarted) startBot();
                    if (evt.session?.session_id) setSessionId(evt.session.session_id);
                    if (evt.session?.hcp_consent) setHcpConsent(true);
                    setBot({
                        role: 'bot',
                        text: evt.answer ?? acc ?? '',
                        hcpGated: gated,
                        products: evt.products ?? [],
                        videos: evt.videos ?? [],
                        citations: evt.citations ?? '',
                    });
                } else if (evt.type === 'error') {
                    if (!botStarted) startBot();
                    setBot({ role: 'bot', text: evt.detail || 'Something went wrong. Please try again.' });
                }
            };

            const processChunk = (raw: string) => {
                const trimmed = raw.trim();
                if (!trimmed) return;
                const line = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
                try { handleEvent(JSON.parse(line)); } catch { /* ignore partial/non-JSON */ }
            };

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let sep: number;
                while ((sep = buffer.indexOf('\n\n')) !== -1) {
                    processChunk(buffer.slice(0, sep));
                    buffer = buffer.slice(sep + 2);
                }
            }
            // Flush any trailing event not terminated by a blank line.
            processChunk(buffer);

            if (!botStarted) {
                // No events arrived at all — surface a fallback.
                setMessages((prev) => [...prev, {
                    role: 'bot',
                    text: 'Sorry, I could not get a response. Please try again.',
                }]);
            }
        } catch {
            setMessages((prev) => [...prev, {
                role: 'bot',
                text: 'Something went wrong. Please check your connection and try again.',
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Accept: grant consent for the whole session — reveal this and all other
    // HCP-gated messages, and persist it on the backend session.
    const handleConsentAccept = () => {
        setHcpConsent(true);
        if (sessionId) {
            fetch(`${API_URL}/hcp-consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ session_id: sessionId }),
            }).catch(() => { /* best-effort; UI already reflects consent */ });
        }
    };

    // Deny: replace the (blurred) RAG response with the denial message and lock the
    // session — no further chatting; the user must refresh to start a new session.
    const handleConsentDeny = (index: number) => {
        deniedRef.current = true;
        setSessionDenied(true);
        setIsLoading(false);
        setMessages((prev) =>
            prev.map((m, i) => (i === index ? { role: 'bot', text: CONSENT_DENIED_MESSAGE } : m)),
        );
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            style={{ animation: 'bcbFadeIn 0.25s ease-out' }}
        >
            <div
                className="w-[95vw] max-w-[720px] h-[82vh] max-h-[620px] rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
                style={{
                    background: 'white',
                    borderColor: '#DDEAFF',
                    animation: 'bcbPopIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
                }}
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
                                <MessageBubble
                                    key={i}
                                    msg={msg}
                                    messageIndex={i}
                                    hcpConsent={hcpConsent}
                                    onAccept={handleConsentAccept}
                                    onDeny={handleConsentDeny}
                                />
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
                            placeholder={sessionDenied
                                ? 'Session ended — refresh the page to start a new chat.'
                                : 'Type your message to Luna...'}
                            disabled={isLoading || sessionDenied}
                            className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isLoading || sessionDenied}
                            className="h-12 w-12 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                            style={{ background: BLUE }}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="12" y1="19" x2="12" y2="5" />
                                <polyline points="5 12 12 5 19 12" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
 
            <style>{`
                @keyframes bcbFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes bcbPopIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0)    scale(1); }
                }
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
 
/**
 * The self-contained chat widget: floating launcher avatar + disclaimer modal +
 * chat overlay. Owns all of its own state and has NO dependency on the marketing
 * landing page (`BlueCrossUI`) or the router — so it can be reused both inside the
 * `/blue_cross/chat` page AND standalone inside the embeddable iframe widget.
 *
 * - `onDisclaimerReject`: what to do when the user rejects the disclaimer. The page
 *   navigates to the full chat route; the embed just dismisses (defaults to that).
 * - `onOpenChange`: fires `true` whenever the disclaimer or chat overlay is visible
 *   and `false` when both are closed — the iframe loader uses it to resize.
 */
export function ChatWidget({
    onDisclaimerReject,
    onOpenChange,
    onLauncherHover,
}: {
    onDisclaimerReject?: () => void;
    onOpenChange?: (open: boolean) => void;
    onLauncherHover?: (hovering: boolean) => void;
}) {
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);

    // Report expanded/collapsed so an embedding iframe can grow/shrink to match.
    useEffect(() => {
        onOpenChange?.(showDisclaimer || chatOpen);
    }, [showDisclaimer, chatOpen, onOpenChange]);

    const openChatFlow = () => {
        setShowDisclaimer(true);
    };

    const handleAccept = () => {
        setShowDisclaimer(false);
        setTimeout(() => {
            setChatOpen(true);
        }, 0);
    };

    const handleReject = () => {
        setShowDisclaimer(false);
        onDisclaimerReject?.();
    };

    return (
        <>
            {!chatOpen && !showDisclaimer && (
                    <div
                        className="group fixed bottom-6 right-6 z-50"
                        style={{ animation: 'avatarIn 0.45s ease-out both' }}
                        onMouseEnter={() => onLauncherHover?.(true)}
                        onMouseLeave={() => onLauncherHover?.(false)}
                    >
                        {/* Tooltip — lives on the wrapper so it isn't clipped by the button's overflow-hidden */}
                        <span
                            className="absolute right-full top-1/2 -translate-y-1/2 mr-4 px-3 py-1.5 rounded-lg text-xs font-bold
                                whitespace-nowrap opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
                                transition-all duration-200 pointer-events-none border shadow-md bg-white"
                            style={{ color: BLUE, borderColor: `${BLUE}25` }}
                        >
                            Need help? Ask Luna!
                        </span>

                        {/* Gentle floating wrapper — paused on hover so the bubble is
                            static while hovered (a moving hit-box under a still cursor
                            toggles :hover and flickers the label/reveal). */}
                        <div className="bcb-launcher-float" style={{ animation: 'avatarFloat 3.5s ease-in-out infinite' }}>
                            {/* Soft glow behind the avatar */}
                            <span
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                    background: `radial-gradient(circle, ${BLUE_L}70 0%, transparent 70%)`,
                                    filter: 'blur(12px)',
                                    transform: 'scale(1.35)',
                                    animation: 'avatarGlow 3s ease-in-out infinite',
                                }}
                            />
                            <button
                                onClick={openChatFlow}
                                className="relative w-20 h-20 rounded-full flex items-center justify-center
                                    transition-transform hover:scale-105 active:scale-95
                                    border-4 border-white/90 overflow-hidden"
                                style={{
                                    background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                                    boxShadow: `0 8px 30px rgba(27,61,143,0.50), 0 0 18px rgba(58,107,196,0.40)`,
                                }}
                            >
                                <img
                                    src="/ai_avatar-1.svg"
                                    alt="Need help? Ask Luna!"
                                    className="w-full h-full object-cover rounded-full"
                                />
                            </button>
                            {/* Pulse ring */}
                            <span
                                className="absolute inset-0 rounded-full opacity-30 animate-ping pointer-events-none"
                                style={{ background: BLUE_L }}
                            />
                        </div>

                        <style>{`
                            /* Freeze the float while hovering so the hit-box stays put. */
                            .group:hover .bcb-launcher-float { animation-play-state: paused !important; }
                            @keyframes avatarIn {
                                0%   { opacity: 0; transform: scale(0.6) translateY(16px); }
                                100% { opacity: 1; transform: scale(1) translateY(0); }
                            }
                            @keyframes avatarFloat {
                                0%, 100% { transform: translateY(0); }
                                50%      { transform: translateY(-6px); }
                            }
                            @keyframes avatarGlow {
                                0%, 100% { opacity: 0.5; transform: scale(1.3); }
                                50%      { opacity: 0.8; transform: scale(1.45); }
                            }
                        `}</style>
                    </div>
                )}
            {showDisclaimer && (
                <DisclaimerModal
                    onAccept={handleAccept}
                    onReject={handleReject}
                />
            )}
            {chatOpen && <ChatOverlay onClose={() => setChatOpen(false)} />}
        </>
    );
}

export default function BlueCrossStaticPage({
    authUser,
    onSignOut,
}: {
    authUser: any;
    onSignOut: () => void;
}) {
    const navigate = useNavigate();

    return (
        <div style={{ height: '100vh' }}>
            <BlueCrossUI authUser={authUser} timeLeft="" onBack={() => navigate('/blue_cross')}>
                <ChatWidget onDisclaimerReject={() => navigate('/blue_cross/chat')} />
            </BlueCrossUI>
        </div>
    );
}