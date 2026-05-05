"use client";

import { cn } from "@/lib/utils";

interface ModelLoaderProps {
  className?: string;
}

export function ModelLoader({ className }: ModelLoaderProps) {
  return (
    <div className={cn(
      "absolute inset-0 flex flex-col items-center justify-center gap-6 z-10",
      className
    )}>
      {/* Stylized loading silhouette with glow */}
      <div className="relative">
        {/* Outer glow ring */}
        <div 
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.2) 0%, transparent 70%)",
            transform: "scale(2)",
          }}
        />
        
        {/* Loading circle with rotating border */}
        <div className="relative w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
          {/* Rotating ring */}
          <svg 
            className="absolute inset-0 w-full h-full animate-spin" 
            style={{ animationDuration: "3s" }}
            viewBox="0 0 128 128"
          >
            <circle
              cx="64"
              cy="64"
              r="60"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="120 280"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Inner silhouette icon */}
          <svg 
            className="w-16 h-16 text-muted-foreground/50"
            viewBox="0 0 64 64" 
            fill="currentColor"
          >
            {/* Simplified anime character silhouette */}
            <circle cx="32" cy="20" r="14" />
            <path d="M12 58 Q12 42 32 42 Q52 42 52 58 L52 64 L12 64 Z" />
          </svg>
        </div>
      </div>
      
      {/* Loading text */}
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-foreground">Loading Avatar</p>
        <p className="text-xs text-muted-foreground">Preparing 3D model...</p>
      </div>
      
      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
