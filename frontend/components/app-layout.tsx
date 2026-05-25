"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TaskbarToggle } from "@/components/taskbar-toggle";
import { CharacterShowcase } from "@/components/character-showcase";
import { ChatPanel } from "@/components/chat-panel";
import { GeminiChatInterface } from "@/components/gemini-chat-interface";

/**
 * AppLayout Component
 * 
 * Root layout orchestrating the dual-state interface:
 * 
 * State A: Model ON (isModelActive === true)
 * - Split layout: 3D Character on left/center + Chat Panel on right
 * - Taskbar visible on far left with toggle button
 * - Full 3D VRM model rendering with text overlay
 * 
 * State B: Model OFF (isModelActive === false)
 * - Unified full-width chat interface (Gemini-like)
 * - Taskbar visible on far left with toggle button
 * - Greeting centered initially, transitions to bottom input on first message
 * 
 * Layout Structure:
 * - Taskbar (fixed left-0 w-16) - Always visible, contains toggle
 * - Main Content Area (margin-left for taskbar) - Changes based on state
 *   - State A: flex row with Character | Chat
 *   - State B: full-width unified interface
 * 
 * State Management:
 * - displayContent: Text content for 3D space rendering
 * - statusVoiceText: Voice text for status badge
 * - isModelActive: Toggles between layout states
 */
export function AppLayout() {
  // State for model visibility
  const [isModelActive, setIsModelActive] = useState(true);

  // State for multi-modal responses
  const [displayContent, setDisplayContent] = useState<string | null>(null);
  const [statusVoiceText, setStatusVoiceText] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* ============ LEFT VERTICAL TASKBAR (Fixed) ============ */}
      <TaskbarToggle
        isModelActive={isModelActive}
        onToggle={setIsModelActive}
      />

      {/* ============ MAIN CONTENT AREA ============ */}
      {isModelActive ? (
        /**
         * STATE A: Model ON - Split Layout
         * Left/Center: 3D Character Showcase
         * Right: Chat Panel with multi-modal response handling
         */
        <div className="flex flex-1 overflow-hidden ml-16">
          {/* Center - Character Showcase with 3D text rendering */}
          <CharacterShowcase
            displayContent={displayContent}
            statusVoiceText={statusVoiceText}
            className="flex-1"
          />

          {/* Right - Chat Panel */}
          <ChatPanel
            isModelActive={isModelActive}
            setDisplayContent={setDisplayContent}
            setStatusVoiceText={setStatusVoiceText}
            className={cn(
              "w-[420px] border-l border-border/30",
              "transition-all duration-500 ease-out"
            )}
          />
        </div>
      ) : (
        /**
         * STATE B: Model OFF - Unified Full-Width Interface
         * Entire viewport for Gemini-like chat with centered greeting
         * and dynamic transitions to bottom input on first message
         */
        <div className="flex flex-1 overflow-hidden ml-16">
          <GeminiChatInterface
            setDisplayContent={setDisplayContent}
            setStatusVoiceText={setStatusVoiceText}
            className={cn(
              "transition-all duration-500 ease-out",
              "animate-in fade-in"
            )}
          />
        </div>
      )}
    </div>
  );
}
