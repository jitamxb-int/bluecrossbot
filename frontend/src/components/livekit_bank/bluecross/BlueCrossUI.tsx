import React from 'react';
import {
    Menu,
    Globe2,
    ShieldCheck,
    MoveUpRight,
    Phone,
    Linkedin,
    Twitter,
    Youtube,
    ArrowLeft,
    ChevronDown,
    Heart,
    Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// ─── Logo ────────────────────────────────────────────────────────────
import blueCrossLogo from '../../assets/bluecross/homeBanner.png';

// ─── Leader photos ───────────────────────────────────────────────────
const nhIsrani    = new URL('../../assets/bluecross/NH_Israni.jpg',    import.meta.url).href;
const manojIsrani = new URL('../../assets/bluecross/ManojIsrani.jpg',  import.meta.url).href;
const rohitIsrani = new URL('../../assets/bluecross/Rohit_Israni.jpg', import.meta.url).href;
const bgBarve     = new URL('../../assets/bluecross/BG_Barve.jpg',     import.meta.url).href;

interface BlueCrossUIProps {
    children?: React.ReactNode;
    authUser?: any;
    timeLeft?: string;
    onBack?: () => void;
}

// Blue Cross brand blue (matches actual logo)
const BLUE   = '#1B3D8F';
const BLUE_L = '#3A6BC4';   // lighter / hover
const BLUE_X = '#EEF3FB';   // very light tint

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

export const BlueCrossUI: React.FC<BlueCrossUIProps> = ({ children, authUser, timeLeft, onBack }) => {
    const navigate  = useNavigate();
    const showTimer = authUser && TIMER_ACCOUNTS.includes(authUser.email) && timeLeft;

    return (
        <div className="relative w-full h-screen font-sans overflow-hidden flex flex-col">

            {/* ══ BACKGROUND ══════════════════════════════════════════════ */}
            <div className="absolute inset-0 z-0">
                {/* Warm healthcare hero image */}
                <img
                    src={blueCrossLogo}
                    alt="Blue Cross Laboratories"
                    className="w-full h-full object-cover object-center"
                    style={{ filter: 'brightness(0.90) saturate(1.05)' }}
                />
                {/* Left → white gradient for text legibility */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(105deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.93) 36%, rgba(255,255,255,0.60) 56%, rgba(255,255,255,0.04) 78%, transparent 100%)',
                    }}
                />
                {/* Bottom blue tint for leadership strip */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-24"
                    style={{ background: 'linear-gradient(to top, rgba(27,61,143,0.08) 0%, transparent 100%)' }}
                />
                {/* Top-right blue glow */}
                <div
                    className="absolute top-0 right-0 w-[480px] h-[400px] pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at top right, rgba(27,61,143,0.10) 0%, transparent 70%)',
                    }}
                />
            </div>

            {/* ══ HEADER — solid white, mirrors bluecrosslabs.com ═══════ */}
            <header className="relative z-50 w-full flex items-center justify-between px-4 md:px-8 py-3 bg-white border-b border-slate-100 shadow-sm shrink-0">

                {/* Left: back + logo */}
                <div className="flex items-center gap-3">
                    <button
                     onClick={() => onBack ? onBack() : navigate('/livekit')}
                        className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-700"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex items-center gap-2.5">
                        {/* Cross logo mark */}
                        <div
                            className="w-11 h-11 rounded-lg flex items-center justify-center shadow-sm shrink-0"
                            style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)` }}
                        >
                            <div className="relative w-5 h-5">
                                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[5px] h-full bg-white rounded-sm" />
                                <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[5px] w-full bg-white rounded-sm" />
                            </div>
                        </div>
                        <div className="leading-tight">
                            <p className="font-black text-sm tracking-wide uppercase" style={{ color: BLUE }}>Blue Cross</p>
                            <p className="text-[10px] tracking-widest uppercase text-slate-400">Laboratories</p>
                        </div>
                    </div>
                </div>

                {/* Centre nav */}
                <nav className="hidden xl:flex items-center gap-5 text-[13px] font-semibold text-slate-600">
                    <a href="#" className="hover:text-[#1B3D8F] transition-colors">About</a>
                    <a href="#" className="flex items-center gap-0.5 hover:text-[#1B3D8F] transition-colors">
                        Business <ChevronDown size={13} />
                    </a>
                    <a href="#" className="hover:text-[#1B3D8F] transition-colors">Products</a>
                    <a href="#" className="flex items-center gap-0.5 hover:text-[#1B3D8F] transition-colors">
                        Quality Management <ChevronDown size={13} />
                    </a>
                    <a href="#" className="hover:text-[#1B3D8F] transition-colors">Research &amp; Development</a>
                    <a href="#" className="flex items-center gap-0.5 hover:text-[#1B3D8F] transition-colors">
                        Human Resource <ChevronDown size={13} />
                    </a>
                </nav>

                {/* Right utilities */}
                <div className="hidden xl:flex items-center gap-3">
                    {showTimer && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase"
                             style={{ background: BLUE_X, borderColor: `${BLUE}30`, color: BLUE }}>
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />
                            {timeLeft}
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 text-xs font-semibold text-slate-500">
                        <Globe2 size={12} style={{ color: BLUE }} />
                        <span>15 Countries</span>
                    </div>

                    <button
                        className="text-white text-sm font-bold px-5 py-2 rounded-md flex items-center gap-2 transition-all hover:scale-105"
                        style={{
                            background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                            boxShadow: `0 4px 14px rgba(27,61,143,0.35)`,
                        }}
                    >
                        <MoveUpRight size={14} strokeWidth={3} />
                        Contact Us
                    </button>

                    <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <Search size={18} />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <Menu size={20} />
                    </button>
                </div>

                {/* Mobile right */}
                <div className="xl:hidden flex items-center gap-2">
                    <button
                        className="text-white text-xs font-bold px-3 py-1.5 rounded-md flex items-center gap-1"
                        style={{ background: BLUE }}
                    >
                        <Phone size={11} /> Call
                    </button>
                    <Menu size={22} className="text-slate-600" />
                </div>
            </header>

            {/* ══ HERO ═══════════════════════════════════════════════════ */}
            <main className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-16 py-8 overflow-hidden">
                <div className="flex flex-col gap-6 max-w-2xl">

                    {/* Badge */}
                    <div
                        className="w-fit flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
                        style={{ borderColor: `${BLUE}30`, background: BLUE_X, color: BLUE }}
                    >
                        <Heart size={12} className="fill-current" />
                        Founded 1980 · Mumbai, India
                    </div>

                    {/* Headline */}
                    <h1
                        className="text-5xl md:text-7xl lg:text-[5.5rem] leading-[0.93] font-black uppercase tracking-tight"
                        style={{ color: '#1A2942' }}
                    >
                        BRINGING<br />
                        <span style={{ color: BLUE }}>HEALING</span><br />
                        TO EVERY HOME.
                    </h1>

                    {/* Sub-copy */}
                    <p
                        className="text-base md:text-lg font-light max-w-md text-slate-500 border-l-2 pl-4"
                        style={{ borderColor: BLUE }}
                    >
                        Four decades of pharmaceutical excellence — delivering quality, innovation
                        and affordability across 15+ countries worldwide.
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-6 mt-1">
                        {STATS.map((s) => (
                            <div key={s.label} className="flex flex-col">
                                <span className="text-2xl md:text-3xl font-black leading-tight" style={{ color: BLUE }}>
                                    {s.value}
                                </span>
                                <span className="text-[11px] font-semibold uppercase tracking-wider mt-0.5 text-slate-400">
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-1">
                        <button
                            className="text-white font-bold text-sm md:text-base px-8 py-3.5 rounded-md flex items-center justify-center gap-2 transition-transform hover:-translate-y-1"
                            style={{
                                background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
                                boxShadow: `0 8px 24px rgba(27,61,143,0.28)`,
                            }}
                        >
                            Explore Products <MoveUpRight size={17} />
                        </button>
                        <button
                            className="font-bold text-sm md:text-base px-8 py-3.5 rounded-md border-2 flex items-center justify-center gap-2 transition-all hover:-translate-y-1 bg-white/80 hover:bg-blue-50"
                            style={{ borderColor: BLUE, color: BLUE }}
                        >
                            <ShieldCheck size={17} /> Quality Standards
                        </button>
                    </div>
                </div>
            </main>

            {/* ══ LEADERSHIP STRIP — white with blue accents ══════════════ */}
            <div
                className="relative z-10 w-full shrink-0 hidden md:flex border-t"
                style={{
                    background: 'rgba(255,255,255,0.97)',
                    borderColor: '#DDEAFF',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {LEADERS.map((l, i) => (
                    <LeaderCard key={l.name} {...l} isLast={i === LEADERS.length - 1} />
                ))}
            </div>

            {/* Sidebar social icons */}
            <div className="hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 flex-col gap-5 z-20">
                <SocialIcon icon={<Linkedin size={17} />} />
                <SocialIcon icon={<Twitter  size={17} />} />
                <SocialIcon icon={<Youtube  size={17} />} />
            </div>

            {/* Therapy area pills — right side decoration */}
            <div className="hidden 2xl:flex fixed right-6 top-1/2 -translate-y-1/2 flex-col gap-2 z-20">
                {THERAPY_TAGS.map((t) => (
                    <div
                        key={t}
                        className="text-[10px] font-bold tracking-widest uppercase border px-3 py-1 rounded-full cursor-pointer transition-all"
                        style={{
                            color: `${BLUE}88`,
                            borderColor: `${BLUE}20`,
                            background: 'rgba(255,255,255,0.80)',
                        }}
                        onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.color = BLUE;
                            el.style.borderColor = `${BLUE}55`;
                            el.style.background = BLUE_X;
                        }}
                        onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.color = `${BLUE}88`;
                            el.style.borderColor = `${BLUE}20`;
                            el.style.background = 'rgba(255,255,255,0.80)';
                        }}
                    >
                        {t}
                    </div>
                ))}
            </div>

            {children}
        </div>
    );
};

/* ── DATA ─────────────────────────────────────────────────────────── */

const STATS = [
    { value: '164+',  label: 'Products'        },
    { value: '3,400', label: 'Employees'        },
    { value: '15',    label: 'Export Countries' },
    { value: '#33',   label: 'Rank in IPM'      },
];

const THERAPY_TAGS = ['Analgesics', 'Cardiology', 'Anti-Bacterial', 'Dermatology', 'Gastro', 'Diabetes'];

const LEADERS = [
    { name: 'MR. N. H. ISRANI',  title: 'Founder & Chairman',               photo: nhIsrani    },
    { name: 'MR. MANOJ ISRANI',  title: 'Vice-Chairman & Managing Director', photo: manojIsrani },
    { name: 'MR. ROHIT ISRANI',  title: 'Director',                          photo: rohitIsrani },
    { name: 'MR. B. G. BARVE',   title: 'Joint Managing Director',           photo: bgBarve     },
];

/* ── SUB-COMPONENTS ───────────────────────────────────────────────── */

const LeaderCard: React.FC<{ name: string; title: string; photo: string; isLast?: boolean }> = ({
    name, title, photo, isLast,
}) => (
    <div
        className={`flex items-center gap-3 px-5 py-3 flex-1 cursor-pointer transition-colors hover:bg-blue-50/70
            ${!isLast ? 'border-r border-blue-100' : ''}`}
    >
        <div
            className="w-12 h-16 rounded overflow-hidden shrink-0 ring-1"
            style={{ background: BLUE_X }}
        >
            <img src={photo} alt={name} className="w-full h-full object-cover object-top" />
        </div>
        <div>
            <p className="font-bold text-xs leading-tight" style={{ color: '#1A2942' }}>{name}</p>
            <p className="text-[11px] mt-1 leading-snug text-slate-400">{title}</p>
        </div>
    </div>
);

const SocialIcon: React.FC<{ icon: React.ReactNode; href?: string }> = ({ icon, href = '#' }) => (
    <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="transition-all hover:scale-110 transform"
        style={{ color: `${BLUE}55` }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = BLUE; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = `${BLUE}55`; }}
    >
        {icon}
    </a>
);