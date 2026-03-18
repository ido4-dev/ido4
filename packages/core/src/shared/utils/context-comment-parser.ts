/**
 * Parser for ido4 structured context comments.
 *
 * ido4 context comments use HTML comment markers for machine parseability:
 *   <!-- ido4:context transition=start agent=agent-beta timestamp=2026-03-13T10:00:00Z -->
 *   ... content ...
 *   <!-- /ido4:context -->
 */

import type { TaskComment } from '../../container/interfaces.js';

export interface Ido4ContextBlock {
  transition: string;
  agent?: string;
  timestamp?: string;
  body: string;
}

const IDO4_CONTEXT_PATTERN = /<!-- ido4:context\s+([\s\S]*?)-->([\s\S]*?)<!-- \/ido4:context -->/g;
const ATTR_PATTERN = /(\w+)=(\S+)/g;

/**
 * Parse ido4 structured context blocks from a comment body.
 */
export function parseIdo4ContextBlocks(commentBody: string): Ido4ContextBlock[] {
  const blocks: Ido4ContextBlock[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  IDO4_CONTEXT_PATTERN.lastIndex = 0;

  while ((match = IDO4_CONTEXT_PATTERN.exec(commentBody)) !== null) {
    const attrString = match[1]!;
    const body = match[2]!.trim();

    // Parse attributes
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    ATTR_PATTERN.lastIndex = 0;
    while ((attrMatch = ATTR_PATTERN.exec(attrString)) !== null) {
      attrs[attrMatch[1]!] = attrMatch[2]!;
    }

    if (attrs['transition']) {
      blocks.push({
        transition: attrs['transition'],
        agent: attrs['agent'],
        timestamp: attrs['timestamp'],
        body,
      });
    }
  }

  return blocks;
}

/**
 * Parse ido4 context blocks from an array of TaskComments.
 * Returns all structured context blocks found across all comments.
 */
export function parseIdo4ContextComments(comments: TaskComment[]): Ido4ContextBlock[] {
  return comments.flatMap((comment) => parseIdo4ContextBlocks(comment.body));
}

/**
 * Filter comments to only those containing ido4 context markers.
 */
export function filterIdo4ContextComments(comments: TaskComment[]): TaskComment[] {
  return comments.filter((comment) => comment.body.includes('<!-- ido4:context'));
}
