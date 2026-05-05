"use client";

import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { cn } from "@/lib/utils";
import { VrmModel } from "@/components/vrm-model";
import { ModelLoader } from "@/components/model-loader";

interface CharacterShowcaseProps {
  className?: string;
}

function SceneLighting() {
  return (
    <>
      {/* Soft ambient light for base visibility */}
      <ambientLight intensity={0.6} color="#ffffff" />
      
      {/* Main key light - soft directional from front-right */}
      <directionalLight
        position={[3, 4, 5]}
        intensity={0.8}
        color="#fff5f0"
        castShadow={false}
      />
      
      {/* Fill light from left side - softer */}
      <directionalLight
        position={[-3, 2, 3]}
        intensity={0.4}
        color="#f0f5ff"
      />
      
      {/* Rim/back light for anime-style edge highlight */}
      <directionalLight
        position={[0, 3, -4]}
        intensity={0.3}
        color="#e8e0ff"
      />
      
      {/* Soft bottom fill to reduce harsh shadows under chin */}
      <directionalLight
        position={[0, -2, 3]}
        intensity={0.15}
        color="#ffffff"
      />
    </>
  );
}

// Placeholder character silhouette when no VRM is loaded
function PlaceholderCharacter() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* Stylized anime character silhouette */}
      <div className="relative">
        {/* Soft glow behind silhouette */}
        <div 
          className="absolute inset-0 blur-3xl opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
            transform: "scale(1.5)"
          }}
        />
        
        {/* Character silhouette SVG */}
        <svg 
          width="180" 
          height="320" 
          viewBox="0 0 180 320" 
          className="relative z-10"
        >
          {/* Head */}
          <ellipse 
            cx="90" 
            cy="45" 
            rx="35" 
            ry="40" 
            fill="url(#silhouetteGradient)"
          />
          {/* Hair accent */}
          <path 
            d="M55 45 Q45 20 70 15 Q90 10 110 15 Q135 20 125 45" 
            fill="url(#silhouetteGradient)"
          />
          {/* Neck */}
          <rect 
            x="80" 
            y="80" 
            width="20" 
            height="20" 
            rx="5"
            fill="url(#silhouetteGradient)"
          />
          {/* Body/Torso */}
          <path 
            d="M50 100 Q40 100 35 130 L30 200 Q30 210 45 210 L135 210 Q150 210 150 200 L145 130 Q140 100 130 100 Z" 
            fill="url(#silhouetteGradient)"
          />
          {/* Skirt/Lower body */}
          <path 
            d="M35 200 Q30 210 25 280 Q25 290 50 290 L130 290 Q155 290 155 280 L150 210 Q145 205 135 210 L45 210 Q35 205 35 200 Z" 
            fill="url(#silhouetteGradient)"
          />
          
          <defs>
            <linearGradient id="silhouetteGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.15)" />
              <stop offset="100%" stopColor="rgba(99, 102, 241, 0.08)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Label */}
      <p className="mt-6 text-sm text-muted-foreground/60 text-center">
        Place your VRM file at<br />
        <code className="text-xs bg-muted/50 px-2 py-0.5 rounded">/public/AvatarSample_A.vrm</code>
      </p>
    </div>
  );
}

export function CharacterShowcase({ className }: CharacterShowcaseProps) {
  const [modelStatus, setModelStatus] = useState<"loading" | "loaded" | "error">("loading");

  const handleError = useCallback(() => {
    setModelStatus("error");
  }, []);

  const handleLoad = useCallback(() => {
    setModelStatus("loaded");
  }, []);

  return (
    <main
      className={cn(
        "flex-1 flex items-center justify-center p-8 bg-[#FCFCFC]",
        className
      )}
    >
      {/* Main Canvas Container - Heavy border-radius, white bg, soft shadow */}
      <div 
        className="relative w-full max-w-xl h-[70vh] rounded-[32px] bg-white shadow-[0_8px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden"
        style={{
          boxShadow: "0 8px 60px -15px rgba(124, 58, 237, 0.15), 0 4px 25px -5px rgba(0, 0, 0, 0.05)"
        }}
      >
        {/* Radial Pale-Purple Gradient Glow - "STAGE" effect */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.03) 40%, transparent 70%)"
          }}
        />

        {/* 3D Canvas or Placeholder */}
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
                  preserveDrawingBuffer: true
                }}
                style={{ background: "transparent" }}
              >
                {/* Camera setup - framing for medium/full body shot */}
                <PerspectiveCamera
                  makeDefault
                  position={[0, 0.3, 2.2]}
                  fov={35}
                  near={0.1}
                  far={100}
                />
                
                {/* Orbit controls with restricted rotation */}
                <OrbitControls
                  enablePan={false}
                  enableZoom={true}
                  minDistance={1.5}
                  maxDistance={4}
                  minPolarAngle={Math.PI / 4}
                  maxPolarAngle={Math.PI / 1.8}
                  minAzimuthAngle={-Math.PI / 4}
                  maxAzimuthAngle={Math.PI / 4}
                  target={[0, 0.2, 0]}
                />
                
                {/* Anime-friendly soft lighting */}
                <SceneLighting />
                
                {/* VRM Avatar Model */}
                <VrmModel 
                  url="/AvatarSample_A.vrm" 
                  onError={handleError}
                  onLoad={handleLoad}
                />
              </Canvas>
            </>
          )}
        </div>

        {/* Corner Frame Decorations - overlaid on canvas */}
        <div className="absolute top-8 left-8 pointer-events-none z-10">
          <svg width="32" height="32" viewBox="0 0 32 32" className="text-border">
            <path d="M2 16 L2 2 L16 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute top-8 right-8 pointer-events-none z-10">
          <svg width="32" height="32" viewBox="0 0 32 32" className="text-border">
            <path d="M30 16 L30 2 L16 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute bottom-8 left-8 pointer-events-none z-10">
          <svg width="32" height="32" viewBox="0 0 32 32" className="text-border">
            <path d="M2 16 L2 30 L16 30" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute bottom-8 right-8 pointer-events-none z-10">
          <svg width="32" height="32" viewBox="0 0 32 32" className="text-border">
            <path d="M30 16 L30 30 L16 30" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Bottom status badge */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 z-10 pointer-events-none">
          <span className="text-xs font-medium text-muted-foreground">
            {modelStatus === "loaded" ? "NARAGI • 3D Model Active" : "NARAGI • Stage Ready"}
          </span>
        </div>
      </div>
    </main>
  );
}
