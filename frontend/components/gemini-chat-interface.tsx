"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AnimatedGreeting } from "@/components/animated-greeting";
import { AudioPlayer } from "@/components/audio-player";
import { MarkdownMessage } from "@/components/markdown-message";
import { getResponseContent } from "@/utils/markdown-utils";
import { TTSService } from "@/services/tts-service";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  voiceText?: string;
  audioBlob?: Blob;
  isGeneratingAudio?: boolean;
}

interface BackendChatResponse {
  message_id?: string;
  display?: string;
  voice?: string;
  display2d?: string;
}

interface GeminiChatInterfaceProps {
  className?: string;
  /** Unified chat history from parent (AppLayout) */
  messages: Message[];
  /** Setter for chat history from parent (AppLayout) */
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setDisplayContent?: (content: string | null) => void;
  setStatusVoiceText?: (voiceText: string | null) => void;
}

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

function ChatMessage({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("py-3 px-1 transition-colors", isUser ? "pl-8" : "pr-6")}
    >
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wider mb-1.5 block",
          isUser ? "text-right text-primary/60" : "text-muted-foreground/70"
        )}
      >
        {isUser ? "You" : "NARAGI"}
      </span>

      <div
        className={cn(
          "text-sm leading-relaxed",
          isUser
            ? "text-right text-foreground/90"
            : "text-foreground/95"
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>

      {message.audioBlob && (
        <div
          className={cn(
            "mt-2 flex",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          <AudioPlayer audioBlob={message.audioBlob} />
        </div>
      )}
    </div>
  );
}

/**
 * GeminiChatInterface Component
 * 
 * Unified chat interface mimicking Gemini's layout and behavior.
 * Now receives messages from parent (AppLayout) as props for unified state management.
 * 
 * Two States:
 * - Initial (No messages): Centered chat input with animated greeting
 * - Active (Messages exist): Input moves to bottom, messages fill center space
 * 
 * Features:
 * - Smooth transitions between states
 * - Bilingual greeting with fade animations
 * - Dynamic message scrolling
 * - FIXED: Full chat history preserved across toggle with parent state
 */
export function GeminiChatInterface({
  className,
  messages,
  setMessages,
  setDisplayContent,
  setStatusVoiceText,
}: GeminiChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Generate persistent session ID for conversation tracking
  const sessionIdRef = useRef<string>("");
  const ttsServiceRef = useRef<TTSService | null>(null);
  
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Initialize TTS service once
    if (!ttsServiceRef.current) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      ttsServiceRef.current = new TTSService(backendUrl, sessionIdRef.current);
    }
  }, []);

  // Flag to determine if we're in "initial" state (no messages)
  const isInitialState = messages.length === 0;

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current && !isInitialState) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isInitialState]);

  /**
   * Handle sending a message
   * Calls the backend API and updates the chat history
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Call backend API via Next.js proxy
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          user_id: "user_web_ui",
          session_id: sessionIdRef.current,
          language: "en",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }

      const data: BackendChatResponse = await response.json();

      // Process multi-modal response
      setDisplayContent?.(data.display2d ?? null);
      setStatusVoiceText?.(data.voice ?? null);

      // When model is OFF (GeminiChatInterface context), use getResponseContent
      // to select between display and display2d fields
      const displayText = getResponseContent(
        data.display,
        data.display2d,
        false  // isModelActive = false for GeminiChatInterface
      );

      // Create assistant message
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: displayText,
        voiceText: data.voice,
      };

      // Try to synthesize voice if voice text is available
      if (data.voice) {
        try {
          assistantMessage.isGeneratingAudio = true;
          setMessages((prev) => [...prev, assistantMessage]);

          const ttsService = ttsServiceRef.current;
          if (ttsService) {
            const response = await ttsService.synthesize(data.voice);
            if (response.audio) {
              assistantMessage.audioBlob = response.audio;
              assistantMessage.isGeneratingAudio = false;

              // Update messages to show audio is ready
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id ? assistantMessage : m
                )
              );
            }
          }
        } catch (error) {
          console.warn("Failed to synthesize voice:", error);
          assistantMessage.isGeneratingAudio = false;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? assistantMessage : m
            )
          );
        }
      } else {
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "Sorry, I encountered an error. Please try again.",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <main
      className={cn(
        "flex-1 flex flex-col h-full overflow-hidden bg-background",
        className
      )}
    >
      {/* 
        INITIAL STATE: Centered greeting + input
        Transition: Opacity fade, scale
      */}
      {isInitialState && (
        <div
          className={cn(
            "flex-1 flex flex-col items-center justify-center px-4 py-8",
            "transition-all duration-500 ease-out",
            "animate-in fade-in slide-in-from-bottom-4"
          )}
        >
          {/* Bilingual Greeting with fade animation */}
          <div
            className={cn(
              "mb-12 transition-all duration-700 ease-out",
              "animate-in fade-in slide-in-from-bottom-8"
            )}
            style={{ animationDelay: "100ms" }}
          >
            <AnimatedGreeting />
          </div>

          {/* Centered Input Form - Initial State */}
          <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: "200ms" }}
          >
            <div className="relative">
              {/* Input wrapper with subtle border */}
              <div
                className={cn(
                  "relative flex items-center gap-2",
                  "px-4 py-3 rounded-full",
                  "bg-muted/40 border border-border/50",
                  "transition-all duration-300",
                  "focus-within:bg-background focus-within:border-primary/50",
                  "focus-within:shadow-lg focus-within:shadow-primary/10"
                )}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about Japanese..."
                  disabled={isLoading}
                  className={cn(
                    "flex-1 bg-transparent outline-none text-sm",
                    "placeholder:text-muted-foreground/50",
                    "disabled:opacity-50"
                  )}
                  autoFocus
                />

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "transition-all duration-200",
                    inputValue.trim() && !isLoading
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                      : "bg-muted text-muted-foreground"
                  )}
                  aria-label="Send message"
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        ACTIVE STATE: Message history + bottom input
        Transition: Slide from bottom, messages fade in
      */}
      {!isInitialState && (
        <>
          {/* Messages Container - Scrollable */}
          <div
            ref={scrollContainerRef}
            className={cn(
              "flex-1 overflow-y-auto px-4 py-6",
              "transition-all duration-500 ease-out",
              "animate-in fade-in"
            )}
          >
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className="animate-in fade-in slide-in-from-bottom-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ChatMessage message={message} />
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 py-4 px-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Form - Bottom Fixed Position */}
          <div
            className={cn(
              "sticky bottom-0 border-t border-border/50",
              "bg-gradient-to-t from-background via-background to-transparent",
              "px-4 py-4",
              "transition-all duration-500 ease-out",
              "animate-in slide-in-from-bottom-0"
            )}
          >
            <div className="max-w-2xl mx-auto">
              <div
                className={cn(
                  "relative flex items-center gap-2",
                  "px-4 py-3 rounded-full",
                  "bg-muted/30 border border-border/50",
                  "transition-all duration-300",
                  "focus-within:bg-background focus-within:border-primary/50",
                  "focus-within:shadow-lg focus-within:shadow-primary/10"
                )}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Continue the conversation..."
                  disabled={isLoading}
                  className={cn(
                    "flex-1 bg-transparent outline-none text-sm",
                    "placeholder:text-muted-foreground/50",
                    "disabled:opacity-50"
                  )}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "transition-all duration-200",
                    inputValue.trim() && !isLoading
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                      : "bg-muted text-muted-foreground"
                  )}
                  aria-label="Send message"
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
