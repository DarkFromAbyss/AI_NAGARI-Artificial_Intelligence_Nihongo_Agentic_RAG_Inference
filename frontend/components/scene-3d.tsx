"use client";

import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { GridFloor } from "@/components/grid-floor";
import { VrmModel } from "@/components/vrm-model";
import { WebGLTextRenderer } from "@/components/3d/webgl-text-renderer";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface Scene3DProps {
  modelUrl: string;
  onModelLoad?: () => void;
  onModelError?: () => void;
  /** Display text content to render in 3D space */
  displayContent?: string | null;
}

/**
 * Scene3D Component
 * 
 * Orchestrates the 3D scene including camera, controls, lighting, grid, and text rendering.
 * Manages viewport framing to keep the model centered and in-view at all times.
 * Renders WebGL text content alongside the VRM model using Html overlay.
 * 
 * Process Flow:
 * 1. Initialize camera with optimal framing for full-body model visibility
 * 2. Setup OrbitControls for user interaction (pan/zoom/rotate)
 * 3. Configure scene lighting with anime-friendly soft setup
 * 4. Render grid floor for spatial reference
 * 5. Load and render VRM avatar model
 * 6. Conditionally render WebGLTextRenderer if displayContent provided
 */
export function Scene3D({
  modelUrl,
  onModelLoad,
  onModelError,
  displayContent = null,
}: Scene3DProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Auto-focus on target when user interacts, maintaining center framing
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = false;
    }
  });

  return (
    <>
      {/* Camera: wider FOV for full-body visibility, positioned for optimal framing */}
      <PerspectiveCamera
        makeDefault
        position={[0, 1.2, 3]}
        fov={40}
        near={0.1}
        far={100}
      />

      {/* Orbit Controls: unrestricted rotation for free movement, but maintains distance */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        minDistance={2}
        maxDistance={6}
        autoRotate={false}
        target={[0, 0.8, 0]}
      />

      {/* Scene Lighting: anime-friendly soft lighting setup */}
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight
        position={[3, 4, 5]}
        intensity={0.9}
        color="#fff5f0"
        castShadow={false}
      />
      <directionalLight
        position={[-3, 2, 3]}
        intensity={0.5}
        color="#f0f5ff"
      />
      <directionalLight
        position={[0, 3, -4]}
        intensity={0.4}
        color="#e8e0ff"
      />
      <directionalLight
        position={[0, -2, 3]}
        intensity={0.2}
        color="#ffffff"
      />

      {/* Grid Floor: establishes ground plane and spatial reference */}
      <GridFloor size={12} divisions={24} opacity={0.35} />

      {/* VRM Avatar Model: centered on scene with free movement capability */}
      <VrmModel
        url={modelUrl}
        onLoad={onModelLoad}
        onError={onModelError}
      />

      {/* WebGL Text Renderer: Display content in 3D space alongside avatar */}
      {displayContent && displayContent.trim() !== "" && (
        <WebGLTextRenderer content={displayContent} />
      )}
    </>
  );
}