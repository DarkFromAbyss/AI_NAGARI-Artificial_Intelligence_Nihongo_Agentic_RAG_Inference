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
  /** 
   * Intent tag from the message (e.g., "search", "chat", "translate").
   * Used for conditional rendering logic.
   */
  intent?: string;
  /** 
   * Whether the 3D model is active/visible.
   * Acts as an override for conditional rendering.
   */
  isModelActive?: boolean;
}

/**
 * WebGLTextRenderer - Renders Markdown content within 3D WebGL space
 *
 * Renders markdown content with full syntax support (headings, tables, lists,
 * blockquotes, code blocks, and text formatting) as a 3D overlay positioned
 * directly BEHIND the VRM model at a fixed, grounded location.
 *
 * ============================================================================
 * CRITICAL FIX #1: Bounding Box Alignment & Centering
 * ============================================================================
 * 
 * **Problem**: When message string gets long, bounding box shifts/offsets to the
 * right instead of staying centered.
 *
 * **Root Cause**: Misaligned anchor points between the Html component's position
 * and the actual content div, causing the box to drift as content width changes.
 *
 * **Solutions Applied**:
 * 
 * 1. **Absolute Position with Centered Pivot** [0, 1.5, -2.5]
 *    - x=0: Centered horizontally (directly aligned with model center)
 *    - y=1.5: Positioned at chest height of VRM model (grounded, not floating)
 *    - z=-2.5: Placed directly BEHIND the model (negative Z = away from camera)
 *
 * 2. **Html Pivot Point Fix**: Uses center={true} and transform={true}
 *    - center={true}: Centers the box's pivot AT the assigned coordinate
 *    - transform={true}: Applies rotation/scale transforms relative to pivot
 *    - CRITICAL: Without center={true}, the box's top-left corner aligns to
 *      position, causing rightward drift as content expands
 *    - With center={true}, the box's CENTER aligns to position, so expansion
 *      happens equally in all directions (stable, no drift)
 *
 * 3. **Text Alignment**: Internal div has text-center on all text elements
 *    - All headings, paragraphs, lists centered
 *    - Content anchors are symmetric
 *    - Text doesn't shift left/right based on word length
 *
 * 4. **Dynamic Box Sizing**: max-w-[520px] min-w-[280px] ensures:
 *    - Box expands with content up to max width
 *    - Doesn't shrink below min width
 *    - Expansion centered (not rightward) due to center={true}
 *
 * 5. **Grounding**: Fixed y=1.5 ensures the box stays level on world plane
 *    - Not tilted or floating unevenly
 *    - Consistent vertical position relative to model
 *
 * ============================================================================
 * CRITICAL FIX #2: Conditional Rendering Logic
 * ============================================================================
 *
 * **Render Condition Logic**:
 * ```
 * shouldRender = (intent === 'search') || (!isModelActive)
 * ```
 *
 * **Explanation**:
 * - Render if intent is exactly 'search' AND/OR if model is OFF (isModelActive === false)
 * - intent === 'search': Shows text box ONLY for search-type intents
 * - !isModelActive: OVERRIDES intent check - when model is OFF, show text regardless
 * - This allows flexible control: search results appear when searching, AND text
 *   always appears when the user switches to 2D mode (model off)
 *
 * **Use Cases**:
 * - Case 1: intent='search' AND isModelActive=true → SHOW (search result visible)
 * - Case 2: intent='chat' AND isModelActive=true → HIDE (regular chat, no 3D box)
 * - Case 3: intent='search' AND isModelActive=false → SHOW (search in 2D mode)
 * - Case 4: intent='chat' AND isModelActive=false → SHOW (2D chat, always show)
 *
 * Process Flow:
 * 1. Accept markdown content as string
 * 2. Accept intent (from message tags) and isModelActive (from UI state)
 * 3. Evaluate shouldRender condition: (intent === 'search') || (!isModelActive)
 * 4. If shouldRender is false, return null (cleanly unmount, optimize performance)
 * 5. If shouldRender is true, continue rendering:
 *    - Parse markdown using react-markdown with custom component renderers
 *    - Sanitize output via react-markdown's built-in XSS protection
 *    - Render as Html overlay in 3D space using @react-three/drei
 *    - Apply glassmorphism styling for visual consistency
 *    - Position LOCKED directly behind VRM model at [0, 1.5, -2.5]
 *    - Center the box's pivot point to eliminate shift/drift
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
  position = [0, 1.5, -2.5],  // FIX #1: Locked position directly behind model, centered
  rotation = [0, 0, 0],
  scale = 0.2,
  className,
  intent,
  isModelActive = true,
}: WebGLTextRendererProps) {
  // Validate content is present and non-empty
  const isContentValid = useMemo(() => {
    const trimmed = (content ?? "").trim();
    return trimmed.length > 0;
  }, [content]);

  // ============================================================================
  // FIX #2: CONDITIONAL RENDERING LOGIC
  // ============================================================================
  // 
  // shouldRender evaluates: (intent === 'search') || (!isModelActive)
  //
  // This means the text box will render if:
  // 1. The intent is exactly 'search' (regardless of model state), OR
  // 2. The model is OFF (isModelActive === false), which acts as an override
  //
  // The !isModelActive override ensures that when the user switches to 2D mode
  // (model turned off), the text box still displays for better UX.
  const shouldRender = useMemo(() => {
    if (!isContentValid) return false;

    // Main condition: render if intent is 'search' OR model is off
    return (intent === 'search') || (!isModelActive);
  }, [isContentValid, intent, isModelActive]);

  // Early exit: if render condition not met, cleanly unmount to optimize performance
  if (!shouldRender) {
    return null;
  }

  return (
    <Html
      position={position}
      rotation={rotation}
      scale={scale}
      center={true}        // FIX #1: center=true ensures pivot point aligns with position
      transform={true}     // FIX #1: Applies transformations relative to the centered pivot
      occlude={false}
    >
      <div
        className={cn(
          "max-w-[520px] min-w-[280px] max-h-[420px] overflow-y-auto rounded-3xl border border-white/15",
          "bg-white/10 p-4 text-sm text-slate-900 shadow-[0_32px_120px_-60px_rgba(15,23,42,0.75)]",
          "backdrop-blur-xl backdrop-saturate-150",
          "text-center",  // FIX #1: Center-align all internal text content
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
