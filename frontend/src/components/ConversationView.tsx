import { Card } from "@/components/ui/card";
import type { ConversationMessage } from "@/data/useCases";

interface ConversationViewProps {
  conversation: ConversationMessage[];
  aiAvatar: string;
  humanAvatar: string;
  aiName: string;
  humanName: string;
}

export const ConversationView = ({
  conversation,
  aiAvatar,
  humanAvatar,
  aiName,
  humanName,
}: ConversationViewProps) => {
  return (
    <Card className="p-3 sm:p-5 card-elevated border-border">
      <h3 className="text-sm font-semibold text-primary mb-3 sm:mb-4 uppercase tracking-wider">
        Sample Conversation
      </h3>
      <div className="space-y-3 sm:space-y-4 max-h-[350px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2">
        {conversation.map((msg, i) => (
          <div
            key={i}
            // Removed flex-row-reverse logic to keep everything on the left
            className="flex gap-3 animate-fade-in" 
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <img
              src={msg.sender === "ai" ? aiAvatar : humanAvatar}
              alt={msg.sender === "ai" ? aiName : humanName}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0 border border-border"
            />
            <div
              className={`max-w-[85%] sm:max-w-[80%] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm ${
                msg.sender === "ai"
                  ? "bg-primary/10 text-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {msg.sender === "ai" ? aiName : humanName}
              </p>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};