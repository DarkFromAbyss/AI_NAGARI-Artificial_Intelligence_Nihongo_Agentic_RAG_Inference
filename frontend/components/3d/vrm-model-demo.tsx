"use client";

import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { VrmModel, VrmModelRef } from "@/components/vrm-model";
import { VRMA_ANIMATIONS } from "@/utils/vrm-animation-manager";
import * as THREE from "three";

/**
 * VrmModelDemo Component
 *
 * Complete working example demonstrating:
 * 1. Loading a VRM model
 * 2. Playing initial animation (VRMA_02 Greeting)
 * 3. Switching between different VRMA animations
 * 4. Error handling and loading states
 * 5. Real-time animation control via UI buttons
 *
 * Usage:
 * ```tsx
 * import { VrmModelDemo } from "@/components/3d/vrm-model-demo";
 *
 * export default function Page() {
 *   return <VrmModelDemo />;
 * }
 * ```
 */
export function VrmModelDemo() {
  const vrmRef = useRef<VrmModelRef>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [animationLoading, setAnimationLoading] = useState(false);
  const [currentAnimation, setCurrentAnimation] = useState<string>("VRMA_02.vrma");

  /**
   * Handle model load success.
   * Called when VRM model is successfully loaded and rigged.
   */
  const handleModelLoaded = (vrm: any) => {
    setIsLoading(false);
    console.log("[VrmModelDemo] VRM model loaded successfully");
  };

  /**
   * Handle model load errors.
   * Typically caused by:
   * - Missing model file
   * - Corrupt VRM data
   * - Network failures
   */
  const handleModelError = (error: Error) => {
    setIsLoading(false);
    setModelError(error.message);
    console.error("[VrmModelDemo] Model load error:", error);
  };

  /**
   * Switch animation by calling the VrmModel's exposed method.
   * Handles loading states and error feedback.
   */
  const switchAnimation = async (animationFile: string) => {
    if (!vrmRef.current) {
      console.warn("VRM model not ready");
      return;
    }

    try {
      setAnimationLoading(true);
      const success = await vrmRef.current.switchAnimation(animationFile, 0.5);

      if (success) {
        setCurrentAnimation(animationFile);
        console.log(`[VrmModelDemo] Switched to animation: ${animationFile}`);
      } else {
        console.error(`[VrmModelDemo] Failed to switch animation: ${animationFile}`);
      }
    } catch (error) {
      console.error("[VrmModelDemo] Animation switch error:", error);
    } finally {
      setAnimationLoading(false);
    }
  };

  /**
   * Render 3D scene with VRM model and interactive controls.
   */
  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* 3D Canvas */}
      <Canvas
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Lighting setup for realistic character rendering */}
        <PerspectiveCamera makeDefault position={[0, 1.2, 2]} fov={45} />
        <ambientLight intensity={0.6} color={0xffffff} />
        <directionalLight
          position={[3, 3, 3]}
          intensity={0.8}
          color={0xffffff}
          castShadow
        />
        <pointLight position={[-3, 2, 2]} intensity={0.4} />

        {/* Grid and environment */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color={0x2a2a3e} />
        </mesh>

        {/* VRM Model with animation system */}
        <group ref={vrmRef as any}>
          <VrmModel
            url="/models/character.vrm" // Path to your VRM model
            initialAnimation="VRMA_02.vrma" // Default animation on load
            onLoad={handleModelLoaded}
            onError={handleModelError}
            onAnimationSwitched={(animName) => {
              console.log(`Animation switched to: ${animName}`);
            }}
          />
        </group>

        {/* Camera controls */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          autoRotate
          autoRotateSpeed={2}
        />
      </Canvas>

      {/* UI Overlay: Controls and Status */}
      <div className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none">
        {/* Top Status Bar */}
        <div className="absolute top-4 left-4 right-4 pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-4 max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"
                }`}
              />
              <span className="text-sm text-slate-300">
                {isLoading ? "Loading..." : modelError ? "Error" : "Ready"}
              </span>
            </div>

            {modelError && (
              <div className="text-xs text-red-400 mb-2">
                <strong>Error:</strong> {modelError}
              </div>
            )}

            <div className="text-xs text-slate-400">
              <div>Current Animation: <span className="text-slate-200 font-mono">{currentAnimation}</span></div>
              <div>Status: {animationLoading ? "Switching..." : "Ready"}</div>
            </div>
          </div>
        </div>

        {/* Animation Control Panel */}
        <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
          <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Animations
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(VRMA_ANIMATIONS).map(([key, anim]) => (
                <button
                  key={anim.file}
                  onClick={() => switchAnimation(anim.file)}
                  disabled={animationLoading || isLoading || !!modelError}
                  className={`text-xs py-2 px-3 rounded font-medium transition-all ${
                    currentAnimation === anim.file
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  } ${
                    animationLoading || isLoading || modelError
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  <div className="truncate">{key}</div>
                  <div className="text-[10px] text-slate-400 truncate">{anim.name}</div>
                </button>
              ))}
            </div>

            {/* Info */}
            <div className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700">
              Click buttons to switch animations. Smooth cross-fade blending is applied
              automatically. Initial animation (VRMA_02 Greeting) loads on mount.
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute top-4 right-4 pointer-events-auto max-w-xs">
          <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg p-4 text-xs text-slate-300">
            <h4 className="font-semibold text-slate-200 mb-2">Controls</h4>
            <ul className="space-y-1 text-slate-400">
              <li>🖱️ <strong>Drag:</strong> Rotate camera</li>
              <li>🔄 <strong>Auto:</strong> Camera rotates automatically</li>
              <li>✋ <strong>Buttons:</strong> Switch animations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
