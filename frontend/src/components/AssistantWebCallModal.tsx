import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Loader2, Sparkles, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Assistant {
  assistant_id: string;
  assistant_name: string;
  assistant_tts_model: string;
}

interface AssistantWebCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (agentId: string) => void;
  connecting: boolean;
}

export const AssistantWebCallModal = ({ isOpen, onClose, onConnect, connecting }: AssistantWebCallModalProps) => {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  // Use the local backend URL to avoid 401 Unauthorized errors from the direct API
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  useEffect(() => {
    if (isOpen) {
      const fetchAssistants = async () => {
        setLoading(true);
        try {
          // Routing through your backend which holds the Bearer token
          const res = await fetch(`${baseUrl}/api/prompts/assistants/list?page=1&limit=20`);
          const json = await res.json();
          if (json.success) {
             // Handling potential data nesting differences from your backend proxy
             const list = json.data?.assistants || json.data || [];
             setAssistants(Array.isArray(list) ? list : []);
          }
        } catch (err) {
          console.error("Failed to fetch assistants", err);
        } finally {
          setLoading(false);
        }
      };
      fetchAssistants();
    }
  }, [isOpen, baseUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 font-bold"><Globe className="w-4 h-4 text-primary" /> Web Voice Call</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Select AI Agent</label>
            <Select onValueChange={setSelectedId} disabled={loading || connecting}>
              <SelectTrigger className="h-12 border-border/60">
                <SelectValue placeholder={loading ? "Loading agents..." : "Choose an agent"} />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((a) => (
                  <SelectItem key={a.assistant_id} value={a.assistant_id}>{a.assistant_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            className="w-full h-12 text-base font-semibold" 
            disabled={!selectedId || connecting} 
            onClick={() => onConnect(selectedId)}
          >
            {connecting ? <Loader2 className="mr-2 animate-spin" /> : <Phone className="mr-2 w-4 h-4" />}
            {connecting ? "Connecting to Agent..." : "Start Web Call"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};