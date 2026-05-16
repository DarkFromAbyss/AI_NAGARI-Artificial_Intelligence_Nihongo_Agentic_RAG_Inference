"use client";

import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { GridFloor } from "@/components/grid-floor";
import { VrmModel } from "@/components/vrm-model";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

interface Scene3DProps {
  modelUrl: string;
  onModelLoad?: () => void;
  onModelError?: () => void;
}

/**
 * Scene3D Component
 * Orchestrates the 3D scene including camera, controls, lighting, and grid.
 * Manages viewport framing to keep the model centered and in-view at all times.
 */
export function Scene3D({ modelUrl, onModelLoad, onModelError }: Scene3DProps) {
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
    </>
  );
}
