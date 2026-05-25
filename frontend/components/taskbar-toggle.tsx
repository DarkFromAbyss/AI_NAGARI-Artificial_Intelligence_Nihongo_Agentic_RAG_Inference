"use client";

import { cn } from "@/lib/utils";
import { Zap, ZapOff } from "lucide-react";

interface TaskbarToggleProps {
  isModelActive: boolean;
  onToggle: (state: boolean) => void;
  className?: string;
}

/**
 * TaskbarToggle Component
 * 
 * Fixed left vertical taskbar containing the primary toggle control
 * for switching between Model ON and Model OFF states.
 * 
 * Features:
 * - Clean, modern design with Lucide icons
 * - Visual feedback with color transitions
 * - Accessibility support with aria-labels
 * - Smooth hover animations
 * 
 * Position: fixed left-0 top-0 h-full w-16
 */
export function TaskbarToggle({
  isModelActive,
  onToggle,
  className,
}: TaskbarToggleProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-16 border-r border-border/50",
        "bg-gradient-to-b from-background to-background/95",
        "flex flex-col items-center justify-center gap-8 p-4",
        "shadow-sm",
        className
      )}
    >
      {/* Main Toggle Button */}
      <button
        onClick={() => onToggle(!isModelActive)}
        aria-label={
          isModelActive
            ? "Disable 3D model and switch to chat view"
            : "Enable 3D model and switch to split view"
        }
        aria-pressed={isModelActive}
        className={cn(
          "relative w-12 h-12 rounded-lg",
          "flex items-center justify-center",
          "transition-all duration-300 ease-out",
          "border border-transparent",
          isModelActive
            ? "bg-primary/15 text-primary border-primary/30 shadow-lg shadow-primary/20 hover:bg-primary/25"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "active:scale-95"
        )}
      >
        {/* Icon with smooth transition */}
        <div className="relative w-6 h-6 overflow-hidden">
          <div
            className={cn(
              "absolute inset-0 transition-all duration-300 ease-out",
              isModelActive ? "opacity-100 scale-100" : "opacity-0 scale-75"
            )}
          >
            <Zap className="w-full h-full" strokeWidth={2.5} />
          </div>
          <div
            className={cn(
              "absolute inset-0 transition-all duration-300 ease-out",
              !isModelActive ? "opacity-100 scale-100" : "opacity-0 scale-75"
            )}
          >
            <ZapOff className="w-full h-full" strokeWidth={2.5} />
          </div>
        </div>

        {/* Active state indicator ring */}
        {isModelActive && (
          <div className="absolute inset-0 rounded-lg border border-primary/30 animate-pulse" />
        )}
      </button>

      {/* Status indicator text */}
      <div className="absolute bottom-6 left-0 right-0 px-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-center">
          <span
            className={cn(
              "transition-colors duration-300",
              isModelActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            {isModelActive ? "Model" : "Chat"}
          </span>
        </div>
      </div>
    </aside>
  );
}
