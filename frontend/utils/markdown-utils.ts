/**
 * Markdown Utilities
 * 
 * Helper functions for processing chat responses based on 3D model state.
 * The backend already extracts XML tags into separate fields:
 * - display: content from <display> tag
 * - display2d: content from <text> tag  
 * - voice: content from <voice> tag
 */

/**
 * Get display content based on model state
 * 
 * When model is OFF, prioritize display2d (text tag content)
 * When model is ON, use display (display tag content)
 * 
 * @param displayField - The display field from backend response
 * @param display2dField - The display2d field from backend response (contains <text> tag)
 * @param isModelActive - Whether 3D model is active/visible
 * @returns Content to display in chat interface
 */
export function getResponseContent(
  displayField: string | undefined,
  display2dField: string | undefined,
  isModelActive: boolean
): string {
  if (isModelActive) {
    // When model is ON, use display field (from <display> tag)
    return displayField || "No response received";
  }

  // When model is OFF, prioritize display2d field (from <text> tag)
  if (display2dField) {
    return display2dField;
  }

  // Fallback to display field
  return displayField || "No response received";
}

