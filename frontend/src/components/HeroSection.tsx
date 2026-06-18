import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PersonaCard } from "@/components/PersonaCard";
import { ConversationView } from "@/components/ConversationView";
import { ConfigureModal } from "@/components/ConfigureModal";
import { useBrandName } from "@/hooks/useBrandName";
import { useCases as enrichmentData, UseCase } from "@/data/useCases";
import {
  Phone,
  Settings,
  Loader2,
  Plus,
  X, User, Mic2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  Wand2,
  Users,
  Zap,
  PhoneCall,
  PhoneOutgoing,
  Building2,
  LogOut,
  Globe,
  Mic,
  MicOff,
  Bot, MoreVertical,
  PenIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import aiAvatarBank from "@/assets/ai-avatar-bank.png";
import humanAvatarBank from "@/assets/human-avatar-bank.png";
import { CallLogs } from "@/components/CallLogs";
import { AuthUser } from "@/components/livekit_bank/GoogleAuthScreen";

// LiveKit
import { LiveKitRoom, RoomAudioRenderer, VoiceAssistantControlBar } from "@livekit/components-react";
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
// ─── Constants ────────────────────────────────────────────────────────────────

const ASSISTANT_API = "https://api-livekit-vyom.indusnettechnologies.com";
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://your-livekit-url";

// ─── Site Flag ────────────────────────────────────────────────────────────────

const getSiteFlag = (): "vyom" | "vilok" => {
  const host = window.location.hostname;
  if (host.includes("demo.vilok.ai")) return "vilok";
  return "vyom";
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiUseCase {
  id: string;
  usecase: string;
  description: string;
  demoConversation: string;
  vapiAssistantId: string;
  livekitAssistantId: string;
  createdAt: string;
}
interface VoiceConfig {
  callService: string;
  voiceProvider: string;
  payloadProvider?: string;
  voiceId: string;
  trunkType: string;
  trunkId: string;
}
interface PersonalizedPromptEntry {
  _id: string;
  companyName: string;
  startMessage: string;
  createdAt: string;
  personalizedSystemPrompt: string;
}
interface Assistant {
  assistant_id: string;
  assistant_name: string;
  assistant_tts_model: string;
}

interface HeroSectionProps {
  authUser: AuthUser;
  onSignOut: () => void;
}
const parseConversation = (
  raw: string
): { role: "ai" | "human"; text: string }[] => {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("Vyom:") || line.startsWith("Vilok:"))
        return { role: "ai" as const, text: line.replace(/^(Vyom|Vilok):\s*/, "") };
      if (line.startsWith("User:"))
        return { role: "human" as const, text: line.replace(/^User:\s*/, "") };
      return null;
    })
    .filter(Boolean) as { role: "ai" | "human"; text: string }[];
};

const findEnrichment = (ucName: string): UseCase | null => {
  const needle = ucName
    .toLowerCase()
    .replace(/ai|agent|tutor|language/gi, "")
    .trim();
  return (
    enrichmentData.find((e) => {
      const haystack = e.name
        .toLowerCase()
        .replace(/ai|agent|tutor|language/gi, "")
        .trim();
      return haystack.includes(needle) || needle.includes(haystack);
    }) ?? null
  );
};

// ─── Ask Vyom AI — Agent Selector + LiveKit Call Modal ───────────────────────

type WebCallStep = "select" | "connecting" | "active";

const AskVyomModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<WebCallStep>("select");
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAssistantId, setSelectedAssistantId] = useState("");
  const [selectedAssistantName, setSelectedAssistantName] = useState("");
  const [liveKitToken, setLiveKitToken] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoadingAgents(true);
      try {
        const res = await fetch(
          `${ASSISTANT_API}/assistant/list?page=1&limit=20&sort_by=assistant_created_at&sort_order=desc`
        );
        const json = await res.json();
        if (json.success) {
          setAssistants(json.data.assistants || []);
        } else {
          throw new Error(json.message || "Failed to load agents");
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Could not load agents", description: err.message });
      } finally {
        setLoadingAgents(false);
      }
    };
    load();
  }, [isOpen]);

  const handleStartCall = async () => {
    if (!selectedAssistantId) return;
    setStep("connecting");
    try {
      const res = await fetch(`${ASSISTANT_API}/web_call/get_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_id: selectedAssistantId }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.token) throw new Error(json.message || "Token generation failed");
      setLiveKitToken(json.data.token);
      setStep("active");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Web Call Failed", description: err.message });
      setStep("select");
    }
  };

  const handleDisconnect = () => {
    setLiveKitToken("");
    setStep("select");
    setSelectedAssistantId("");
    setSelectedAssistantName("");
  };

  const handleClose = () => {
    handleDisconnect();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="ask-vyom-modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="fixed bottom-24 right-8 z-[60] w-[340px] sm:w-[380px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">
                {getSiteFlag() === "vilok" ? "Ask Vilok AI" : "Ask Vyom AI"}
              </p>
              {step === "active" && (
                <p className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                  Live · {selectedAssistantName}
                </p>
              )}
              {step === "select" && (
                <p className="text-[10px] text-muted-foreground">Select an agent to start</p>
              )}
              {step === "connecting" && (
                <p className="text-[10px] text-primary font-semibold">Connecting…</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait">
            {step === "select" && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Choose AI Agent
                  </label>
                  <Select
                    value={selectedAssistantId}
                    onValueChange={(v) => {
                      setSelectedAssistantId(v);
                      setSelectedAssistantName(
                        assistants.find((a) => a.assistant_id === v)?.assistant_name || ""
                      );
                    }}
                    disabled={loadingAgents}
                  >
                    <SelectTrigger className="h-11 text-sm border-border/60 bg-muted/30">
                      <SelectValue
                        placeholder={loadingAgents ? "Loading agents…" : "Select an agent…"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingAgents ? (
                        <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                        </div>
                      ) : assistants.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No agents available
                        </div>
                      ) : (
                        assistants.map((a) => (
                          <SelectItem key={a.assistant_id} value={a.assistant_id}>
                            <div className="flex items-center gap-2">
                              <Bot className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                              <span>{a.assistant_name}</span>
                              <span className="ml-auto text-[10px] uppercase text-muted-foreground/60 font-medium">
                                {a.assistant_tts_model}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedAssistantId && (
                  <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{selectedAssistantName}</p>
                      <p className="text-[10px] text-muted-foreground">Ready to connect</p>
                    </div>
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  </div>
                )}

                <Button
                  className="w-full h-11 font-semibold gap-2"
                  disabled={!selectedAssistantId || loadingAgents}
                  onClick={handleStartCall}
                >
                  <Mic className="w-4 h-4" />
                  Start Voice Call
                </Button>
              </motion.div>
            )}

            {step === "connecting" && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div
                    className="absolute inset-2 rounded-full border-4 border-primary/10 border-b-primary/60 animate-spin"
                    style={{ animationDirection: "reverse", animationDuration: "1.4s" }}
                  />
                  <Bot className="absolute inset-0 m-auto w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Connecting to {selectedAssistantName}…</p>
                <p className="text-xs text-muted-foreground">Setting up your voice session</p>
              </motion.div>
            )}

            {step === "active" && liveKitToken && (
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex flex-col items-center gap-2 py-3">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                    <div className="absolute inset-1 rounded-full bg-primary/5 border border-primary/20 animate-ping opacity-40" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Bot className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{selectedAssistantName}</p>
                  <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                    Call Active
                  </p>
                </div>

                <div className="rounded-xl bg-muted/30 border border-border/50 p-3">
                  <LiveKitRoom
                    video={false}
                    audio={true}
                    token={liveKitToken}
                    serverUrl={LIVEKIT_URL}
                    connect={true}
                    onDisconnected={handleDisconnect}
                    className="flex flex-col items-center gap-3"
                  >
                    <RoomAudioRenderer />
                    <div className="w-full max-w-[220px] mx-auto">
                      <VoiceAssistantControlBar />
                    </div>
                  </LiveKitRoom>
                </div>

                <Button
                  variant="outline"
                  className="w-full h-10 text-sm text-red-500 border-red-200 hover:bg-red-50/30 hover:text-red-600 gap-2"
                  onClick={handleDisconnect}
                >
                  <MicOff className="w-4 h-4" />
                  End Call
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Fallback Conversation View ───────────────────────────────────────────────

interface FallbackConversationProps {
  usecaseName: string;
  demoConversation: string;
  description?: string;
}

const FallbackConversationView = ({ usecaseName, demoConversation }: FallbackConversationProps) => {
  const turns = parseConversation(demoConversation);
  const AI_IMG = aiAvatarBank;
  const HUMAN_IMG = humanAvatarBank;
  const fallbackAi = "https://api.dicebear.com/7.x/bottts/svg?seed=vyom";
  const fallbackHuman = "https://api.dicebear.com/7.x/personas/svg?seed=user";

  const Avatar = ({ src, fallback, className = "" }: { src: string; fallback: string; className?: string }) => (
    <img src={src} alt="" className={className} onError={(e) => { (e.target as HTMLImageElement).src = fallback; }} />
  );

  return (
    <div className="pt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3">
        <Card className="p-5 h-full border-border/60 bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 text-center">AI Agent</p>
          <div className="flex flex-col items-center gap-3 mb-5">
            <Avatar src={AI_IMG} fallback={fallbackAi} className="w-20 h-20 rounded-full object-cover ring-2 ring-primary/30" />
            <div className="text-center">
              <p className="font-semibold text-base">{getSiteFlag() === "vilok" ? "Vilok AI" : "Vyom AI"}</p>
              <p className="text-sm text-muted-foreground">AI Voice Agent</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Role</p><p className="text-foreground">{usecaseName}</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Tone</p><p className="text-foreground">Professional &amp; Helpful</p></div>
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Primary Objective</p><p className="text-foreground">Assist users effectively via voice.</p></div>
          </div>
        </Card>
      </div>
      <div className="lg:col-span-6">
        <Card className="border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Sample Conversation</p>
          </div>
          <div className="p-4 max-h-[420px] overflow-y-auto space-y-4">
            {turns.length > 0 ? turns.map((turn, i) => (
              <div key={i} className="flex items-start gap-3">
                <Avatar src={turn.role === "ai" ? AI_IMG : HUMAN_IMG} fallback={turn.role === "ai" ? fallbackAi : fallbackHuman} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed flex-1 ${turn.role === "ai" ? "bg-muted/60 text-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  <span className="block text-[10px] font-bold mb-1 text-primary">{turn.role === "ai" ? (getSiteFlag() === "vilok" ? "Vilok" : "Vyom") : "User"}</span>
                  {turn.text}
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground py-8 text-center">No sample conversation available yet.</p>}
          </div>
        </Card>
      </div>
      <div className="lg:col-span-3">
        <Card className="p-5 h-full border-border/60 bg-card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 text-center">User</p>
          <div className="flex flex-col items-center gap-3 mb-5">
            <Avatar src={HUMAN_IMG} fallback={fallbackHuman} className="w-20 h-20 rounded-full object-cover ring-2 ring-border" />
            <div className="text-center"><p className="font-semibold text-base">User</p><p className="text-sm text-muted-foreground">Caller</p></div>
          </div>
          <div className="space-y-3 text-sm">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Expertise</p><p className="text-foreground">Prospect / Candidate</p></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Key Traits</p>
              <ul className="list-disc list-inside text-foreground space-y-0.5"><li>Goal-oriented</li><li>Responsive</li></ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Generating Tip ───────────────────────────────────────────────────────────

const TIPS = [
  "💡 Tip: The more detail you give, the sharper the agent.",
  "🎯 Crafting your conversation flow…",
  "🔧 Writing role-specific instructions…",
  "🗣️ Calibrating tone and response style…",
  "📋 Building objection handling logic…",
  "✨ Almost ready to deploy your agent!",
];

const GeneratingTip = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((p) => (p + 1) % TIPS.length), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="h-7 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.p key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35 }} className="text-xs text-muted-foreground text-center absolute inset-x-0">
          {TIPS[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

// ─── Add-UseCase Modal ────────────────────────────────────────────────────────

interface AddUseCaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (uc: ApiUseCase) => void;
}

type ModalStep = "form" | "generating" | "preview" | "saving" | "done";

const AddUseCaseModal = ({ open, onClose, onCreated }: AddUseCaseModalProps) => {
  const { toast } = useToast();
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const [step, setStep] = useState<ModalStep>("form");
  const [usecaseName, setUsecaseName] = useState("");
  const [description, setDescription] = useState("");
  const [generatedData, setGeneratedData] = useState<{ systemPrompt: string; demoConversation: string; description?: string } | null>(null);

  const reset = () => { setStep("form"); setUsecaseName(""); setDescription(""); setGeneratedData(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleGenerate = async () => {
    if (!usecaseName.trim() || !description.trim()) { toast({ variant: "destructive", title: "Fill both fields to continue." }); return; }
    setStep("generating");
    try {
      const res = await fetch(`${baseUrl}/api/prompts/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usecase: usecaseName, description, siteFlag: getSiteFlag() }) });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setGeneratedData({ systemPrompt: json.data.systemPrompt, demoConversation: json.data.demoConversation, description: json.data.description });
      setStep("preview");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Generation failed", description: e.message });
      setStep("form");
    }
  };

  const handleSave = async () => {
    if (!generatedData) return;
    setStep("saving");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/prompts/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "prompt-studio-user", usecase: usecaseName, description: generatedData.description, systemPrompt: generatedData.systemPrompt, demoConversation: generatedData.demoConversation, siteFlag: getSiteFlag() }) });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setStep("done");
      setTimeout(() => {
        onCreated({ id: json.data._id, usecase: json.data.usecase, description: json.data.description, demoConversation: json.data.demoConversation, vapiAssistantId: json.data.vapiAssistantId, livekitAssistantId: json.data.livekitAssistantId, createdAt: json.data.createdAt });
        handleClose();
      }, 1200);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
      setStep("preview");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full h-full sm:h-auto sm:max-w-2xl bg-card border border-border sm:rounded-2xl rounded-none overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-primary" /><span className="font-semibold text-base">Create New Use Case</span></div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {step === "form" && (
              <motion.div key="form" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Use Case Category</Label>
                  <Input placeholder="e.g. Spanish Language Tutor" value={usecaseName} onChange={(e) => setUsecaseName(e.target.value)} className="h-11 text-base" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
                  <textarea placeholder="Describe what this AI agent should do, its tone, goals, and any specific behaviours..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <Button onClick={handleGenerate} className="w-full text-base"><Sparkles className="w-4 h-4 mr-2" /> Generate with AI</Button>
              </motion.div>
            )}
            {step === "generating" && (
              <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 py-2">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-2 rounded-full border-4 border-primary/10 border-b-primary/60 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.6s" }} />
                    <Wand2 className="absolute inset-0 m-auto w-5 h-5 text-primary" />
                  </div>
                  <p className="font-semibold text-base">Generating your AI agent…</p>
                  <p className="text-xs text-muted-foreground">This takes around 60 seconds. Here's what's being built:</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1"><Zap className="w-3 h-3 text-primary" /><p className="text-[10px] font-bold uppercase tracking-widest text-primary">System Prompt</p></div>
                    {[80, 60, 90, 50, 70, 40].map((w, i) => (<motion.div key={i} className="h-2 rounded-full bg-primary/20" initial={{ width: 0, opacity: 0 }} animate={{ width: `${w}%`, opacity: 1 }} transition={{ delay: i * 0.18, duration: 0.5, ease: "easeOut" }} />))}
                    <motion.div className="h-2 w-1 rounded-full bg-primary" animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1"><Users className="w-3 h-3 text-primary" /><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Conversation</p></div>
                    {[{ role: "ai", w: 85 }, { role: "human", w: 55 }, { role: "ai", w: 70 }, { role: "human", w: 45 }, { role: "ai", w: 80 }].map((item, i) => (
                      <motion.div key={i} className={`flex ${item.role === "human" ? "justify-end" : ""}`} initial={{ opacity: 0, x: item.role === "ai" ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.2, duration: 0.4 }}>
                        <div className={`h-2 rounded-full ${item.role === "ai" ? "bg-primary/30" : "bg-border"}`} style={{ width: `${item.w}%` }} />
                      </motion.div>
                    ))}
                    <motion.div className="h-2 w-1 rounded-full bg-primary" animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} />
                  </div>
                </div>
                <GeneratingTip />
              </motion.div>
            )}
            {step === "preview" && generatedData && (
              <motion.div key="preview" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Sample Conversation Preview</p>
                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 text-sm">
                    {parseConversation(generatedData.demoConversation).map((turn, i) => (
                      <p key={i}>
                        <span className={turn.role === "ai" ? "font-semibold text-primary" : "font-semibold text-foreground"}>{turn.role === "ai" ? (getSiteFlag() === "vilok" ? "Vilok" : "Vyom") : "User"}: </span>
                        <span className="text-muted-foreground">{turn.text}</span>
                      </p>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep("form")}>← Edit</Button>
                  <Button className="flex-1" onClick={handleSave}>Save &amp; Deploy</Button>
                </div>
              </motion.div>
            )}
            {step === "saving" && (
              <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-10">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-base text-muted-foreground">Deploying to Vapi &amp; INTVoiceKit…</p>
              </motion.div>
            )}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-10">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <p className="font-semibold text-base">Use Case Created!</p>
                <p className="text-sm text-muted-foreground">Adding to your dropdown…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Personalized Call Modal ──────────────────────────────────────────────────

interface PersonalizedCallModalProps {
  prompt: PersonalizedPromptEntry;
  usecaseName: string;
  onClose: () => void;
  onCall: (recipientName: string, phoneNumber: string, voiceConfig?: Partial<VoiceConfig>) => void;
  calling: boolean;
  currentConfig: VoiceConfig;
}

const PROVIDERS: Record<string, { id: string; label: string }[]> = {
  vapi: [
    { id: "11labs", label: "11 Labs" },
    { id: "cartesia", label: "Cartesia" },
  ],
  livekit: [
    { id: "11labs", label: "11 Labs" },
    { id: "cartesia", label: "Cartesia" },
    { id: "sarvam", label: "Sarvam" },
  ],
};

// ── Pill group (same pattern as ConfigureModal) ───────────────────────────────

const PillGroup = ({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) => (
  <div className="bg-muted/50 border p-1 rounded-xl flex gap-1 flex-wrap">
    {options.map((opt) => (
      <button
        key={opt.id}
        type="button"
        onClick={() => onChange(opt.id)}
        className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${value === opt.id
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
          }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const PersonalizedCallModal = ({
  prompt,
  usecaseName,
  onClose,
  onCall,
  calling,
  currentConfig,
}: PersonalizedCallModalProps) => {
  const [recipientName, setRecipientName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("+");
  const [showVoice, setShowVoice] = useState(false);

  // Local voice state seeded from the global config
  const [voiceProvider, setVoiceProvider] = useState(currentConfig.voiceProvider || "cartesia");
  const [voiceId, setVoiceId] = useState(currentConfig.voiceId || "95d51f79-c397-46f9-b49a-23763d3eaa2d");

  const availableProviders = PROVIDERS[currentConfig.callService] ?? PROVIDERS.livekit;

  const handleProviderChange = (val: string) => {
    setVoiceProvider(val);
    // Reset to first voice of the new provider
    const firstVoice = VOICE_DATA[val]?.[0];
    if (firstVoice) setVoiceId(firstVoice.id);
  };

  const activeVoiceName =
    VOICE_DATA[voiceProvider]?.find((v) => v.id === voiceId)?.name ?? "Default";

  const serviceLabel =
    currentConfig.callService === "vapi" ? "Vapi" : "INTVoiceKit";

  const providerLabel =
    availableProviders.find((p) => p.id === voiceProvider)?.label ?? voiceProvider;

  // Did the user change anything from the global config?
  const voiceChanged =
    voiceProvider !== currentConfig.voiceProvider ||
    voiceId !== currentConfig.voiceId;

  const handleSubmit = () => {
    if (!recipientName.trim() || phoneNumber.length < 8) return;
    onCall(
      recipientName.trim(),
      phoneNumber,
      voiceChanged ? { voiceProvider, voiceId } : undefined
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full h-full sm:h-auto sm:max-w-sm bg-card border border-border sm:rounded-2xl rounded-none overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <PhoneOutgoing className="w-4 h-4 text-primary" />
            <span className="font-semibold text-base">Quick Call</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-auto">
          {/* Persona chip */}
          <div className="flex items-center gap-2.5 rounded-lg bg-primary/8 border border-primary/20 px-3 py-2.5">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{prompt.companyName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{usecaseName}</p>
            </div>
          </div>

          {/* ── Active Voice Badge + expand toggle ── */}
          <button
            type="button"
            onClick={() => setShowVoice((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 hover:border-primary/30 hover:bg-muted/50 px-3 py-2.5 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Mic2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-0.5">
                  Active Voice
                </p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <p className="text-xs font-semibold text-foreground">
                    {serviceLabel} — {providerLabel} · {activeVoiceName}
                    {voiceChanged && (
                      <span className="ml-1.5 text-[10px] font-normal text-primary">(changed)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-muted-foreground group-hover:text-foreground transition-colors">
              {showVoice ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* ── Inline voice selectors (expand/collapse) ── */}
          <AnimatePresence initial={false}>
            {showVoice && (
              <motion.div
                key="voice-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 space-y-3">
                  {/* Provider */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Provider
                    </span>
                    <PillGroup
                      options={availableProviders}
                      value={voiceProvider}
                      onChange={handleProviderChange}
                    />
                  </div>

                  {/* Voice name */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Voice Name
                    </span>
                    <PillGroup
                      options={(VOICE_DATA[voiceProvider] ?? []).map((v) => ({
                        id: v.id,
                        label: v.name,
                      }))}
                      value={voiceId}
                      onChange={setVoiceId}
                    />
                  </div>

                  {voiceChanged && (
                    <p className="text-[10px] text-primary/70 text-center">
                      This change applies to this call only — global config is unchanged.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recipient fields */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recipient Name
            </Label>
            <Input
              placeholder="Full Name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="h-11 text-base"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Phone Number
            </Label>
            <Input
              placeholder="+1…"
              value={phoneNumber}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || val === "+") setPhoneNumber("+");
                else if (val.startsWith("+")) setPhoneNumber(val);
                else setPhoneNumber("+" + val);
              }}
              className="h-11 text-base"
            />
          </div>
        </div>

        {/* Footer CTA */}
        <div className="p-5 flex-shrink-0 border-t border-border">
          <Button
            onClick={handleSubmit}
            disabled={calling || !recipientName.trim() || phoneNumber.length < 8}
            className="w-full py-5 text-base font-semibold"
          >
            {calling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Phone className="w-4 h-4 mr-2" />
            )}
            {calling ? "Initiating…" : "Start Call"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Call Steps ───────────────────────────────────────────────────────────────

const CALL_STEPS = [
  { icon: "🧠", label: "Analyzing use case", sub: "Reading your selected workflow" },
  { icon: "🏢", label: "Fetching company context", sub: "Personalizing for your organization" },
  { icon: "✏️", label: "Transforming prompt", sub: "Injecting candidate & company details" },
  { icon: "🎙️", label: "Configuring voice engine", sub: "Selecting optimal TTS settings" },
  { icon: "📡", label: "Initiating SIP trunk", sub: "Establishing secure call route" },
  { icon: "🤖", label: `Connecting to ${getSiteFlag() === "vilok" ? "Vilok" : "Vyom"} AI`, sub: "Your agent is about to speak…" },
];

const FAST_CALL_STEPS = [
  { icon: "🤖", label: `Connecting to ${getSiteFlag() === "vilok" ? "Vilok" : "Vyom"} AI`, sub: "Your agent is about to speak…" },
];

// ─── Call Loading Modal ───────────────────────────────────────────────────────

const CallLoadingModal = ({ active, statusIndex, steps = CALL_STEPS }: { active: boolean; statusIndex: number; steps?: typeof CALL_STEPS }) => {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 60, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 60, scale: 0.97 }} transition={{ type: "spring", damping: 28, stiffness: 300 }} className="w-full h-full sm:h-auto sm:max-w-xl bg-card border border-border sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 sm:px-8 pt-6 sm:pt-7 pb-4 sm:pb-5 text-center border-b border-border/50 flex-shrink-0">
          <div className="relative mx-auto w-16 h-16 mb-3">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-primary/10 border-b-primary/60 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.4s" }} />
            <Phone className="absolute inset-0 m-auto w-6 h-6 text-primary" />
          </div>
          <h3 className="font-bold text-lg sm:text-xl text-foreground">Initiating Live Call</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Setting everything up for you…</p>
        </div>
        <div className="p-4 sm:p-6 space-y-2.5 sm:space-y-3 flex-1 overflow-auto">
          {steps.map((step, i) => {
            const isDone = i < statusIndex; const isActive = i === statusIndex; const isPending = i > statusIndex;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: isPending ? 0.35 : 1, x: 0 }} transition={{ delay: i * 0.06 }} className={`flex items-center gap-3 rounded-xl px-4 py-3 sm:py-3.5 transition-all duration-500 ${isActive ? "bg-primary/10 border border-primary/25" : "bg-muted/30"}`}>
                <span className="text-xl w-7 text-center flex-shrink-0">{step.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm sm:text-base font-semibold truncate ${isActive ? "text-primary" : isDone ? "text-foreground/60" : "text-foreground"}`}>{step.label}</p>
                  {isActive && (<motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-xs text-muted-foreground mt-0.5">{step.sub}</motion.p>)}
                </div>
                <div className="flex-shrink-0">
                  {isDone && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}><CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /></motion.div>)}
                  {isActive && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-spin" />}
                  {isPending && <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-border/50" />}
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="px-4 sm:px-6 pb-6 sm:pb-8 flex-shrink-0 border-t border-border/50">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-4">
            <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((statusIndex + 1) / steps.length) * 100}%` }} transition={{ duration: 0.6, ease: "easeInOut" }} />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Step {Math.min(statusIndex + 1, steps.length)} of {steps.length}</p>
        </div>
      </motion.div>
    </div>
  );
};
const EditPromptModal = ({
  isOpen,
  onClose,
  prompt,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  prompt: PersonalizedPromptEntry;
  onSave: (id: string, newText: string) => void;
}) => {
  const [text, setText] = useState(prompt.personalizedSystemPrompt);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl bg-card border-border shadow-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Edit Personalized Prompt: {prompt.companyName}</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <textarea
          className="w-full h-[400px] p-4 text-xs font-mono bg-muted/30 border rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(prompt._id, text); onClose(); }}>Save Changes</Button>
        </div>
      </Card>
    </div>
  );
};

// ─── Main HeroSection ─────────────────────────────────────────────────────────

export const HeroSection = ({ authUser, onSignOut }: HeroSectionProps) => {
  const navigate = useNavigate();
  const brandName = useBrandName();
  const { toast } = useToast();
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [useCases, setUseCases] = useState<ApiUseCase[]>([]);
  const [loadingUseCases, setLoadingUseCases] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPersonaConversation, setShowPersonaConversation] = useState(false);
  const [personalizedPrompts, setPersonalizedPrompts] = useState<PersonalizedPromptEntry[]>([]);
  const [loadingPersonalized, setLoadingPersonalized] = useState(false);
  const [activePersonalizedPrompt, setActivePersonalizedPrompt] = useState<PersonalizedPromptEntry | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [callStepIndex, setCallStepIndex] = useState(0);
  const [callMode, setCallMode] = useState<"new" | "personalized">("new");
  const [showCallLogs, setShowCallLogs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [userNumber, setUserNumber] = useState("+");
  const [config, setConfig] = useState({ callService: "livekit", voiceProvider: "cartesia", payloadProvider: "cartesia", voiceId: "95d51f79-c397-46f9-b49a-23763d3eaa2d", trunkType: "exotel", trunkId: "exotel_ff2a62f4" });
  const [editingPrompt, setEditingPrompt] = useState<PersonalizedPromptEntry | null>(null);
  const [askVyomOpen, setAskVyomOpen] = useState(false);
const TIMER_ACCOUNTS = [
  "test@intglobal.com",
  "test_luping@gmail.com",
  "test_sentis@gmail.com",
  "test_neuland@gmail.com",
  "test_rpgls@gmail.com",
  "test_serovia@intglobal.com",
  "test_afli@gmail.com",
  "test_blue@gmail.com",
  "test_employ@gmail.com",
  "test_insideout@gmail.com",
  "test_aludecor@gmail.com",
];
  const fetchUseCases = useCallback(async () => {
    setLoadingUseCases(true);
    try {
      const flag = getSiteFlag();
      const res = await fetch(`${baseUrl}/api/prompts/all?siteFlag=${flag}`);
      const json = await res.json();
      const list: ApiUseCase[] = Array.isArray(json.data) ? json.data : [];
      setUseCases(list);
    } catch {
      toast({ variant: "destructive", title: "Could not load use cases." });
    } finally {
      setLoadingUseCases(false);
    }
  }, [baseUrl]);

  useEffect(() => { fetchUseCases(); }, [fetchUseCases]);
  useEffect(() => {
    // 1. Guard: only run if there is an auth user and they are in the test list
    if (!authUser || !TIMER_ACCOUNTS.includes(authUser.email)) return;

    // We use a new key (_v2_) to force the browser to forget any broken 167-hour timers
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
            setTimeLeft("Expired");
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

    // Run immediately, then set interval
    const isActive = calculateTime();
    if (isActive) {
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }
}, [authUser, onSignOut]);

  const fetchPersonalizedPrompts = useCallback(async (usecaseId: string) => {
    setLoadingPersonalized(true);
    setPersonalizedPrompts([]);
    try {
      const res = await fetch(`${baseUrl}/api/prompts/${usecaseId}/personalized`);
      const json = await res.json();
      setPersonalizedPrompts(Array.isArray(json.data) ? json.data : []);
    } catch {
      setPersonalizedPrompts([]);
    } finally {
      setLoadingPersonalized(false);
    }
  }, [baseUrl]);
  const handleUpdatePersonalizedPrompt = async (id: string, newPrompt: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/prompts/personalized/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizedSystemPrompt: newPrompt })
      });
      if (res.ok) toast({ title: "Template Updated" });
    } catch (e) {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  const selectedUseCase = useCases.find((uc) => uc.id === selectedId) ?? null;

  const handleSelectChange = (val: string) => { setSelectedId(val); setShowPersonaConversation(false); fetchPersonalizedPrompts(val); };
  const handleUseCaseCreated = (newUc: ApiUseCase) => { setUseCases((prev) => [newUc, ...prev]); setSelectedId(newUc.id); setShowPersonaConversation(false); };

  const handleSaveConfig = async (newConfig: any) => {
    setConfig(newConfig);
    if (!selectedUseCase) { setShowConfig(false); return; }
    try {
      let payload: any = { usecaseId: selectedUseCase.id, platform: newConfig.callService };
      if (newConfig.callService === "livekit") {
        payload.assistant_tts_model = newConfig.payloadProvider ?? newConfig.voiceProvider;
        if (newConfig.voiceProvider === "cartesia") { payload.assistant_tts_config = { voice_id: newConfig.voiceId }; }
        else if (newConfig.voiceProvider === "sarvam") { payload.assistant_tts_config = { speaker: newConfig.voiceId, target_language_code: "en-IN" }; }
        else { payload.assistant_tts_config = { voice_id: newConfig.voiceId }; }
      } else { payload.provider = newConfig.voiceProvider; payload.voiceId = newConfig.voiceId; }
      const res = await fetch(`${baseUrl}/api/prompts/tts`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Configuration Synced", description: `Agent successfully updated to ${newConfig.voiceProvider} (${newConfig.callService === 'vapi' ? 'Vapi' : 'INT Voice Kit'}).` });
      setShowConfig(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Could not update the agent's voice settings: " + error.message });
      setShowConfig(false);
    }
  };

  const handleStartCall = async () => {
    if (!userNumber.startsWith("+") || userNumber.length < 8) { toast({ variant: "destructive", title: "Invalid Number", description: "Number must include country code (e.g., +1234567890)." }); return; }
    if (!userName || !selectedUseCase) { toast({ variant: "destructive", title: "Missing fields", description: "Please select a use case and enter recipient name." }); return; }
    setCallActive(true); setCallStepIndex(0); setCallMode("new");
    const STEP_DURATION = 10000;
    const stepTimeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < CALL_STEPS.length - 1; i++) { stepTimeouts.push(setTimeout(() => setCallStepIndex(i), i * STEP_DURATION)); }
    stepTimeouts.push(setTimeout(() => setCallStepIndex(CALL_STEPS.length - 1), (CALL_STEPS.length - 1) * STEP_DURATION));
    try {
      const payload = config.callService === "livekit"
        ? { usecaseId: selectedUseCase.id, platform: "livekit", companyName, candidateName: userName, phoneNumber: userNumber, trunkId: config.trunkId, initiatedBy: authUser.email, initiatedByName: authUser.name, ttsProvider: config.voiceProvider, ttsVoice: config.voiceId }
        : { usecaseId: selectedUseCase.id, platform: "vapi", companyName, candidateName: userName, phoneNumber: userNumber, initiatedBy: authUser.email, initiatedByName: authUser.name, ttsProvider: config.voiceProvider, ttsVoice: config.voiceId };
      const res = await fetch(`${baseUrl}/api/prompts/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      toast({
        title: "Call Dispatched! 🚀",
        description: `The AI is now dialing ${userName} at ${userNumber}.`,
      });
      if (selectedUseCase) fetchPersonalizedPrompts(selectedUseCase.id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Call Connection Failed",
        description: error.message
      });
    } finally {
      stepTimeouts.forEach(clearTimeout); setCallActive(false); setCallStepIndex(0);
    }
  };

  const enrichment = selectedUseCase ? findEnrichment(selectedUseCase.usecase) : null;

  const handlePersonalizedCall = async (recipientName: string, phoneNumber: string, voiceOverride?: Partial<VoiceConfig>) => {
    const effectiveConfig = voiceOverride
      ? { ...config, ...voiceOverride }
      : config;
    if (!activePersonalizedPrompt || !selectedUseCase) return;
    if (!phoneNumber.startsWith("+") || phoneNumber.length < 8) { toast({ variant: "destructive", title: "Invalid Number", description: "Number must include country code (e.g., +1234567890)." }); return; }
    setCallActive(true); setCallStepIndex(0); setCallMode("personalized");
    const statusInterval = setInterval(() => { setCallStepIndex((prev) => Math.min(prev + 1, FAST_CALL_STEPS.length - 1)); }, 700);
    try {
      const payload = config.callService === "livekit"
        ? { usecaseId: selectedUseCase.id, platform: "livekit", candidateName: recipientName, phoneNumber, trunkId: config.trunkId, personalizedPromptId: activePersonalizedPrompt._id, initiatedBy: authUser.email, initiatedByName: authUser.name, ttsProvider: effectiveConfig.voiceProvider, ttsVoice: effectiveConfig.voiceId }
        : { usecaseId: selectedUseCase.id, platform: "vapi", candidateName: recipientName, phoneNumber, personalizedPromptId: activePersonalizedPrompt._id, initiatedBy: authUser.email, initiatedByName: authUser.name, ttsProvider: effectiveConfig.voiceProvider, ttsVoice: effectiveConfig.voiceId };
      const res = await fetch(`${baseUrl}/api/prompts/call`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      setActivePersonalizedPrompt(null);
      toast({
        title: "Personalized Call Active",
        description: `Calling ${recipientName} using the ${activePersonalizedPrompt.companyName} template.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Personalized Call Failed",
        description: error.message
      });
    } finally {
      clearInterval(statusInterval); setCallActive(false); setCallStepIndex(0);
    }
  };

  return (
    <>
      {/* ─── SUB-NAVBAR ──────────────────────────────────────────────────────── */}
      <div className="fixed top-[80px] left-0 right-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-stretch justify-between h-12">
          <div className="flex items-center" />

          <div className="flex items-stretch divide-x divide-border/40">
            {/* ── Profile + 3-dot menu ── */}
            <div className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-4">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {authUser.picture ? (
                  <img
                    src={authUser.picture}
                    alt={authUser.name}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-primary/30"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border-2 border-background" />
              </div>

              {/* Name / email (desktop only) */}
              <div className="hidden md:block leading-tight max-w-[140px]">
  <p className="text-xs font-semibold text-foreground truncate">{authUser.name}</p>
  {TIMER_ACCOUNTS.includes(authUser.email) && timeLeft ? (
    <p className="text-[10px] font-bold text-orange-500 animate-pulse">
      Expires: {timeLeft}
    </p>
  ) : (
    <p className="text-[10px] text-muted-foreground truncate">{authUser.email}</p>
  )}
</div>

              {/* ⋮ Three-dot button */}
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                title="Menu"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all flex-shrink-0"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* ── Dropdown ── */}
              {showProfileMenu && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  />

                  <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-visible py-1">

                    {/* All Calls */}
                    <button
                      onClick={() => {
                        setViewMode("all");
                        navigate("/calls?view=all");
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/8 hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-muted-foreground" />
                      All Calls
                    </button>

                    {/* My Demos */}
                    <button
                      onClick={() => {
                        setViewMode("mine");
                        navigate("/calls?view=mine");
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/8 hover:text-primary transition-colors flex items-center gap-2"
                    >
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      My Demos
                    </button>

                    {/* ── INT Intelligence — click navigates, hover shows submenu ── */}
                    <div className="relative group/int">
                      <button
                        onClick={() => {
                          navigate("/livekit");
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-foreground hover:bg-primary/8 hover:text-primary transition-colors flex items-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="flex-1">INT Intelligence</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground group-hover/int:-rotate-90 transition-transform" />
                      </button>

                      {/* Sub-panel — shown on hover via Tailwind group */}
                      <div className="absolute left-full top-0 ml-1 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 py-1
                                      opacity-0 pointer-events-none scale-95 origin-top-left
                                      group-hover/int:opacity-100 group-hover/int:pointer-events-auto group-hover/int:scale-100
                                      transition-all duration-150">
                        {[
                          { label: "Tour Concierge", path: "/livekit/tour", icon: "🗺️" },
                          { label: "Bandhan Banking", path: "/livekit/bandhan_banking", icon: "🏦" },
                          { label: "Wealth Advisor", path: "/livekit/bank", icon: "💰" },
                          { label: "Ambuja Neotia", path: "/livekit/ambuja", icon: "🏡" },
                          { label: "GS1 Agent", path: "/livekit/gs1", icon: "📋" },
                          { label: "Case Manager", path: "/livekit/case_manager", icon: "📁" },
                          { label: "Blue Cross",      path: "/blue_cross",             icon: "💊" },
                        ].map(({ label, path, icon }) => (
                          <button
                            key={path}
                            onClick={() => {
                              navigate(path);
                              setShowProfileMenu(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/8 hover:text-primary transition-colors flex items-center gap-2.5"
                          >
                            <span className="text-sm leading-none">{icon}</span>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="my-1 border-t border-border/50" />

                    {/* Logout */}
                    <button
                      onClick={() => {
                        onSignOut();
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/8 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center py-12 sm:py-16 px-4 pt-[128px]">
        <AskVyomModal isOpen={askVyomOpen} onClose={() => setAskVyomOpen(false)} />
        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-foreground">
              {getSiteFlag() === "vilok" ? "VILOK" : "VYOM"}{" "}
              <span className="text-primary">AI</span>
            </h1>
            <p className="mt-3 text-base text-muted-foreground font-medium tracking-wide">
              Voice AI Infrastructure for Scale &amp; Automation
            </p>
          </div>

          <div className="mb-2">
            <Select value={selectedId ?? ""} onValueChange={handleSelectChange} disabled={loadingUseCases}>
              <SelectTrigger className="bg-card h-14 border-border text-base w-full">
                {loadingUseCases ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading use cases…
                  </span>
                ) : (
                  <SelectValue placeholder="Select a use case category to get started…" />
                )}
              </SelectTrigger>
              <SelectContent>
                {useCases.map((uc) => (
                  <SelectItem key={uc.id} value={uc.id} className="text-base">
                    {uc.usecase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end mb-6">
            <p className="text-sm text-muted-foreground">
              Each use case is pre-configured with a conversation flow, system prompt, and AI agent.
            </p>
          </div>
          <div className="flex justify-end mb-8">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add a new use case
            </button>
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {selectedUseCase && (
              <motion.div
                key={selectedUseCase.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6 w-full"
              >
                <div className="text-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">{selectedUseCase.usecase}</h2>
                  {selectedUseCase.description && (
                    <div className="relative mx-auto max-w-2xl">
                      <div className="absolute inset-0 rounded-xl bg-primary/10 blur-sm" />
                      <div className="relative rounded-xl border border-primary/25 bg-primary/8 px-5 py-3">
                        <span className="text-sm text-foreground/80 leading-relaxed">{selectedUseCase.description}</span>
                      </div>
                    </div>
                  )}
                </div>

                {(loadingPersonalized || personalizedPrompts.length > 0) && (
                  <Card className="p-5 border-border/50 bg-card/30 backdrop-blur-sm">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                      <Users className="w-3 h-3" /> Saved Personalizations
                    </h3>
                    {loadingPersonalized ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {personalizedPrompts.map((p) => (
                          <div key={p._id} className="relative group p-3 border rounded-xl bg-muted/30 hover:border-primary/40 transition-all">
                            <div className="flex justify-between items-start mb-2">
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{p.companyName}</p>
                                <p className="text-[10px] text-muted-foreground italic">Template</p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => setEditingPrompt(p)}
                                  title="Edit Prompt"
                                >
                                  <PenIcon className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => setActivePersonalizedPrompt(p)}>
                                  <Phone className="w-3 h-3 mr-1" /> Call
                                </Button>
                              </div>
                            </div>
                            <p className="text-[10px] line-clamp-3 text-muted-foreground font-mono bg-background/40 p-1.5 rounded">
                              {p.personalizedSystemPrompt}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {enrichment && enrichment.capabilities.length > 0 && (
                  <Card className="p-5 border-border/50 bg-card/30 backdrop-blur-sm">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                      <Zap className="w-3 h-3" /> What this agent will do
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                      {enrichment.capabilities.map((cap, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <p className="text-base text-foreground">{cap}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowPersonaConversation((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1.5 bg-card/50 hover:bg-card transition-colors"
                  >
                    <Users className="w-3 h-3" />
                    View persona &amp; sample conversation
                    {showPersonaConversation ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                <AnimatePresence>
                  {showPersonaConversation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      {enrichment ? (
                        <div className="pt-2 grid grid-cols-1 lg:grid-cols-12 gap-6">
                          <div className="lg:col-span-3">
                            <PersonaCard title="AI Agent" avatar={enrichment.aiAvatar} persona={enrichment.robot} />
                          </div>
                          <div className="lg:col-span-6">
                            <ConversationView
                              conversation={enrichment.conversation}
                              aiAvatar={enrichment.aiAvatar}
                              humanAvatar={enrichment.humanAvatar}
                              aiName={enrichment.robot.name}
                              humanName={enrichment.human.name}
                            />
                          </div>
                          <div className="lg:col-span-3">
                            <PersonaCard title="User" avatar={enrichment.humanAvatar} persona={enrichment.human} />
                          </div>
                        </div>
                      ) : (
                        <FallbackConversationView
                          usecaseName={selectedUseCase.usecase}
                          demoConversation={selectedUseCase.demoConversation}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Card className="p-6 card-elevated">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg">Ready to try a live call?</h3>

                        {/* Highlighted Configuration Badge */}
                        <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 border border-primary/20 rounded-full">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                            Active: {config.callService === 'vapi' ? 'Vapi' : 'INTVoiceKit'} — {config.voiceProvider} ({VOICE_DATA[config.voiceProvider]?.find(v => v.id === config.voiceId)?.name || 'Default'})
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfig(true)}
                      className="flex items-center gap-2 border-primary/20 hover:bg-primary/5"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="font-bold">Voice Configuration</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div className="space-y-1">
                      <Label className="text-sm">Company Name</Label>
                      <Input placeholder="Acme Corp" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-base h-11" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Recipient Name</Label>
                      <Input placeholder="Full Name" value={userName} onChange={(e) => setUserName(e.target.value)} className="text-base h-11" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Phone Number</Label>
                      <Input placeholder="+1..." value={userNumber} onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || val === "+") setUserNumber("+");
                          else if (val.startsWith("+")) setUserNumber(val);
                          else setUserNumber("+" + val);
                      }} className="text-base h-11" />
                    </div>
                  </div>
                  <Button onClick={handleStartCall} disabled={callActive} className="w-full py-6 text-lg font-semibold transition-all">
                    <Phone className="mr-2 w-5 h-5" /> Start Live AI Call
                  </Button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {activePersonalizedPrompt && selectedUseCase && (
            <PersonalizedCallModal prompt={activePersonalizedPrompt} usecaseName={selectedUseCase.usecase} onClose={() => setActivePersonalizedPrompt(null)} onCall={handlePersonalizedCall} calling={callActive} currentConfig={config} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showAddModal && (
            <AddUseCaseModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreated={handleUseCaseCreated} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showCallLogs && (
            <CallLogs open={showCallLogs} onClose={() => setShowCallLogs(false)} baseUrl={baseUrl} authEmail={authUser.email} defaultViewMode={viewMode} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          <CallLoadingModal active={callActive} statusIndex={callStepIndex} steps={callMode === "personalized" ? FAST_CALL_STEPS : CALL_STEPS} />
        </AnimatePresence>
        <AnimatePresence>
          {editingPrompt && (
            <EditPromptModal isOpen={!!editingPrompt} onClose={() => setEditingPrompt(null)} prompt={editingPrompt} onSave={handleUpdatePersonalizedPrompt} />
          )}
        </AnimatePresence>
        <ConfigureModal open={showConfig} onClose={() => setShowConfig(false)} onSave={handleSaveConfig} currentConfig={config} />
      </section>
    </>
  );
};