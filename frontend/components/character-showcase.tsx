"use client";

import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { Scene3D } from "@/components/scene-3d";
import { ModelLoader } from "@/components/model-loader";

interface CharacterShowcaseProps {
  className?: string;
  /** Display text content to render in 3D WebGL space */
  displayContent?: string | null;
  /** Voice text from AI response to display in status indicator */
  statusVoiceText?: string | null;
  /** Intent tag from the message for conditional rendering */
  displayIntent?: string;
  /** Whether the 3D model is active/visible */
  isModelActive?: boolean;
}

/**
 * CharacterShowcase Component
 * 
 * Primary display area for the 3D VRM character model with synchronized
 * WebGL text rendering. Manages canvas initialization, model loading states,
 * and error handling. Receives display content from chat responses and passes
 * it to the 3D scene for rendering alongside the avatar.
 * 
 * Process Flow:
 * 1. Initialize canvas with Three.js/React Three Fiber
 * 2. Monitor model loading state (loading → loaded → error)
 * 3. Render placeholder if model fails to load
 * 4. Pass displayContent to Scene3D for WebGL text rendering
 * 5. Display status badge indicating active/ready state
 * 
 * Props:
 * - displayContent: Text to render in 3D space (from chat response display2d)
 */
function PlaceholderCharacter() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <div className="relative">
        <div
          className="absolute inset-0 blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
            transform: "scale(1.5)",
          }}
        />

        <svg
          width="180"
          height="320"
          viewBox="0 0 180 320"
          className="relative z-10"
        >
          <ellipse
            cx="90"
            cy="45"
            rx="35"
            ry="40"
            fill="url(#silhouetteGradient)"
          />
          <path
            d="M55 45 Q45 20 70 15 Q90 10 110 15 Q135 20 125 45"
            fill="url(#silhouetteGradient)"
          />
          <rect
            x="80"
            y="80"
            width="20"
            height="20"
            rx="5"
            fill="url(#silhouetteGradient)"
          />
          <path
            d="M50 100 Q40 100 35 130 L30 200 Q30 210 45 210 L135 210 Q150 210 150 200 L145 130 Q140 100 130 100 Z"
            fill="url(#silhouetteGradient)"
          />
          <path
            d="M35 200 Q30 210 25 280 Q25 290 50 290 L130 290 Q155 290 155 280 L150 210 Q145 205 135 210 L45 210 Q35 205 35 200 Z"
            fill="url(#silhouetteGradient)"
          />

          <defs>
            <linearGradient
              id="silhouetteGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.15)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0.08)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <p className="mt-6 text-sm text-muted-foreground/60 text-center">
        Place your VRM file at
        <br />
        <code className="text-xs bg-muted/50 px-2 py-0.5 rounded">
          /public/AvatarSample_A.vrm
        </code>
      </p>
    </div>
  );
}

export function CharacterShowcase({
  className,
  displayContent = null,
  statusVoiceText = null,
  displayIntent,
  isModelActive = true,
}: CharacterShowcaseProps) {
  const [modelStatus, setModelStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  const handleError = useCallback(() => {
    setModelStatus("error");
  }, []);

  const handleLoad = useCallback(() => {
    setModelStatus("loaded");
  }, []);

  /**
   * Determine status badge text based on:
   * 1. Voice text from AI response (priority)
   * 2. Model loading state fallback
   * 3. Default text if no voice text provided
   */
  const getStatusBadgeText = (): string => {
    // Display voice text if available (updated dynamically on each response)
    if (statusVoiceText) {
      return statusVoiceText;
    }
    
    // Fallback to model status-based text
    if (modelStatus === "loaded") {
      return "NARAGI • 3D Model Active";
    }
    return "NARAGI • Stage Ready";
  };

  return (
    <main
      className={cn(
        "flex-1 flex items-center justify-center p-6 bg-[#FCFCFC]",
        className
      )}
    >
      {/* Canvas Container - fills available space with soft background */}
      <div
        className="relative w-full h-full bg-white rounded-2xl shadow-lg overflow-hidden"
        style={{
          boxShadow:
            "0 8px 60px -15px rgba(124, 58, 237, 0.15), 0 4px 25px -5px rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Radial gradient backdrop for depth */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.06) 0%, transparent 70%)",
          }}
        />

        {/* 3D Scene or Placeholder */}
        <div className="relative h-full w-full">
          {modelStatus === "error" ? (
            <PlaceholderCharacter />
          ) : (
            <>
              {modelStatus === "loading" && <ModelLoader />}
              <Canvas
                className="w-full h-full"
                gl={{
                  antialias: true,
                  alpha: true,
                  preserveDrawingBuffer: true,
                }}
                style={{ background: "transparent" }}
              >
                <Scene3D
                  modelUrl="/AvatarSample_A.vrm"
                  onModelLoad={handleLoad}
                  onModelError={handleError}
                  displayContent={displayContent}
                  displayIntent={displayIntent}
                  isModelActive={isModelActive}
                />
              </Canvas>
            </>
          )}
        </div>

        {/* Status Badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 z-10 pointer-events-none">
          <span className="text-xs font-medium text-muted-foreground">
            {getStatusBadgeText()}
          </span>
        </div>
      </div>
    </main>
  );
}