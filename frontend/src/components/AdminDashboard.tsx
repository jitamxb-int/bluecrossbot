import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, MessageSquare, Clock, ArrowRight, Shield, ArrowLeft } from 'lucide-react';

const BLUE   = '#1B3D8F';
const BLUE_L = '#3A6BC4';
const BLUE_X = '#EEF3FB';

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

function getSessionInfo(email: string) {
  const key = `test_session_expiry_v2_${email}`;
  const raw = localStorage.getItem(key);
  if (!raw) return { status: 'never' as const };
  const expiry = parseInt(raw, 10);
  if (expiry < Date.now()) return { status: 'expired' as const };
  return { status: 'active' as const };
}

function getChatSessions() {
  try {
    return JSON.parse(localStorage.getItem('bluecross_chat_sessions') || '[]') as Array<{
      duration: number;
      timestamp: number;
    }>;
  } catch { return []; }
}

function formatDuration(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function AdminDashboard({
  authUser,
  onClose,
  onLaunchChat,
}: {
  authUser: any;
  onClose: () => void;
  onLaunchChat: () => void;
}) {
  const navigate = useNavigate();

  const rows = useMemo(() =>
    TIMER_ACCOUNTS.map(email => ({ email, ...getSessionInfo(email) })), []);

  const active = rows.filter(r => r.status === 'active').length;

  const sessions = useMemo(() => getChatSessions(), []);
  const totalChats = sessions.length;
  const avgDuration = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length)
    : 0;

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: '#F0F4FF' }}>

      {/* ── NAVBAR ── */}
      <header
        className="w-full px-8 py-4 flex items-center justify-between shrink-0"
        style={{
          background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE_L} 100%)`,
          boxShadow: '0 4px 24px rgba(27,61,143,0.18)',
        }}
      >
        <div className="flex items-center gap-3">

          {/* Back to VYOM */}
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/20"
            title="Back to VYOM AI"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>

          {/* Cross logomark */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <div className="relative w-4 h-4">
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[4px] h-full bg-white rounded-sm" />
              <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[4px] w-full bg-white rounded-sm" />
            </div>
          </div>

          <div>
            <p className="text-white font-black text-sm tracking-widest uppercase leading-tight">
              Blue Cross Laboratories
            </p>
            <p className="text-white/50 text-[10px] tracking-widest uppercase">Admin Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <Shield size={12} className="text-white/70" />
            <span className="text-white/70 text-xs font-medium">{authUser?.email ?? 'Admin'}</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium">Live</span>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 flex flex-col gap-8">

        {/* ── LAUNCH BUTTON ── */}
        <div className="flex justify-end">
          <button
            onClick={onLaunchChat}
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-white font-bold text-sm
                       hover:-translate-y-0.5 hover:shadow-xl transition-all"
            style={{
              background: `linear-gradient(90deg, ${BLUE}, ${BLUE_L})`,
              boxShadow: `0 4px 16px rgba(27,61,143,0.28)`,
            }}
          >
            <MessageSquare size={16} />
            Launch Chat
            <ArrowRight size={15} />
          </button>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatCard
            icon={<Users size={22} />}
            label="Total Accounts"
            value={TIMER_ACCOUNTS.length}
            sub="registered"
          />
          <StatCard
            icon={<CheckCircle size={22} />}
            label="Active Sessions"
            value={active}
            sub="currently live"
            accent="#16a34a"
            accentBg="#dcfce7"
          />
          <StatCard
            icon={<MessageSquare size={22} />}
            label="Total Chats"
            value={totalChats}
            sub="all time"
          />
          <StatCard
            icon={<Clock size={22} />}
            label="Avg Duration"
            value={totalChats ? formatDuration(avgDuration) : '—'}
            sub="per session"
            isText
          />
        </div>

        {/* ── CHAT HISTORY ── */}
        {sessions.length > 0 && (
          <div
            className="rounded-2xl border overflow-hidden shadow-sm"
            style={{ borderColor: '#DDEAFF' }}
          >
            <div
              className="px-6 py-4 flex items-center gap-2.5 border-b bg-white"
              style={{ borderColor: '#DDEAFF' }}
            >
              <Clock size={15} style={{ color: BLUE }} />
              <span className="font-black text-sm uppercase tracking-wider" style={{ color: '#1A2942' }}>
                Chat History
              </span>
            </div>
            <div className="bg-white divide-y divide-slate-50">
              {sessions.slice().reverse().map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                      style={{ background: BLUE_X, color: BLUE }}
                    >
                      {sessions.length - i}
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(s.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold font-mono px-3 py-1 rounded-full"
                    style={{ background: BLUE_X, color: BLUE }}
                  >
                    {formatDuration(s.duration)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent, accentBg, isText = false }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  accent?: string;
  accentBg?: string;
  isText?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-6 border bg-white flex flex-col gap-4 shadow-sm"
      style={{ borderColor: '#e2e8f0' }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ background: accentBg ?? BLUE_X, color: accent ?? BLUE }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <p
          className={`${isText ? 'text-2xl' : 'text-4xl'} font-black leading-none`}
          style={{ color: accent ?? '#1A2942' }}
        >
          {value}
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
          {sub}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}