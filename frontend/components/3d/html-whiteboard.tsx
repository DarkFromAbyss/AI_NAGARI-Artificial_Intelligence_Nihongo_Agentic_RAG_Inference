"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";

export interface HtmlWhiteboardProps {
  html: string | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  className?: string;
}

const sanitizeHtml = (html: string): string => {
  if (!html) return "";

  try {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
      FORBID_ATTR: ["style", "onerror", "onclick", "onmouseover", "onfocus", "onload"],
    });
  } catch {
    return "";
  }
};

export function HtmlWhiteboard({
  html,
  position = [1.5, 1, -1],
  rotation = [0, -0.25, 0],
  scale = 0.9,
  className,
}: HtmlWhiteboardProps) {
  const safeHtml = useMemo(() => {
    const content = (html ?? "").trim();
    return content ? sanitizeHtml(content) : "";
  }, [html]);

  if (!safeHtml) return null;

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
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        aria-live="polite"
      />
    </Html>
  );
}

export default HtmlWhiteboard;
