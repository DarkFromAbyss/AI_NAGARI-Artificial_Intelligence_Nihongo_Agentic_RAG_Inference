"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatedGreeting } from "@/components/animated-greeting";
import { AudioPlayer } from "@/components/audio-player";
import { TTSService } from "@/services/tts-service";
import { Volume2 } from "lucide-react";

interface ChatPanelProps {
  className?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  voiceText?: string;
  audioBlob?: Blob;
  isGeneratingAudio?: boolean;
}

// User profile icon
function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

// Paper plane send icon
function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

// Individual message component with seamless styling and TTS support
function ChatMessage({
  message,
  onSynthesizeAudio,
}: {
  message: Message;
  onSynthesizeAudio?: (voiceText: string, messageId: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("py-3 px-1 transition-colors", isUser ? "pl-8" : "pr-6")}
    >
      {/* Role indicator - subtle typography */}
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wider mb-1.5 block",
          isUser ? "text-right text-primary/60" : "text-muted-foreground/70"
        )}
      >
        {isUser ? "You" : "NARAGI"}
      </span>

      {/* Message content - printed on surface feel */}
      <div
        className={cn(
          "text-sm leading-relaxed",
          isUser
            ? "text-right text-foreground/90"
            : "text-foreground/95 bg-primary/[0.03] rounded-lg py-2.5 px-3 -mx-1"
        )}
      >
        {message.content}
      </div>

      {/* Audio Player - displayed for assistant messages with voice text */}
      {!isUser && message.voiceText && (
        <div className="mt-3 flex flex-col gap-2">
          {!message.audioBlob && !message.isGeneratingAudio ? (
            <button
              onClick={() =>
                onSynthesizeAudio?.(message.voiceText!, message.id)
              }
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                "text-xs font-medium transition-colors duration-200"
              )}
              aria-label="Synthesize audio"
            >
              <Volume2 size={14} />
              Click to hear pronunciation
            </button>
          ) : message.isGeneratingAudio ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <div className="animate-spin">⏳</div>
              Synthesizing audio...
            </div>
          ) : (
            <AudioPlayer audioBlob={message.audioBlob} size="sm" />
          )}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ className }: ChatPanelProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showGreeting, setShowGreeting] = useState(true);
  const ttsServiceRef = useRef<TTSService | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}`);

  // Initialize TTS service on mount
  useEffect(() => {
    const ttsService = new TTSService("http://127.0.0.1:8000", sessionId);
    ttsServiceRef.current = ttsService;
  }, [sessionId]);

  // Synthesize audio from voice text
  const handleSynthesizeAudio = async (voiceText: string, messageId: string) => {
    try {
      // Update message to show loading state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isGeneratingAudio: true } : msg
        )
      );

      const ttsService = ttsServiceRef.current;
      if (!ttsService) {
        throw new Error("TTS service not initialized");
      }

      // Synthesize audio
      const response = await ttsService.synthesize(voiceText, 1);

      // Update message with audio blob
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                audioBlob: response.audio,
                isGeneratingAudio: false,
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Error synthesizing audio:", error);

      // Update message to show error state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, isGeneratingAudio: false } : msg
        )
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setShowGreeting(false);
    setMessage("");

    try {
      // Call API to backend
      const response = await fetch("http://127.0.0.1:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          user_id: "user_123",
          session_id: sessionId,
          language: "en",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Create AI response with both display and voice text
      const aiResponse: Message = {
        id: data.message_id || (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "No response",
        voiceText: data.voice_text || undefined,
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error connecting to Backend API:", error);

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I couldn't connect to the server. Please check if the backend is running.",
      };
      setMessages((prev) => [...prev, errorResponse]);
    }
  };

  return (
    <aside
      className={cn(
        // Responsive width using clamp - wider but constrained
        "flex flex-col h-full border-l border-border/50 bg-card",
        "w-[clamp(380px,28vw,480px)]",
        className
      )}
      style={{
        // Fallback for older browsers
        minWidth: "380px",
        maxWidth: "480px",
      }}
    >
      {/* Header - Minimal top section */}
      <header className="flex items-center justify-between px-5 py-4">
        {/* Left - NARAGI with Online status */}
        <div className="flex flex-col">
          <h2 className="font-semibold text-foreground text-base tracking-tight">NARAGI</h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] text-muted-foreground">Online</span>
          </div>
        </div>
        
        {/* Right - User profile circle */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <UserIcon className="h-3.5 w-3.5 text-primary" />
        </div>
      </header>

      {/* Unified Chat Surface - No visual separation */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scrollable Messages Area - Seamless with input */}
        <div className="flex-1 overflow-y-auto px-5">
          {showGreeting && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <AnimatedGreeting />
            </div>
          ) : (
            <div className="py-4 space-y-1">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onSynthesizeAudio={handleSynthesizeAudio}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Area - Seamlessly integrated, no border separation */}
        <div className="px-5 py-4 bg-gradient-to-t from-card via-card to-transparent">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message NARAGI..."
              className={cn(
                "w-full px-4 py-3 pr-12 rounded-2xl",
                "bg-background/80 backdrop-blur-sm",
                "border border-border/30",
                "text-foreground placeholder:text-muted-foreground/60",
                "focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/30",
                "transition-all duration-200 text-sm"
              )}
              aria-label="Message input"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl",
                "bg-primary/10 text-primary",
                "hover:bg-primary hover:text-primary-foreground",
                "transition-all duration-200",
                "disabled:opacity-30 disabled:hover:bg-primary/10 disabled:hover:text-primary"
              )}
              aria-label="Send message"
              disabled={!message.trim()}
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
