/**
 * Shared utilities for spec parsing — used by both the technical spec parser
 * and the strategic spec parser.
 */

/**
 * Parse a pipe-delimited metadata line into key-value pairs.
 * Format: "key: value | key: value | ..."
 */
export function parseMetadataLine(line: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const segment of line.split('|')) {
    const match = segment.trim().match(/^(\w+):\s*(.+)$/);
    if (match && match[1] && match[2]) {
      pairs[match[1]] = match[2].trim();
    }
  }
  return pairs;
}

/**
 * Derive a group prefix from a group name.
 * Single word: first 3 characters uppercased.
 * Multiple words: initials uppercased.
 */
export function derivePrefix(groupName: string): string {
  const words = groupName.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0]!.substring(0, 3).toUpperCase();
  }
  return words
    .map(w => w[0]!)
    .join('')
    .toUpperCase();
}
