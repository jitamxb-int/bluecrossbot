import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MessageSquare,
  X,
  Send,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBrandName } from "@/hooks/useBrandName";

const VoiceChatbot = () => {
  const brandName = useBrandName();
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatMode, setChatMode] = useState<"voice" | "text">("text");
  const [messages, setMessages] = useState<
    Array<{ id: string; text: string; sender: "user" | "bot"; timestamp: Date }>
  >([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [volume, setVolume] = useState<number[]>([75]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleListening = () => {
    setIsListening((prev) => !prev);
    if (!isConnected) setIsConnected(true);
  };

  const toggleMute = () => setIsMuted((prev) => !prev);
  const toggleExpanded = () => setIsExpanded((s) => !s);

  const sendTextMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: currentMessage,
      sender: "user" as const,
      timestamp: new Date(),
    };
    setMessages((p) => [...p, userMessage]);
    const messageToSend = currentMessage;
    setCurrentMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToSend }),
      });
      const data = await res.json();
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: data.assistant || "Sorry, I couldn't generate a response.",
        sender: "bot" as const,
        timestamp: new Date(),
      };
      setMessages((p) => [...p, botMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((p) => [
        ...p,
        {
          id: (Date.now() + 1).toString(),
          text: "⚠️ Error connecting to server. Please try again.",
          sender: "bot" as const,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {isExpanded && (
        <Card className="mb-4 w-[calc(100vw-2rem)] sm:w-80 h-[60vh] bg-card border-border shadow-lg flex flex-col animate-fade-in">
          {/* Header */}
          <div className="p-4 border-b border-border bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">
                  {brandName} Assistant
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpanded}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Mode toggle + volume */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={chatMode === "voice" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChatMode("voice")}
                  className="h-7 px-2 text-xs"
                >
                  <Mic className="h-3 w-3 mr-1" />
                  Voice
                </Button>
                <Button
                  variant={chatMode === "text" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChatMode("text")}
                  className="h-7 px-2 text-xs"
                >
                  <Keyboard className="h-3 w-3 mr-1" />
                  Text
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-1 ml-4">
                <Volume2 className="h-3 w-3 text-muted-foreground" />
                <Slider
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col min-h-0">
            {chatMode === "text" ? (
              <div className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 && !isLoading ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        Start a conversation by typing a message below
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 ${
                              message.sender === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            <p className="text-sm">{message.text}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {message.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-muted text-foreground px-4 py-2 rounded-lg flex items-center gap-2">
                            <div className="flex gap-1">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                  style={{ animationDelay: `${i * 0.2}s` }}
                                />
                              ))}
                            </div>
                            <span className="text-sm opacity-70">Typing...</span>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Input
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message..."
                      className="flex-1"
                    />
                    <Button
                      onClick={sendTextMessage}
                      disabled={!currentMessage.trim() || isLoading}
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-4 overflow-y-auto">
                {!isListening ? (
                  <div className="bg-muted p-3 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      👋 Hi! I'm your AI voice assistant. Click the mic to talk.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="flex gap-2 mb-3">
                      {[...Array(4)].map((_, i) => (
                        <div
                          key={i}
                          className="w-2 h-10 bg-primary rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-medium text-primary">
                      Listening...
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer for voice mode */}
          {chatMode === "voice" && (
            <div className="p-4 border-t border-border bg-primary/5">
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant={isListening ? "destructive" : "default"}
                  size="icon"
                  onClick={toggleListening}
                  className={`h-12 w-12 rounded-full ${
                    isListening ? "animate-pulse" : ""
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Floating Button */}
      <div className="relative">
        <Button
          variant="default"
          size="icon"
          onClick={isExpanded ? toggleListening : toggleExpanded}
          className={`h-14 w-14 rounded-full shadow-lg ${
            isListening ? "animate-pulse" : "hover:scale-110"
          } transition-all duration-300`}
        >
          {isExpanded && isListening ? (
            <MicOff className="h-6 w-6" />
          ) : isExpanded ? (
            <Mic className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </Button>

        {isConnected && !isExpanded && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full animate-pulse border-2 border-background" />
        )}
      </div>
    </div>
  );
};

export default VoiceChatbot;
