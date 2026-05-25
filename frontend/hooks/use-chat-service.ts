/**
 * useChatService Hook
 * 
 * Centralizes all chat API communication, state management, and error handling.
 * Provides a clean abstraction for frontend components to interact with the backend.
 * 
 * Features:
 * - Automatic session management
 * - Request/response validation with TypeScript
 * - Retry logic with exponential backoff
 * - Error boundary integration
 * - Loading state management
 * - Debouncing for repeated requests
 * 
 * Usage:
 * const { messages, sendMessage, isLoading, error } = useChatService();
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { TTSService } from "@/services/tts-service";

// ============ TYPE DEFINITIONS ============

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  voiceText?: string;
  audioBlob?: Blob;
  isGeneratingAudio?: boolean;
  timestamp?: Date;
  error?: string;
}

export interface BackendChatRequest {
  message: string;
  user_id?: string;
  session_id: string;
  language?: string;
}

export interface BackendChatResponse {
  status: string;
  display: string;
  voice: string;
  display2d: string;
  message_id: string;
  timestamp: string;
}

export interface ChatServiceError {
  code: string;
  message: string;
  isRetryable: boolean;
}

export interface UseChatServiceReturn {
  messages: ChatMessage[];
  sendMessage: (text: string, language?: string) => Promise<void>;
  isLoading: boolean;
  error: ChatServiceError | null;
  clearError: () => void;
  clearMessages: () => void;
  sessionId: string;
}

// ============ CONSTANTS ============

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const API_TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || "30000", 10);
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

// ============ ERROR HANDLING ============

function classifyError(error: unknown, statusCode?: number): ChatServiceError {
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return {
      code: "NETWORK_ERROR",
      message: "Network connection failed. Please check your internet connection.",
      isRetryable: true,
    };
  }

  if (statusCode === 503 || statusCode === 502) {
    return {
      code: "SERVICE_UNAVAILABLE",
      message: "Backend service is temporarily unavailable. Please try again later.",
      isRetryable: true,
    };
  }

  if (statusCode === 422) {
    return {
      code: "VALIDATION_ERROR",
      message: "Invalid request format. Please check your input.",
      isRetryable: false,
    };
  }

  if (statusCode === 429) {
    return {
      code: "RATE_LIMITED",
      message: "Too many requests. Please wait before sending another message.",
      isRetryable: true,
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      code: "SERVER_ERROR",
      message: "Server error occurred. Please try again later.",
      isRetryable: true,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: error instanceof Error ? error.message : "An unexpected error occurred.",
    isRetryable: false,
  };
}

// ============ RETRY LOGIC ============

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelayMs: number = INITIAL_RETRY_DELAY_MS
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const err = classifyError(error);
      if (!err.isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      if (DEBUG) {
        console.warn(
          `[useChatService] Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`,
          error
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

// ============ API CALL WRAPPER ============

async function callChatApi(
  request: BackendChatRequest
): Promise<BackendChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      (error as any).statusCode = response.status;
      throw error;
    }

    const data: BackendChatResponse = await response.json();

    // Validate response structure
    if (!data.display || !data.message_id) {
      throw new Error("Invalid response structure from backend");
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============ HOOK IMPLEMENTATION ============

export function useChatService(userId?: string): UseChatServiceReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ChatServiceError | null>(null);

  // Generate persistent session ID
  const sessionIdRef = useRef<string>("");
  
  useEffect(() => {
    if (!sessionIdRef.current) {
      const prefix = process.env.NEXT_PUBLIC_SESSION_PREFIX || "session";
      sessionIdRef.current = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }, []);

  // Initialize TTS service
  const ttsServiceRef = useRef<TTSService | null>(null);
  
  useEffect(() => {
    ttsServiceRef.current = new TTSService(
      BACKEND_URL,
      sessionIdRef.current
    );
  }, []);

  // Debounce flag to prevent rapid-fire requests
  const debounceRef = useRef(false);

  // Synthesize audio for assistant messages
  const synthesizeAudio = useCallback(
    async (voiceText: string, messageId: string) => {
      if (!process.env.NEXT_PUBLIC_ENABLE_AUDIO_SYNTHESIS) {
        return;
      }

      try {
        // Mark message as generating audio
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isGeneratingAudio: true }
              : msg
          )
        );

        const ttsService = ttsServiceRef.current;
        if (!ttsService) {
          throw new Error("TTS service not initialized");
        }

        // Synthesize voice
        const response = await ttsService.synthesize(voiceText);

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

        if (DEBUG) {
          console.log(
            `[useChatService] Audio synthesized: ${voiceText.substring(0, 30)}...`
          );
        }
      } catch (err) {
        // Log but don't block chat - graceful degradation
        console.warn("[useChatService] Audio synthesis failed:", err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isGeneratingAudio: false }
              : msg
          )
        );
      }
    },
    []
  );

  // Main send message handler
  const sendMessage = useCallback(
    async (text: string, language: string = "en") => {
      // Validation
      if (!text.trim()) {
        setError({
          code: "VALIDATION_ERROR",
          message: "Message cannot be empty.",
          isRetryable: false,
        });
        return;
      }

      if (text.trim().length > 2000) {
        setError({
          code: "VALIDATION_ERROR",
          message: "Message exceeds maximum length of 2000 characters.",
          isRetryable: false,
        });
        return;
      }

      // Debounce: prevent spam
      if (debounceRef.current) {
        return;
      }
      debounceRef.current = true;
      setTimeout(() => {
        debounceRef.current = false;
      }, 300); // Minimum 300ms between requests

      // Create user message
      const userMessageId = `user_${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      // Add user message immediately
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        // Call backend with retry logic
        const response = await retryWithBackoff(
          () =>
            callChatApi({
              message: text.trim(),
              user_id: userId,
              session_id: sessionIdRef.current,
              language,
            })
        );

        // Create assistant message
        const assistantMessageId = response.message_id || `assistant_${Date.now()}`;
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: "assistant",
          content: response.display,
          voiceText: response.voice,
          timestamp: new Date(response.timestamp),
        };

        // Add assistant message
        setMessages((prev) => [...prev, assistantMessage]);

        // Trigger audio synthesis in background
        if (response.voice) {
          synthesizeAudio(response.voice, assistantMessageId);
        }

        if (DEBUG) {
          console.log(
            `[useChatService] Message processed:`,
            response.message_id
          );
        }
      } catch (err) {
        const errorInfo = classifyError(
          err,
          (err as any)?.statusCode
        );
        setError(errorInfo);

        // Add error message to chat
        const errorMessage: ChatMessage = {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: `Sorry, I couldn't process your request. ${errorInfo.message}`,
          error: errorInfo.code,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);

        console.error("[useChatService] Error:", errorInfo);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, synthesizeAudio]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
    clearError,
    clearMessages,
    sessionId: sessionIdRef.current,
  };
}
