// Lightweight sanitize utility with graceful fallback if DOMPurify isn't installed.
// Keeps a strict posture: removes <script>, iframe/object/embed, and strips event-handler attributes.

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined") return "";

  // Prefer any DOMPurify instance available on window (e.g., via CDN or earlier boot)
  const win = window as any;
  try {
    if (win.DOMPurify && typeof win.DOMPurify.sanitize === "function") {
      return win.DOMPurify.sanitize(input);
    }
  } catch (e) {
    // fall through to other strategies
  }

  // Fallback: try to require dompurify if bundled in node_modules (may fail in browser bundlers)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const createDOMPurify = require("dompurify");
    if (createDOMPurify) {
      // require('dompurify') returns a factory that expects window
      const DOMPurify = createDOMPurify(window);
      return DOMPurify.sanitize(input);
    }
  } catch (e) {
    // ignore and use DOMParser fallback
  }

  // Minimal DOMParser-based sanitizer: remove risky elements and attributes
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, "text/html");

    // Remove dangerous elements
    doc.querySelectorAll("script,iframe,object,embed,link,meta,style").forEach((n) => n.remove());

    // Remove event handler attributes (on*) and javascript: href/src
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null as any, false);
    let node = walker.nextNode();
    while (node) {
      const el = node as Element;
      // copy attributes to avoid live collection issues
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value || "";
        if (name.startsWith("on") || value.trim().toLowerCase().startsWith("javascript:")) {
          el.removeAttribute(attr.name);
        }
        // Optionally strip inline styles for strict mode
        if (name === "style") {
          el.removeAttribute("style");
        }
      });
      node = walker.nextNode();
    }

    return doc.body.innerHTML;
  } catch (e) {
    // As last resort, strip all tags
    return input.replace(/<[^>]*>?/gm, "");
  }
}
