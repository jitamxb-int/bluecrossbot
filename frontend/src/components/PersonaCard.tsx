import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import type { Persona } from "@/data/useCases";

interface PersonaCardProps {
  title: string;
  avatar: string;
  persona: Persona;
}

const MetaRow = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground leading-snug">{value}</p>
    </div>
  );
};

export const PersonaCard = ({ title, avatar, persona }: PersonaCardProps) => {
  const isAI = persona.age === "AI";

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100 }}
    >
      <Card className="p-4 sm:p-5 text-center card-elevated border-border animate-fade-in">
        <h3 className="text-sm font-semibold text-primary mb-3 uppercase tracking-wider">
          {title}
        </h3>
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden border-3 border-primary/30 ring-2 ring-primary/10 ring-offset-2 ring-offset-card">
          <img
            src={avatar}
            alt={`${persona.name} avatar`}
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="mt-3 space-y-1">
          <h4 className="font-semibold text-foreground text-sm">{persona.name}</h4>
          {!isAI && (
            <p className="text-xs text-muted-foreground">
              {persona.age}{persona.gender ? `/${persona.gender}` : ""}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-3 text-left">
          {isAI ? (
            <>
              <MetaRow label="Role" value={persona.expertise} />
              <MetaRow label="Tone" value={persona.tone} />
              <MetaRow label="Primary Objective" value={persona.objective} />
              <MetaRow label="Escalation Logic" value={persona.escalation} />
            </>
          ) : (
            <>
              <div>
                <p className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Expertise</p>
                <p className="text-xs font-medium text-foreground">{persona.expertise}</p>
              </div>
              <div>
                <p className="font-semibold text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Key Traits</p>
                <ul className="space-y-1 pl-3">
                  {persona.skills.map((skill, i) => (
                    <li key={i} className="text-xs text-foreground list-disc">{skill}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};