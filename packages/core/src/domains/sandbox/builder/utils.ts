/**
 * Shared utilities for the scenario builder pipeline.
 */

/** Extract source file path references (src/.../*.ts) from text. */
export function extractCodeRefs(text: string): string[] {
  const matches = text.match(/src\/[a-zA-Z0-9_\-/.]+\.ts/g);
  return matches ? [...new Set(matches)] : [];
}
