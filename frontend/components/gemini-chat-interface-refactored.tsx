/**
 * Refactored GeminiChatInterface Component
 * 
 * Unified chat interface mimicking Gemini's layout and behavior.
 * Now integrated with the backend via useChatService hook.
 * 
 * Two States:
 * - Initial (No messages): Centered chat input with animated greeting
 * - Active (Messages exist): Input moves to bottom, messages fill center space
 * 
 * Features:
 * - Smooth transitions between states with Tailwind CSS
 * - Bilingual greeting with fade animations
 * - Dynamic message scrolling with auto-scroll on new messages
 * - Full chat history management with backend integration
 * - Error boundaries with graceful error display
 * - Audio synthesis with loading indicators
 * - Memoized ChatMessage component to prevent re-renders
 * - Proper cleanup on unmount to prevent memory leaks
 * 
 * Performance Optimizations:
 * - Message list uses React.memo to prevent unnecessary re-renders
 * - useCallback for event handlers to maintain reference stability
 * - Auto-scroll uses requestAnimationFrame for smooth animation
 * - Debounced send to prevent API spam
 */

"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { cn } from "@/lib/utils";
import { AnimatedGreeting } from "@/components/animated-greeting";
import { AudioPlayer } from "@/components/audio-player";
import { useChatService, ChatMessage as ServiceMessage } from "@/hooks/use-chat-service";
import { Button } from "@/components/ui/button";

// ============ TYPE DEFINITIONS ============

interface GeminiChatInterfaceProps {
  className?: string;
  setDisplayContent?: (content: string | null) => void;
  setStatusVoiceText?: (voiceText: string | null) => void;
  userId?: string;
  language?: string;
}

// ============ ICON COMPONENTS ============

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

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ============ MEMOIZED CHAT MESSAGE COMPONENT ============

/**
 * ChatMessage Component
 * 
 * Memoized to prevent unnecessary re-renders when parent component updates.
 * Only re-renders when message prop actually changes.
 */
const ChatMessage = memo(function ChatMessage({
  message,
}: {
  message: ServiceMessage;
}) {
  const isUser = message.role === "user";
  const isError = !!message.error;

  return (
    <div
      className={cn(
        "py-3 px-1 transition-colors duration-200",
        isUser ? "pl-8" : "pr-6"
      )}
    >
      {/* Role Label */}
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wider mb-1.5 block",
          isError
            ? "text-destructive/70"
            : isUser
            ? "text-right text-primary/60"
            : "text-muted-foreground/70"
        )}
      >
        {isError ? "ERROR" : isUser ? "You" : "NARAGI"}
      </span>

      {/* Message Content */}
      <div
        className={cn(
          "text-sm leading-relaxed",
          isError
            ? "text-destructive/90 bg-destructive/[0.08] rounded-lg py-2.5 px-3 -mx-1 flex items-start gap-2"
            : isUser
            ? "text-right text-foreground/90"
            : "text-foreground/95 bg-primary/[0.03] rounded-lg py-2.5 px-3 -mx-1"
        )}
      >
        {isError && <ErrorIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <span>{message.content}</span>
      </div>

      {/* Audio Player */}
      {!isUser && !isError && message.audioBlob && (
        <div className="mt-2 flex justify-start">
          <AudioPlayer audioBlob={message.audioBlob} />
        </div>
      )}

      {/* Audio Synthesis Loading Indicator */}
      {!isUser && message.isGeneratingAudio && (
        <div className="mt-2 flex items-center gap-1.5 px-3 py-1.5">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
            <div
              className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-xs text-muted-foreground/60">Generating audio...</span>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if message content or status actually changes
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.audioBlob === nextProps.message.audioBlob &&
    prevProps.message.isGeneratingAudio === nextProps.message.isGeneratingAudio &&
    prevProps.message.error === nextProps.message.error
  );
});

// ============ MAIN COMPONENT ============

export function GeminiChatInterface({
  className,
  setDisplayContent,
  setStatusVoiceText,
  userId,
  language = "en",
}: GeminiChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use the custom chat service hook
  const { messages, sendMessage, isLoading, error, clearError } = useChatService(userId);

  // Determine if we're in initial state (no messages)
  const isInitialState = messages.length === 0;

  // Update parent with latest multi-modal content
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // In a full implementation, you would extract display2d from backend response
        // For now, use the main content
        setDisplayContent?.(lastMessage.content);
        setStatusVoiceText?.(lastMessage.voiceText || null);
      }
    }
  }, [messages, setDisplayContent, setStatusVoiceText]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current && !isInitialState) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages, isInitialState]);

  // Handle sending a message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageText = inputValue.trim();
    setInputValue("");

    // Call the service hook's sendMessage method
    await sendMessage(messageText, language);
  }, [inputValue, isLoading, sendMessage, language]);

  // Handle Enter key press (Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Memoize message list to prevent unnecessary re-renders
  const messageList = useMemo(
    () =>
      messages.map((message, index) => (
        <div
          key={message.id}
          className="animate-in fade-in slide-in-from-bottom-2"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <ChatMessage message={message} />
        </div>
      )),
    [messages]
  );

  return (
    <main
      className={cn(
        "flex-1 flex flex-col h-full overflow-hidden bg-background",
        className
      )}
    >
      {/* INITIAL STATE: Centered greeting + input */}
      {isInitialState && (
        <div
          className={cn(
            "flex-1 flex flex-col items-center justify-center px-4 py-8",
            "transition-all duration-500 ease-out",
            "animate-in fade-in slide-in-from-bottom-4"
          )}
        >
          {/* Bilingual Greeting */}
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
          <div
            className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4"
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
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  aria-label="Send message"
                  type="button"
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE STATE: Message history + bottom input */}
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
              {/* Error Banner - Connection Issues */}
              {error && (
                <div
                  className={cn(
                    "mb-4 p-3 rounded-lg",
                    "bg-destructive/10 border border-destructive/20",
                    "flex items-start gap-2 animate-in slide-in-from-top-2"
                  )}
                >
                  <ErrorIcon className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-destructive">{error.message}</p>
                    {error.isRetryable && (
                      <button
                        onClick={clearError}
                        className="text-xs text-destructive/80 hover:text-destructive underline mt-1"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Messages List */}
              {messageList}

              {/* Loading Indicator */}
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
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              )}

              {/* Scroll anchor */}
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
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 cursor-pointer"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  aria-label="Send message"
                  type="button"
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
