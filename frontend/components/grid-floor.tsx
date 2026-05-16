"use client";

import * as THREE from "three";
import { useEffect, useMemo } from "react";

interface GridFloorProps {
  size?: number;
  divisions?: number;
  opacity?: number;
}

/**
 * GridFloor Component
 * Renders a perspective grid floor plane to establish spatial depth and ground reference.
 * Uses Three.js GridHelper for consistent alignment with the 3D scene.
 */
export function GridFloor({ size = 10, divisions = 20, opacity = 0.4 }: GridFloorProps) {
  const gridHelper = useMemo(() => {
    const helper = new THREE.GridHelper(size, divisions, 0x888888, 0xcccccc);
    helper.position.y = 0;
    return helper;
  }, [size, divisions]);

  useEffect(() => {
    // Fade grid slightly based on distance for visual depth
    gridHelper.traverse((child) => {
      if (child instanceof THREE.LineSegments) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.transparent = true;
            m.opacity = opacity;
          });
        } else {
          child.material.transparent = true;
          child.material.opacity = opacity;
        }
      }
    });
  }, [gridHelper, opacity]);

  return <primitive object={gridHelper} />;
}
