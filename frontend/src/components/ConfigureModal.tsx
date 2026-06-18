import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Settings, X, Globe, Mic2, Cpu, CreditCard } from "lucide-react";

interface ConfigureModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  currentConfig: any;
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

const TRUNKS = {
  exotel: { id: "exotel_ff2a62f4", label: "Exotel (India)" },
  twilio: { id: "ST_XVeiYzF3244P", label: "Twilio (US)" },
};

const PROVIDER_PAYLOAD_MAP: Record<string, Record<string, string>> = {
  livekit: {
    "11labs": "elevenlabs",
  },
};

const PillGroup = ({ options, value, onChange }: any) => (
  <div className="bg-muted/50 border p-1 rounded-xl flex gap-1 flex-wrap">
    {options.map((opt: any) => (
      <button
        key={opt.id}
        onClick={() => onChange(opt.id)}
        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
          value === opt.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {opt.label || opt.name}
      </button>
    ))}
  </div>
);

export const ConfigureModal = ({ open, onClose, onSave, currentConfig }: ConfigureModalProps) => {
  const [callService, setCallService] = useState(currentConfig.callService || "livekit");
  const [voiceProvider, setVoiceProvider] = useState(currentConfig.voiceProvider || "cartesia");
  const [voiceId, setVoiceId] = useState(currentConfig.voiceId || "95d51f79-c397-46f9-b49a-23763d3eaa2d");
  const [selectedTrunk, setSelectedTrunk] = useState(currentConfig.trunkType || "exotel");

  const isVapi = callService === "vapi";

  const handleServiceChange = (val: string) => {
    setCallService(val);
    const firstProvider = PROVIDERS[val][0].id;
    setVoiceProvider(firstProvider);
    setVoiceId(VOICE_DATA[firstProvider][0].id);
  };

  const handleProviderChange = (val: string) => {
    setVoiceProvider(val);
    setVoiceId(VOICE_DATA[val][0].id);
  };

  const handleSave = () => {
    const payloadProvider =
      PROVIDER_PAYLOAD_MAP[callService]?.[voiceProvider] ?? voiceProvider;

    onSave({
      callService,
      voiceProvider,
      payloadProvider,
      voiceId,
      trunkType: selectedTrunk,
      trunkId: TRUNKS[selectedTrunk as keyof typeof TRUNKS].id,
    });
    onClose();
  };

  if (!open) return null;

  const getCosting = () => {
    if (callService === "vapi") {
      return "VAPI: $0.30/min (Est: for 10,000 min)";
    } else {
      return "INTVOICEKIT: Rs.8/min (Est: for 10,000 min)";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg bg-card border-border shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Agent Configuration</h2>
              <p className="text-xs text-muted-foreground">Adjust voice and connection settings</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Service Section */}
          <div className="space-y-4">
            <Label className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-2">
              <Globe className="w-3 h-3" /> 1. Call Infrastructure
            </Label>
            <PillGroup
              options={[
                { id: "vapi", label: "Vapi (US No.)" },
                { id: "livekit", label: "INT Voice Kit (INDIAN No.)" },
              ]}
              value={callService}
              onChange={handleServiceChange}
            />
          </div>

          {/* Trunk Section */}
          {!isVapi && (
            <div className="space-y-4">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-2">
                <Cpu className="w-3 h-3" /> 2. Outbound Gateway (SIP)
              </Label>
              <PillGroup 
                options={Object.entries(TRUNKS).map(([key, val]) => ({ id: key, label: val.label }))} 
                value={selectedTrunk} 
                onChange={setSelectedTrunk} 
              />
            </div>
          )}

          {/* Voice Section */}
          <div className="space-y-4">
            <Label className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-2">
              <Mic2 className="w-3 h-3" /> {isVapi ? "2." : "3."} Voice Selection
            </Label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Provider</span>
                <PillGroup
                  options={PROVIDERS[callService]}
                  value={voiceProvider}
                  onChange={handleProviderChange}
                />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Voice Name</span>
                <PillGroup
                  options={VOICE_DATA[voiceProvider].map(v => ({ id: v.id, label: v.name }))}
                  value={voiceId}
                  onChange={setVoiceId}
                />
              </div>
            </div>
          </div>
        </div>
{/* Estimated Cost - Small and bottom right */}
          <div className="flex justify-end items-center gap-1.5 opacity-70">
            <CreditCard className="w-3 h-3 text-foreground" />
            <span className="text-[12px] text-foreground text-black/100">
              {getCosting()}
            </span>
          </div>
        {/* Footer */}
        <div className="p-6 bg-card space-y-2">
          <Button onClick={handleSave} className="w-full h-12 text-sm font-bold shadow-lg shadow-primary/20">
            Apply Configuration
          </Button>
          
          
        </div>
      </Card>
    </div>
  );
};