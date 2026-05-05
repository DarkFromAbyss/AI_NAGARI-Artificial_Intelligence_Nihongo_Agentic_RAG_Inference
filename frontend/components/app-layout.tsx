"use client";

import { Sidebar } from "@/components/sidebar";
import { CharacterShowcase } from "@/components/character-showcase";
import { ChatPanel } from "@/components/chat-panel";

export function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar - Navigation */}
      <Sidebar />

      {/* Center - Character Showcase */}
      <CharacterShowcase />

      {/* Right - Chat Panel */}
      <ChatPanel />
    </div>
  );
}
