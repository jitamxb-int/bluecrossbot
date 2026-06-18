// useCases.ts
import aiAvatarVyom from "@/assets/ai-avatar-hr.png"; // Ensure these paths exist or use generic placeholders
import humanAvatarUser from "@/assets/human-avatar-hr.png";

export interface Persona {
  name: string;
  age: string;
  gender?: string;
  expertise: string;
  skills: string[];
  tone?: string;
  objective?: string;
  escalation?: string;
}

export interface ConversationMessage {
  sender: "ai" | "human";
  text: string;
}

export interface UseCase {
  id: string;
  name: string;
  overview: string;
  brief: string;
  capabilities: string[];
  aiAvatar: string;
  humanAvatar: string;
  robot: Persona;
  human: Persona;
  suggestedQuestions: string[];
  conversation: ConversationMessage[];
}

export const useCases: UseCase[] = [
  {
    id: "spanish-tutor",
    name: "Spanish Tutor AI Agent",
    overview: "Real-time conversational Spanish tutor for level assessment and practice.",
    brief: "Real-time conversational Spanish tutor for level assessment and practice. Vyom helps users improve their Spanish through natural conversation, providing instant corrections and grammatical tips while keeping the dialogue engaging.",
    capabilities: [
      "Assesses user proficiency level (Basic to Advanced)",
      "Provides real-time grammatical corrections",
      "Engages in topic-based conversation (Movies, Hobbies, etc.)",
      "Suggests better sentence structures (Natural phrasing)",
      "Adapts vocabulary based on user responses"
    ],
    aiAvatar: aiAvatarVyom,
    humanAvatar: humanAvatarUser,
    robot: {
      name: "Vyom",
      age: "AI",
      expertise: "Spanish Language & Pedagogy",
      skills: ["Grammar Correction", "Natural Dialogue", "Assessment"],
      tone: "Encouraging & Educational",
      objective: "Improve user's conversational Spanish through active practice and feedback.",
      escalation: "Complex linguistic theories or technical app issues."
    },
    human: {
      name: "User",
      age: "Adult",
      expertise: "Prospect / Candidate",
      skills: ["Intermediate Spanish learner"]
    },
    suggestedQuestions: [
      "Can we talk about movies?",
      "How do I say 'I am lost' in Spanish?",
      "Can you correct my grammar?",
      "What is my Spanish level?"
    ],
    conversation: [
      { sender: "ai", text: "Hola, soy Vyom, tu tutor de español. ¿Cuál dirías que es tu nivel de español: básico, intermedio o avanzado? ¿Qué te gustaría practicar o aprender hoy?" },
      { sender: "human", text: "Creo que mi nivel es intermedio. Quiero mejorar mi conversación." },
      { sender: "ai", text: "¡Excelente! (You should say: «Creo que mi nivel es intermedio.») ¿Qué temas te interesan más?" },
      { sender: "human", text: "Me gusta hablar de películas." },
      { sender: "ai", text: "¡Genial! (You should say: 'Me gusta hablar sobre películas.') ¿Cuál es tu película favorita y por qué?" },
      { sender: "human", text: "Mi película favorita es Inception porque es muy interesante." },
      { sender: "ai", text: "Muy bien. ¿Cómo describirías la trama de «Inception» en unas pocas frases?" },
      { sender: "human", text: "Es una película con muchos sueños y tiene un final confuso." },
      { sender: "ai", text: "Correcto. (You should say: 'Es una película con muchos sueños y un final confuso.') ¿Te gusta cuando los finales son abiertos?" },
      { sender: "human", text: "Sí, creo que son más emocionantes." },
      { sender: "ai", text: "Perfecto. Hablando de emociones, ¿cómo te sentiste al ver esa película por primera vez?" },
      { sender: "human", text: "Fue un poco confuso pero muy emocionante y intenso." },
      { sender: "ai", text: "Eso es común. (You should say: 'Estuvo un poco confusa, pero muy emocionante e intensa.') ¿Hay otra película similar?" },
      { sender: "human", text: "Me interesa ver más películas de Christopher Nolan." },
      { sender: "ai", text: "Buena elección, sus películas suelen ser intrigantes. ¿Has visto alguna otra?" }
    ]
  }
];