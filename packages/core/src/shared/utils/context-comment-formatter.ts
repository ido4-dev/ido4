/**
 * Formatter for ido4 structured context comments.
 *
 * Produces machine-parseable, human-readable Markdown comments
 * with HTML comment markers for the context pipeline.
 */

export interface FormatContextOptions {
  transition: string;
  agent?: string;
  content: string;
}

/**
 * Format an ido4 structured context comment.
 */
export function formatIdo4ContextComment(options: FormatContextOptions): string {
  const timestamp = new Date().toISOString();
  const agentAttr = options.agent ? ` agent=${options.agent}` : '';

  return [
    `<!-- ido4:context transition=${options.transition}${agentAttr} timestamp=${timestamp} -->`,
    options.content,
    `<!-- /ido4:context -->`,
  ].join('\n');
}
