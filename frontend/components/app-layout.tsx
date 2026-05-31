"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { CharacterShowcase } from "@/components/character-showcase";
import { ChatPanel } from "@/components/chat-panel";
import { GeminiChatInterface } from "@/components/gemini-chat-interface";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { stopAllActiveAudio } from "@/hooks/use-audio-manager";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  voiceText?: string;
  audioBlob?: Blob;
  isGeneratingAudio?: boolean;
}

/**
 * AppLayout Component
 * 
 * Root layout orchestrating the dual-state interface with UNIFIED chat history
 * and responsive sidebar navigation.
 * 
 * State A: Model ON (isModelActive === true)
 * - Split layout: 3D Character on left/center + Chat Panel on right
 * - Responsive Sidebar visible on far left with Brain, Voice, Model navigation
 * - Full 3D VRM model rendering with text overlay
 * - Chat history shared from parent state
 * 
 * State B: Model OFF (isModelActive === false)
 * - Unified full-width chat interface (Gemini-like)
 * - Responsive Sidebar visible on far left with navigation items
 * - Greeting centered initially, transitions to bottom input on first message
 * - Chat history shared from parent state
 * 
 * Sidebar Features:
 * - Expandable/collapsible with smooth animations (250px ↔ 80px)
 * - Logo + App name (NARAGI) in header
 * - Brain button (placeholder)
 * - Voice button (placeholder)
 * - Model button (toggles 3D view)
 * - Theme toggle and Settings buttons
 * - Tooltips on collapsed state
 * 
 * CRITICAL FIX: Chat history is now LIFTED to this component and shared across
 * both views. When the user toggles between 3D (ChatPanel) and 2D (GeminiChatInterface),
 * the same messages array is passed to both. This ensures:
 * - No state loss on toggle
 * - Seamless conversation continuity
 * - Single source of truth for chat history
 * 
 * Layout Structure:
 * - Sidebar (flex, responsive width) - Always visible with navigation
 * - Main Content Area (flex-1) - Changes based on state
 *   - State A: flex row with Character | Chat
 *   - State B: full-width unified interface
 * 
 * State Management:
 * - messages: Unified chat history (SHARED across both views)
 * - setMessages: Setter for chat history
 * - displayContent: Text content for 3D space rendering
 * - displayIntent: Intent tag for conditional rendering (FIX #2)
 * - statusVoiceText: Voice text for status badge
 * - isModelActive: Toggles between layout states (DEFAULT: false = 2D ON)
 */
export function AppLayout() {
  // CRITICAL FIX: Lift messages state to parent so it persists across toggles
  // This is the single source of truth for chat history
  const [messages, setMessages] = useState<Message[]>([]);

  // State for model visibility (DEFAULT: false = 2D Chat Interface ON)
  // FIX: Changed from true to false so 2D chat is shown on initial load
  const [isModelActive, setIsModelActive] = useState(false);

  // State for multi-modal responses
  const [displayContent, setDisplayContent] = useState<string | null>(null);
  const [displayIntent, setDisplayIntent] = useState<string | undefined>(undefined);  // FIX #2: Track intent for conditional rendering
  const [statusVoiceText, setStatusVoiceText] = useState<string | null>(null);

  const handleLogoClick = () => {
    // Stop all audio from previous state before switching to main chat
    stopAllActiveAudio();
    setIsModelActive(false);
  };

  const handleModelToggle = (newState: boolean) => {
    // Stop all audio from previous state before switching interface
    stopAllActiveAudio();
    setIsModelActive(newState);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ============ LEFT RESPONSIVE SIDEBAR ============ */}
      <Sidebar
        isModelActive={isModelActive}
        onModelToggle={handleModelToggle}
        onLogoClick={handleLogoClick}
      />

      {/* ============ MAIN CONTENT AREA ============ */}
      {isModelActive ? (
        /**
         * STATE A: Model ON - Split Layout
         * Left/Center: 3D Character Showcase
         * Right: Chat Panel with multi-modal response handling
         * 
         * FIX: Now passing shared messages and setMessages from parent
         * FIX: Added min-w-0 to ensure flex items don't overflow when sidebar expands
         */
        <div className="flex flex-1 overflow-hidden min-w-0">
          {/* Center - Character Showcase with 3D text rendering */}
          {/* min-w-0 ensures it shrinks below its content size when sidebar expands */}
          <CharacterShowcase
            displayContent={displayContent}
            displayIntent={displayIntent}
            statusVoiceText={statusVoiceText}
            isModelActive={isModelActive}
            className="flex-1 min-w-0"
          />

          {/* Right - Chat Panel */}
          <ChatPanel
            messages={messages}
            setMessages={setMessages}
            isModelActive={isModelActive}
            setDisplayContent={setDisplayContent}
            setDisplayIntent={setDisplayIntent}
            setStatusVoiceText={setStatusVoiceText}
            className={cn(
              "border-l border-border/30",
              "transition-all duration-500 ease-out"
            )}
          />
        </div>
      ) : (
        /**
         * STATE B: Model OFF - Unified Full-Width Interface
         * Entire viewport for Gemini-like chat with centered greeting
         * and dynamic transitions to bottom input on first message
         * 
         * FIX: Now passing shared messages and setMessages from parent
         * FIX: Added min-w-0 to ensure flex items don't overflow when sidebar expands
         */
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* User Profile Dropdown Header - Only visible when model is OFF */}
          <div className="flex items-center justify-end px-4 py-3 border-b border-border/30">
            <UserProfileDropdown
              isModelActive={isModelActive}
              isAuthenticated={false}
              userName="Guest"
              userAvatar={null}
            />
          </div>

          {/* Main Chat Interface */}
          {/* min-w-0 ensures GeminiChatInterface can shrink when sidebar expands */}
          <div className="flex flex-1 overflow-hidden min-w-0">
            <GeminiChatInterface
              messages={messages}
              setMessages={setMessages}
              setDisplayContent={setDisplayContent}
              setStatusVoiceText={setStatusVoiceText}
              className={cn(
                "transition-all duration-500 ease-out",
                "animate-in fade-in"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
