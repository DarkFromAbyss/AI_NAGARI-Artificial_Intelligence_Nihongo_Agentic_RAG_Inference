"use client";

import { Sidebar } from "@/components/sidebar";
import { CharacterShowcase } from "@/components/character-showcase";
import { ChatPanel } from "@/components/chat-panel";
import { useState } from "react";

export function AppLayout() {
  const [activeHtml, setActiveHtml] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Sidebar - Navigation */}
      <Sidebar />

      {/* Center - Character Showcase */}
      <CharacterShowcase htmlContent={activeHtml} />

      {/* Right - Chat Panel */}
      <ChatPanel setActiveHtml={setActiveHtml} />
    </div>
  );
}
