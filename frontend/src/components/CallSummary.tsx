import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface CallSummaryProps {
  summary: string;
  visible: boolean;
}

export const CallSummary = ({ summary, visible }: CallSummaryProps) => {
  if (!visible) return null;

  return (
    <Card className="p-5 card-elevated border-border animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">
          Call Summary
        </h3>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{summary}</p>
    </Card>
  );
};
