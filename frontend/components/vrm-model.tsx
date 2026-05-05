"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import * as THREE from "three";

interface VrmModelProps {
  url: string;
  onError?: () => void;
  onLoad?: () => void;
}

export function VrmModel({ url, onError, onLoad }: VrmModelProps) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [error, setError] = useState(false);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const loaderRef = useRef<GLTFLoader | null>(null);

  useEffect(() => {
    // Create loader with VRM plugin
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loaderRef.current = loader;

    // Load the VRM file
    loader.load(
      url,
      (gltf) => {
        if (gltf.userData.vrm) {
          const vrmData = gltf.userData.vrm as VRM;
          setVrm(vrmData);

          // Rotate the model to face the camera (VRM models face +Z by default)
          vrmData.scene.rotation.y = Math.PI;

          // Create animation mixer for potential animations
          mixerRef.current = new THREE.AnimationMixer(vrmData.scene);
          
          onLoad?.();
        }
      },
      undefined,
      (err) => {
        console.log("[v0] VRM load error:", err);
        setError(true);
        onError?.();
      }
    );

    return () => {
      if (vrm) {
        vrm.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material?.dispose();
            }
          }
        });
      }
    };
  }, [url, onError, onLoad]);

  // Idle animation - subtle breathing/movement
  useFrame((state, delta) => {
    if (vrm) {
      // Update VRM
      vrm.update(delta);

      // Subtle idle sway animation
      const time = state.clock.getElapsedTime();
      
      // Gentle breathing motion
      vrm.scene.position.y = Math.sin(time * 1.5) * 0.01 - 0.8;
      
      // Very subtle head sway for liveliness
      if (vrm.humanoid) {
        const head = vrm.humanoid.getNormalizedBoneNode("head");
        if (head) {
          head.rotation.y = Math.sin(time * 0.5) * 0.02;
          head.rotation.z = Math.sin(time * 0.3) * 0.01;
        }
      }
    }

    // Update animation mixer if present
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  if (error || !vrm) return null;

  return (
    <primitive 
      object={vrm.scene} 
      scale={0.9}
      position={[0, -0.8, 0]}
    />
  );
}
