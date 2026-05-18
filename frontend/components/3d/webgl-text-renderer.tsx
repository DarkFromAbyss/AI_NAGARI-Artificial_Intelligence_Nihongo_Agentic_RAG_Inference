"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";

interface WebGLTextRendererProps {
  /** Plain text or minimal HTML content to display in 3D space */
  content: string | null;
  /** Position in 3D space [x, y, z] */
  position?: [number, number, number];
  /** Rotation in radians [x, y, z] */
  rotation?: [number, number, number];
  /** Scale factor or [x, y, z] scale */
  scale?: number | [number, number, number];
  /** CSS class for additional styling */
  className?: string;
}

/**
 * WebGLTextRenderer - Renders display text within 3D WebGL space
 * 
 * Renders sanitized HTML content as a 3D overlay positioned alongside
 * the VRM model. Content is displayed with glassmorphism styling and
 * supports multi-line text with scroll capability.
 * 
 * Process Flow:
 * 1. Accept display2d content as string (HTML or plain text)
 * 2. Sanitize HTML to prevent XSS attacks
 * 3. Render as Html overlay in 3D space using @react-three/drei
 * 4. Apply glassmorphism styling for visual consistency
 * 5. Position relative to camera for optimal visibility
 */
function sanitizeContentForDisplay(content: string): string {
  if (!content) return "";

  try {
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "span"],
      ALLOWED_ATTR: ["class", "style"],
      FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
      FORBID_ATTR: ["onerror", "onclick", "onmouseover", "onfocus", "onload"],
    });
  } catch {
    return "";
  }
}

export function WebGLTextRenderer({
  content,
  position = [1.5, 1, -1],
  rotation = [0, -0.25, 0],
  scale = 0.9,
  className,
}: WebGLTextRendererProps) {
  const sanitized_content = useMemo(() => {
    const trimmed = (content ?? "").trim();
    return trimmed ? sanitizeContentForDisplay(trimmed) : "";
  }, [content]);

  if (!sanitized_content) return null;

  return (
    <Html
      position={position}
      rotation={rotation}
      scale={scale}
      center
      transform
      occlude={false}
    >
      <div
        className={cn(
          "max-w-[520px] min-w-[280px] max-h-[420px] overflow-y-auto rounded-3xl border border-white/15",
          "bg-white/10 p-4 text-sm text-slate-900 shadow-[0_32px_120px_-60px_rgba(15,23,42,0.75)]",
          "backdrop-blur-xl backdrop-saturate-150",
          className
        )}
        style={{
          background: "rgba(255, 255, 255, 0.12)",
          boxShadow: "0 28px 90px rgba(15, 23, 42, 0.18)",
          borderColor: "rgba(255, 255, 255, 0.14)",
          borderWidth: 1,
          borderStyle: "solid",
        }}
        dangerouslySetInnerHTML={{ __html: sanitized_content }}
        aria-live="polite"
        aria-label="3D display content"
      />
    </Html>
  );
}

export default WebGLTextRenderer;
