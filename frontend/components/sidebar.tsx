"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

interface SidebarProps {
  className?: string;
  isModelActive?: boolean;
  onModelToggle?: (state: boolean) => void;
  onLogoClick?: () => void;
}

// Star Icon for Logo
function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
    </svg>
  );
}

// Collapse Icon (Chevron Left)
function CollapseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

// Expand Icon (Chevron Right)
function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Brain Icon
function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M12 18v4" />
    </svg>
  );
}

// Voice/Microphone Icon
function VoiceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <path d="M12 19v3" />
    </svg>
  );
}

// Model/CPU Icon
function ModelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 11a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
      <path d="M9 20v-2.343a4 4 0 0 1 .172-1.08" />
      <path d="M15 20v-2.343a4 4 0 0 0-.172-1.08" />
      <path d="M6 9H3" />
      <path d="M21 9h-3" />
      <path d="M9 3v3" />
      <path d="M15 3v3" />
    </svg>
  );
}

// Theme Icon (Sun/Moon)
function ThemeIcon({ className, isSoftAnime }: { className?: string; isSoftAnime: boolean }) {
  if (isSoftAnime) {
    // Moon icon for soft anime mode
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    );
  }
  // Sun icon for light mode
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

// Settings/Gear Icon
function SettingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  isExpanded?: boolean;
}

function MenuItem({ icon, label, onClick, isActive, isExpanded = true }: MenuItemProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      title={!isExpanded ? label : undefined}
      className={cn(
        "h-11 px-4 rounded-lg text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200",
        isExpanded ? "w-full justify-start gap-3" : "w-11 justify-center",
        isActive && "bg-sidebar-accent text-sidebar-primary"
      )}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      {isExpanded && (
        <span className="text-sm font-medium truncate">{label}</span>
      )}
    </Button>
  );
}

export function Sidebar({ className, isModelActive = false, onModelToggle, onLogoClick }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const isSoftAnime = theme === "soft-anime";
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const handleModelToggle = () => {
    if (onModelToggle) {
      onModelToggle(!isModelActive);
    }
  };

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar transition-all duration-300 ease-in-out border-r border-sidebar-border",
        isExpanded ? "w-[250px]" : "w-[80px]",
        className
      )}
    >
      {/* Header Section: Logo & Toggle Button */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border gap-2">
        {/* Logo & App Name - Clickable Navigation */}
        <button
          onClick={handleLogoClick}
          title="Return to main chat interface"
          className={cn(
            "flex items-center gap-3 min-w-0 flex-1",
            "rounded-lg px-2 py-1.5 -mx-2",
            "transition-all duration-200",
            "hover:bg-sidebar-accent/50 active:bg-sidebar-accent",
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm flex-shrink-0">
            <StarIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          {isExpanded && (
            <span className="text-lg font-semibold text-sidebar-foreground truncate">
              NARAGI
            </span>
          )}
        </button>

        {/* Collapse/Expand Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          className="h-8 w-8 p-0 flex-shrink-0 hover:bg-sidebar-accent"
        >
          {isExpanded ? (
            <CollapseIcon className="w-4 h-4" />
          ) : (
            <ExpandIcon className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation Menu Group */}
      <nav className="flex-1 flex flex-col gap-1 p-3">
        <MenuItem
          icon={<BrainIcon className="w-5 h-5" />}
          label="Brain"
          isExpanded={isExpanded}
        />
        <MenuItem
          icon={<VoiceIcon className="w-5 h-5" />}
          label="Voice"
          isExpanded={isExpanded}
        />
        <MenuItem
          icon={<ModelIcon className="w-5 h-5" />}
          label="Model"
          onClick={handleModelToggle}
          isActive={isModelActive}
          isExpanded={isExpanded}
        />
      </nav>

      {/* Bottom Menu Group: Settings & Theme */}
      <div className="flex flex-col gap-1 p-3 border-t border-sidebar-border">
        <MenuItem
          icon={<ThemeIcon className="w-5 h-5" isSoftAnime={isSoftAnime} />}
          label="Theme"
          onClick={toggleTheme}
          isActive={isSoftAnime}
          isExpanded={isExpanded}
        />
        <MenuItem
          icon={<SettingIcon className="w-5 h-5" />}
          label="Setting"
          isExpanded={isExpanded}
        />
      </div>
    </aside>
  );
}
