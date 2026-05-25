"use client";

import { type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * Markdown component renderers for chat messages
 * Styled for clean, readable text display without visual containers
 * Matches Gemini AI aesthetic with natural text flow
 */
const chatMessageMarkdownComponents: Components = {
  // Headings
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-base font-bold mb-2 mt-3 text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-sm font-bold mb-2 mt-2.5 text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-sm font-semibold mb-1.5 mt-2 text-foreground">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="text-xs font-semibold mb-1 mt-1.5 text-foreground">
      {children}
    </h4>
  ),
  h5: ({ children }: { children?: ReactNode }) => (
    <h5 className="text-xs font-semibold mb-1 mt-1.5 text-foreground">
      {children}
    </h5>
  ),
  h6: ({ children }: { children?: ReactNode }) => (
    <h6 className="text-xs font-medium mb-1 mt-1.5 text-foreground">
      {children}
    </h6>
  ),

  // Paragraph - natural text flow
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-3 text-foreground/95 leading-relaxed">
      {children}
    </p>
  ),

  // Lists
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc list-inside mb-3 ml-2 text-foreground/95 space-y-1">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal list-inside mb-3 ml-2 text-foreground/95 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-sm leading-relaxed">
      {children}
    </li>
  ),

  // Blockquotes
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-3 border-primary/30 pl-3 py-1 my-2 italic text-foreground/70 bg-primary/5 rounded-r">
      {children}
    </blockquote>
  ),

  // Code
  code: ({ children, inline }: { children?: ReactNode; inline?: boolean }) => {
    if (inline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground/90 border border-border/30">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-muted/50 p-3 rounded-lg mb-3 text-xs font-mono text-foreground/90 border border-border/30 overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="bg-muted/50 p-3 rounded-lg mb-3 overflow-x-auto border border-border/30">
      {children}
    </pre>
  ),

  // Tables
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto mb-3 border border-border/30 rounded-lg">
      <table className="w-full text-xs border-collapse">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-muted border-b border-border/30">
      {children}
    </thead>
  ),
  tbody: ({ children }: { children?: ReactNode }) => (
    <tbody>
      {children}
    </tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="border-b border-border/20 hover:bg-muted/50 transition-colors">
      {children}
    </tr>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-3 py-2 border-r border-border/20 last:border-r-0 text-foreground/90">
      {children}
    </td>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-3 py-2 border-r border-border/20 last:border-r-0 font-semibold text-foreground text-left">
      {children}
    </th>
  ),

  // Text formatting
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-bold text-foreground">
      {children}
    </strong>
  ),
  em: ({ children }: { children?: ReactNode }) => (
    <em className="italic text-foreground/90">
      {children}
    </em>
  ),
  del: ({ children }: { children?: ReactNode }) => (
    <del className="line-through text-foreground/60">
      {children}
    </del>
  ),

  // Links
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-primary hover:text-primary/80 underline transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  // Horizontal rule
  hr: () => (
    <hr className="my-3 border-t border-border/30" />
  ),
};

/**
 * MarkdownMessage - Renders markdown content in chat with clean styling
 * 
 * Features:
 * - Full markdown syntax support (lists, code blocks, tables, formatting)
 * - Natural text flow without visual containers
 * - Theme-aware colors using CSS variables
 * - Proper spacing and typography
 * 
 * Process Flow:
 * 1. Accept markdown string content
 * 2. Parse with react-markdown
 * 3. Render with custom component styling
 * 4. Sanitize HTML to prevent XSS
 */
export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        components={chatMessageMarkdownComponents}
        skipHtml={true}
        disallowedElements={["script", "iframe", "object", "embed"]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownMessage;
