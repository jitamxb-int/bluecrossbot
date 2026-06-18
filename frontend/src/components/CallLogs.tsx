import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X, Phone, PhoneCall, PhoneMissed, PhoneOff, Clock,
  Loader2, Play, FileText, RefreshCw, Radio,
  CheckCircle2, Hourglass, Building2, User, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Site Flag ────────────────────────────────────────────────────────────────

const getSiteFlag = (): "vyom" | "vilok" => {
  const host = window.location.hostname;
  if (host.includes("vilok.ai")) return "vilok";
  return "vyom";
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  speaker: "assistant" | "user";
  text: string;
  timestamp: string;
}

interface CallLog {
  _id: string;
  callId: string;
  platform: "vapi" | "livekit";
  assistantId: string;
  customerNumber: string;
  status: "initiated" | "completed" | "queued" | string;
  userId?: string;
  trunkId?: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds?: number;
  endedAt?: string;
  startedAt?: string;
  recordingUrl?: string;
  summary?: string;
  transcript?: TranscriptEntry[] | string;
  endedReason?: string;
  candidateName?: string;
  companyName?: string;
  usecase?: string;
  initiatedByEmail?: string;
  initiatedByName?: string;
  ttsProvider?: string;
  ttsVoice?: string;
}

const VOICE_DATA: Record<string, { id: string; name: string }[]> = {
  "11labs": [
    { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
    { id: "ZncGbt9ecxkwpmaX6V9z", name: "Alex" },
    { id: "JigslbTSI6z9hOVIWIRA", name: "Olivia" },
    { id: "k8ThSUZ5Vij4z9jQQSvZ", name: "Simran" },
    { id: "iPmVSMDLX3FRQaONHDW2", name: "Kavita" },
    { id: "pGYsZruQzo8cpdFVZyJc", name: "Smriti" },
  ],
  "cartesia": [
    { id: "a167e0f3-df7e-4277-976b-be2f952fa275", name: "Tessa" },
    { id: "e8e5fffb-252c-436d-b842-8879b84445b6", name: "Cathy" },
    { id: "f8f5f1b2-f02d-4d8e-a40d-fd850a487b3d", name: "Kiara" },  
    { id: "f786b574-daa5-4673-aa0c-cbe3e8534c02", name: "Katie" },
    { id: "3b554273-4299-48b9-9aaf-eefd438e3941", name: "Simi" },
    { id: "7ea5e9c2-b719-4dc3-b870-5ba5f14d31d8", name: "Janvi" },
    { id: "f6141af3-5f94-418c-80ed-a45d450e7e2e", name: "Priya" },
    { id: "95d51f79-c397-46f9-b49a-23763d3eaa2d", name: "Arushi" },
    { id: "28ca2041-5dda-42df-8123-f58ea9c3da00", name: "Palak" },
  ],
  "sarvam": [
    { id: "pooja", name: "Pooja" },
    { id: "shruti", name: "Shruti" },
    { id: "simran", name: "Simran" },
    { id: "ishita", name: "Ishita" },
    { id: "shreya", name: "Shreya" },
    { id: "kavya", name: "Kavya" },
    { id: "priya", name: "Priya" },
    { id: "ritu", name: "Ritu" },
    { id: "rupali", name: "Rupali" },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
};

const formatDuration = (secs?: number) => {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const calculateCost = (durationSeconds?: number, platform?: string) => {
  if (!durationSeconds || !platform) return "—";
  const minutes = durationSeconds / 60;
  
  if (platform === "vapi") {
    const cost = minutes * 0.30;
    return `$${cost.toFixed(2)}`;
  } else if (platform === "livekit") {
    const cost = minutes * 8;
    return `₹${cost.toFixed(2)}`;
  }
  return "—";
};

const displayTtsProvider = (provider?: string) => {
  if (!provider || provider.toLowerCase() === "unknown") return "11labs";
  return provider;
};

const displayTtsVoice = (provider?: string, voiceId?: string) => {
  if (!voiceId) return "default";

  const key = provider?.toLowerCase() || "";
  const providerVoices = VOICE_DATA[key];
  if (!providerVoices) return voiceId;

  const voice = providerVoices.find((v) => v.id === voiceId);
  return voice?.name || voiceId;
};

// ─── Badges ──────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; cls: string; dot: string }> = {
    completed: { label: "Completed", cls: "bg-green-500/10 text-green-700 border-green-400/30", dot: "bg-green-500" },
    initiated:  { label: "Initiated", cls: "bg-blue-500/10 text-blue-700 border-blue-400/30",  dot: "bg-blue-500" },
    queued:     { label: "Queued",    cls: "bg-amber-500/10 text-amber-700 border-amber-400/30", dot: "bg-amber-500" },
    failed:     { label: "Failed",    cls: "bg-red-500/10 text-red-700 border-red-400/30",      dot: "bg-red-500" },
  };
  const c = cfg[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const PlatformBadge = ({ platform }: { platform: string }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
    platform === "livekit"
      ? "bg-purple-500/10 text-purple-700 border-purple-400/30"
      : "bg-primary/10 text-primary border-primary/30"
  }`}>
    <Radio className="w-3 h-3" />
    {platform === "livekit" ? "LiveKit" : "Vapi"}
  </span>
);

// ─── Transcript Popup ─────────────────────────────────────────────────────────

const TranscriptPopup = ({ log, onClose }: { log: CallLog; onClose: () => void }) => {
  const turns: TranscriptEntry[] =
    typeof log.transcript === "string"
      ? log.transcript.split("\n").filter(Boolean).map((line) => {
          if (line.startsWith("AI:"))   return { speaker: "assistant" as const, text: line.replace(/^AI:\s*/, ""), timestamp: "" };
          if (line.startsWith("User:")) return { speaker: "user" as const, text: line.replace(/^User:\s*/, ""), timestamp: "" };
          return null;
        }).filter(Boolean) as TranscriptEntry[]
      : Array.isArray(log.transcript) ? log.transcript : [];

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full sm:max-w-2xl bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm sm:text-base truncate">Call Transcript</p>
              <p className="text-xs text-muted-foreground truncate">{log.candidateName || log.customerNumber} · {log.customerNumber}</p>
            </div>
            <PlatformBadge platform={log.platform} />
          </div>
          <button onClick={onClose} className="ml-2 w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary */}
        {log.summary && (
          <div className="px-4 sm:px-8 py-3 sm:py-4 bg-primary/5 border-b border-border flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">AI Summary</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{log.summary}</p>
          </div>
        )}

        {/* Turns */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-3 sm:space-y-4">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 sm:py-16">
              <FileText className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No transcript available for this call.</p>
            </div>
          ) : (
            turns.map((turn, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: turn.speaker === "assistant" ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.035 }}
                className={`flex gap-2 sm:gap-3 ${turn.speaker === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                  turn.speaker === "assistant"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground border border-border"
                }`}>
                  {turn.speaker === "assistant" ? "AI" : "U"}
                </div>
                <div className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm leading-relaxed max-w-[80%] sm:max-w-[78%] ${
                  turn.speaker === "assistant"
                    ? "bg-muted/60 text-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}>
                  <span className={`block text-[10px] font-bold mb-1 ${turn.speaker === "assistant" ? "text-primary" : "text-muted-foreground"}`}>
                    {turn.speaker === "assistant" ? "Vyom AI" : "User"}
                  </span>
                  {turn.text}
                  {turn.timestamp && (
                    <span className="block text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(turn.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Recording Popup ──────────────────────────────────────────────────────────

const RecordingPopup = ({ log, onClose }: { log: CallLog; onClose: () => void }) => {
  const url = log.recordingUrl!;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  const mimeType = ext === "ogg" ? "audio/ogg" : ext === "wav" ? "audio/wav" : "audio/mpeg";
  const fileName = url.split("/").pop()?.split("?")[0] ?? "recording";
  const { date, time } = formatDate(log.createdAt);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full sm:max-w-lg bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-border">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base">Call Recording</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{log.candidateName || log.customerNumber}</p>
            </div>
            <PlatformBadge platform={log.platform} />
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meta */}
        <div className="px-4 sm:px-8 py-3 sm:py-4 border-b border-border/50 flex flex-wrap items-center gap-3 sm:gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><Phone className="w-4 h-4" />{log.customerNumber}</span>
          {log.durationSeconds !== undefined && (
            <>
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" />{formatDuration(log.durationSeconds)}</span>
              <span className="flex items-center gap-2 font-semibold text-foreground">{calculateCost(log.durationSeconds, log.platform)}</span>
            </>
          )}
          <span className="text-xs sm:text-sm">{date} · {time}</span>
        </div>

        {/* Player */}
        <div className="px-4 sm:px-8 py-5 sm:py-6">
          <audio controls className="w-full rounded-xl" preload="metadata" key={url}>
            <source src={url} type={mimeType} />
            <source src={url} type="audio/ogg" />
            <source src={url} type="audio/wav" />
            <source src={url} type="audio/mpeg" />
          </audio>
          <p className="text-[11px] text-muted-foreground/50 text-center mt-3 truncate">{fileName}</p>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Desktop Table Row ────────────────────────────────────────────────────────

const CallRow = ({ log, index }: { log: CallLog; index: number }) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showRecording, setShowRecording] = useState(false);

  const { date, time } = formatDate(log.createdAt);
  const hasTranscript =
    (Array.isArray(log.transcript) && log.transcript.length > 0) ||
    (typeof log.transcript === "string" && log.transcript.trim().length > 0);

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="border-b border-border/40 hover:bg-muted/25 transition-colors group"
      >
        {/* Recipient */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-xs sm:text-sm text-foreground truncate max-w-[100px] sm:max-w-none">{log.candidateName || "Unknown"}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[100px] sm:max-w-none">{log.customerNumber}</p>
            </div>
          </div>
        </td>

        {/* Agent / Use case */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <p className="text-sm font-medium text-foreground">{log.usecase || "—"}</p>
          {log.companyName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3" />{log.companyName}
            </p>
          )}
        </td>

        {/* Demo by */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <p className="text-sm text-foreground">{log.initiatedByName || log.initiatedByEmail || 'unknown'}</p>
        </td>

        {/* Platform */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <PlatformBadge platform={log.platform} />
        </td>

        {/* Provider / Voice */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <p className="text-sm font-medium text-foreground">{displayTtsProvider(log.ttsProvider)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{displayTtsVoice(log.ttsProvider, log.ttsVoice)}</p>
        </td>

        {/* Status */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <StatusBadge status={log.status} />
        </td>

        {/* Duration & Cost */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {formatDuration(log.durationSeconds)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{calculateCost(log.durationSeconds, log.platform)}</p>
        </td>

        {/* Date */}
        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <p className="text-sm font-medium text-foreground">{date}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
        </td>

        <td className="px-3 sm:px-6 py-2.5 sm:py-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => hasTranscript && setShowTranscript(true)}
              title={hasTranscript ? "View Transcript" : "No transcript available"}
              className={`inline-flex items-center justify-center px-2 py-1.5 rounded-lg border transition-all ${
                hasTranscript
                  ? "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                  : "border-border/20 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => log.recordingUrl && setShowRecording(true)}
              title={log.recordingUrl ? "Play Recording" : "No recording available"}
              className={`inline-flex items-center justify-center px-2 py-1.5 rounded-lg border transition-all ${
                log.recordingUrl
                  ? "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                  : "border-border/20 text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
        </td>
      </motion.tr>

      <AnimatePresence>
        {showTranscript && <TranscriptPopup log={log} onClose={() => setShowTranscript(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showRecording && <RecordingPopup log={log} onClose={() => setShowRecording(false)} />}
      </AnimatePresence>
    </>
  );
};

// ─── Main CallLogs Component ──────────────────────────────────────────────────

interface CallLogsProps {
  open: boolean;
  onClose: () => void;
  baseUrl: string;
  authEmail?: string;
  defaultViewMode?: 'all' | 'mine';
}

export const CallLogs = ({ open, onClose, baseUrl, authEmail, defaultViewMode }: CallLogsProps) => {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'mine'>(defaultViewMode || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  useEffect(() => {
    if (!defaultViewMode) return;
    setViewMode(defaultViewMode);
  }, [defaultViewMode]);

  const fetchLogs = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const flag = getSiteFlag();
    const query: string[] = [`siteFlag=${flag}`];
    
    if (viewMode === 'mine' && authEmail) {
      query.push(`initiatedByEmail=${encodeURIComponent(authEmail)}`);
    }
    
    // Add status filter to query if not 'all'
    if (statusFilter !== 'all') {
      query.push(`status=${statusFilter}`);
    }

    const res = await fetch(`${baseUrl}/api/prompts/calls?${query.join('&')}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    
    const list: CallLog[] = Array.isArray(json.data) ? json.data : [];
    setLogs(list);
  } catch (e: any) {
    setError(e.message ?? "Failed to load call logs.");
  } finally {
    setLoading(false);
  }
}, [baseUrl, viewMode, authEmail, statusFilter]);

// Derived data for pagination
const totalPages = Math.ceil(logs.length / pageSize);
const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

// Helper to reset pagination when filters change
useEffect(() => { setCurrentPage(1); }, [statusFilter, viewMode]);

  useEffect(() => { if (open) fetchLogs(); }, [open, fetchLogs]);

  if (!open) return null;

  const completed = logs.filter(l => l.status === "completed").length;
  const queued    = logs.filter(l => l.status === "queued").length;
  const initiated = logs.filter(l => l.status === "initiated").length;

  return (
    <div className="relative w-full flex flex-col bg-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="w-full bg-card border-border sm:border overflow-hidden flex flex-col min-h-screen"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-base sm:text-xl leading-none">Call Logs</h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{logs.length} total calls</p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              {/* <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'all' ? 'bg-primary text-white' : 'bg-muted/20 text-muted-foreground'}`}
              >
                All
              </button> */}
              {/* <button
                onClick={() => setViewMode('mine')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'mine' ? 'bg-primary text-white' : 'bg-muted/20 text-muted-foreground'}`}
              >
                My Demos
              </button> */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
  {[
    { id: 'all', label: 'All', color: 'bg-primary' },
    { id: 'completed', label: 'Completed', color: 'bg-green-600' },
    { id: 'initiated', label: 'Initiated', color: 'bg-blue-600' },
    { id: 'queued', label: 'Queued', color: 'bg-amber-600' },
    { id: 'failed', label: 'Failed', color: 'bg-red-600' },
  ].map((f) => {
    const count = f.id === 'all' ? logs.length : logs.filter(l => l.status === f.id).length;
    const isActive = statusFilter === f.id;
    
    return (
      <button
        key={f.id}
        onClick={() => setStatusFilter(f.id)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap text-xs font-semibold ${
          isActive 
            ? `${f.color} text-white border-transparent shadow-sm` 
            : 'bg-muted/10 text-muted-foreground border-border/40 hover:bg-muted/30'
        }`}
      >
        <span>{f.label}</span>
      </button>
    );
  })}
</div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-9 px-3 gap-1.5 text-xs sm:text-sm sm:px-4">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center gap-4 py-24 sm:py-32">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-base text-muted-foreground">Fetching call logs…</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-4 py-24 sm:py-32">
              <PhoneOff className="w-10 h-10 text-destructive/50" />
              <p className="text-base text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchLogs}>Retry</Button>
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-24 sm:py-32">
              <PhoneMissed className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-base text-muted-foreground">No call logs found.</p>
            </div>
          )}

          {!loading && !error && logs.length > 0 && (
            /* Single horizontally-scrollable table for ALL screen sizes */
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[640px]">
                <thead className="border-b border-border bg-muted/20 sticky top-0 z-10">
                  <tr>
                    {[
                      { label: "Recipient",        w: "" },
                      { label: "Agent / Use Case", w: "" },
                      { label: "Demo Given By",    w: "w-36" },
                      { label: "Platform",         w: "w-24" },
                      { label: "Provider", w: "w-32" },
                      { label: "Status",           w: "w-28" },
                      { label: "Duration & Cost",  w: "w-32" },
                      { label: "Date & Time",      w: "w-32" },
                      { label: "Actions",          w: "w-44" },
                    ].map(h => (
                      <th key={h.label} className={`px-3 sm:px-6 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap ${h.w}`}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <CallRow key={log._id} log={log} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && logs.length > 0 && (
          <div className="px-4 sm:px-8 py-3 sm:py-4 border-t border-border flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 bg-muted/10">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{logs.length}</span> records · sorted newest first
            </p>
            <p className="text-[11px] text-muted-foreground/60 hidden sm:block">
              Greyed-out buttons indicate transcript or recording is unavailable
            </p>
          </div>
        )}
        {/* {!loading && logs.length > pageSize && (
  <div className="flex items-center gap-2">
    <Button 
      variant="outline" 
      size="sm" 
      disabled={currentPage === 1} 
      onClick={() => setCurrentPage(p => p - 1)}
      className="h-8 w-8 p-0"
    >
      <ChevronDown className="w-4 h-4 rotate-90" />
    </Button>
    
    <span className="text-xs font-medium">
      Page {currentPage} of {totalPages}
    </span>

    <Button 
      variant="outline" 
      size="sm" 
      disabled={currentPage === totalPages} 
      onClick={() => setCurrentPage(p => p + 1)}
      className="h-8 w-8 p-0"
    >
      <ChevronDown className="w-4 h-4 -rotate-90" />
    </Button>
  </div>
)} */}
      </motion.div>
    </div>
  );
};