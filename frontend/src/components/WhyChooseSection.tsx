import { useBrandName } from "@/hooks/useBrandName";
import {
  Zap,
  MessageSquare,
  Clock,
  BarChart3,
  Scale,
  Users,
} from "lucide-react";

const features = [
  { icon: Zap, title: "Human-Like Conversations", description: "Natural, accent-aware dialogues that replicate real human interactions" },
  { icon: MessageSquare, title: "Multilingual", description: "English, Hindi, Bengali and more" },
  { icon: Clock, title: "Dynamic Handler", description: "In-call scheduling, notifications, and bookings in real time" },
  { icon: BarChart3, title: "Scoring Mechanism", description: "Measures accuracy, responsiveness, and engagement quality" },
  { icon: Scale, title: "Decision Workflows", description: "Configured to your business logic for consistent outcomes" },
  { icon: Users, title: "Human-in-the-Loop", description: "Auto-escalates complex scenarios to human agents" },
];

export const WhyChooseSection = () => {
  const brandName = useBrandName();

  return (
    <section className="py-10 px-4 border-t border-border/40">
      <div className="container mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-6">
          Why teams choose {brandName}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2 px-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground">{feature.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};