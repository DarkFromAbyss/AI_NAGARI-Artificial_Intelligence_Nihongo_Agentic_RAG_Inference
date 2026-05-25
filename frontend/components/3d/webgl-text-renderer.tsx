"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface WebGLTextRendererProps {
  /** Markdown or plain text content to display in 3D space */
  content: string | null;
  /** Position in 3D space [x, y, z] - LOCKED to behind model by default */
  position?: [number, number, number];
  /** Rotation in radians [x, y, z] */
  rotation?: [number, number, number];
  /** Scale factor or [x, y, z] scale */
  scale?: number | [number, number, number];
  /** CSS class for additional styling */
  className?: string;
}

/**
 * WebGLTextRenderer - Renders Markdown content within 3D WebGL space
 *
 * Renders markdown content with full syntax support (headings, tables, lists,
 * blockquotes, code blocks, and text formatting) as a 3D overlay positioned
 * directly BEHIND the VRM model at a fixed, grounded location.
 *
 * CRITICAL FIX: Positioning & Centering
 * ======================================
 * 1. **Absolute Position**: Locked at [0, 1.5, -2.5]
 *    - x=0: Centered horizontally (directly aligned with model center)
 *    - y=1.5: Positioned at chest height of VRM model (grounded, not floating)
 *    - z=-2.5: Placed directly BEHIND the model (negative Z = away from camera)
 *
 * 2. **Pivot Point Fix**: Uses <Html center={true} transform={true} />
 *    - center=true: Centers the box's pivot at the assigned coordinate
 *    - transform=true: Applies rotation/scale transformations relative to pivot
 *    - Eliminates visual drift/shifting caused by misaligned anchor points
 *
 * 3. **Text Alignment**: Internal div has text-center to center all content
 *    - Content is centered within the box boundaries
 *    - Text doesn't shift left/right based on word length
 *    - Heading/paragraph alignment is symmetric
 *
 * 4. **Grounding**: Fixed y=1.5 ensures the box stays level on world plane
 *    - Not tilted or floating unevenly
 *    - Consistent vertical position relative to model
 *
 * Process Flow:
 * 1. Accept markdown content as string
 * 2. Parse markdown using react-markdown with custom component renderers
 * 3. Sanitize output via react-markdown's built-in XSS protection
 * 4. Render as Html overlay in 3D space using @react-three/drei
 * 5. Apply glassmorphism styling for visual consistency
 * 6. Position LOCKED directly behind VRM model at [0, 1.5, -2.5]
 * 7. Center the box's pivot point to eliminate shift/drift
 *
 * WebGL Bridge Strategy:
 * - Uses @react-three/drei's <Html> component for DOM-to-3D projection
 * - center={true} ensures the element's center aligns with the assigned position
 * - Automatic scaling/positioning synchronization with WebGL camera
 * - Proper z-indexing and depth culling maintained by drei
 * - All markdown elements rendered as standard DOM within the Html context
 */

// Custom markdown component renderers matching glassmorphism aesthetic
// FIX: All components respect center alignment from parent container
const markdownComponents: Components = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-lg font-bold mb-3 text-slate-900 border-b border-white/20 pb-2 text-center">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-base font-bold mb-2 text-slate-800 border-b border-white/10 pb-1.5 text-center">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-sm font-semibold mb-2 text-slate-800 text-center">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="text-sm font-semibold mb-1.5 text-slate-800 text-center">
      {children}
    </h4>
  ),
  h5: ({ children }: { children?: ReactNode }) => (
    <h5 className="text-xs font-semibold mb-1.5 text-slate-800 text-center">
      {children}
    </h5>
  ),
  h6: ({ children }: { children?: ReactNode }) => (
    <h6 className="text-xs font-medium mb-1 text-slate-800 text-center">
      {children}
    </h6>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed text-slate-800 text-center">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc list-inside mb-2 ml-2 text-sm text-slate-800 flex flex-col items-center">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal list-inside mb-2 ml-2 text-sm text-slate-800 flex flex-col items-center">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="mb-1 text-center">
      {children}
    </li>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-4 border-white/30 pl-3 py-1 mb-2 italic text-slate-700 bg-white/5 my-2 rounded-r text-center mx-auto">
      {children}
    </blockquote>
  ),
  code: ({ children, inline }: { children?: ReactNode; inline?: boolean }) => {
    if (inline) {
      return (
        <code className="bg-slate-900/20 px-1.5 py-0.5 rounded text-xs font-mono text-slate-900 border border-white/10 inline-block">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-slate-900/30 p-2 rounded-lg mb-2 text-xs font-mono text-slate-900 border border-white/15 overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="bg-slate-900/30 p-2 rounded-lg mb-2 overflow-x-auto border border-white/15">
      {children}
    </pre>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto mb-2 flex justify-center">
      <table className="text-xs border-collapse border border-white/20">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-white/15 border-b border-white/25">
      {children}
    </thead>
  ),
  tbody: ({ children }: { children?: ReactNode }) => (
    <tbody>
      {children}
    </tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="border-b border-white/15 hover:bg-white/10 transition-colors">
      {children}
    </tr>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-2 py-1 border-r border-white/15 last:border-r-0 text-slate-800 text-center">
      {children}
    </td>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-2 py-1 border-r border-white/15 last:border-r-0 font-semibold text-slate-900 text-left">
      {children}
    </th>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-bold text-slate-900">
      {children}
    </strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-slate-800">
      {children}
    </em>
  ),
  del: ({ children }: { children?: ReactNode }) => (
    <del className="line-through text-slate-600">
      {children}
    </del>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-blue-500 hover:text-blue-600 underline transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr className="my-2 border-t border-white/20" />
  ),
};

export function WebGLTextRenderer({
  content,
  position = [0, 1.5, -2.5],  // FIX: Locked position directly behind model, centered
  rotation = [0, 0, 0],
  scale = 0.2,
  className,
}: WebGLTextRendererProps) {
  const isContentValid = useMemo(() => {
    const trimmed = (content ?? "").trim();
    return trimmed.length > 0;
  }, [content]);

  if (!isContentValid) return null;

  return (
    <Html
      position={position}
      rotation={rotation}
      scale={scale}
      center={true}        // FIX: center=true ensures pivot point aligns with position
      transform={true}     // FIX: Applies transformations relative to the centered pivot
      occlude={false}
    >
      <div
        className={cn(
          "max-w-[520px] min-w-[280px] max-h-[420px] overflow-y-auto rounded-3xl border border-white/15",
          "bg-white/10 p-4 text-sm text-slate-900 shadow-[0_32px_120px_-60px_rgba(15,23,42,0.75)]",
          "backdrop-blur-xl backdrop-saturate-150",
          "text-center",  // FIX: Center-align all internal text content
          className
        )}
        style={{
          background: "rgba(255, 255, 255, 0.12)",
          boxShadow: "0 28px 90px rgba(15, 23, 42, 0.18)",
          borderColor: "rgba(255, 255, 255, 0.14)",
          borderWidth: 1,
          borderStyle: "solid",
        }}
        aria-live="polite"
        aria-label="3D display content"
      >
        <ReactMarkdown
          components={markdownComponents}
          skipHtml={true}
          disallowedElements={["script", "iframe", "object", "embed"]}
        >
          {content}
        </ReactMarkdown>
      </div>
    </Html>
  );
}

export default WebGLTextRenderer;
