/**
 * Shared utilities for spec parsing — used by both the technical spec parser
 * (in @ido4/core) and the strategic spec parser (in this package).
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
 *
 * Output is constrained to satisfy the downstream task-ref pattern `[A-Z]{2,5}`
 * used by capability/task heading parsers — non-letter characters (em-dashes,
 * commas, slashes, digits) are treated as separators so they cannot leak into
 * the prefix, and multi-word output is capped at 5 characters.
 *
 * Single word: first 3 letters uppercased.
 * Multiple words: initials uppercased, capped at 5.
 * Empty after sanitization: returns 'GRP' as a safe fallback.
 */
export function derivePrefix(groupName: string): string {
  const words = groupName.replace(/[^a-zA-Z]+/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 'GRP';
  }
  if (words.length === 1) {
    return words[0]!.substring(0, 3).toUpperCase();
  }
  return words
    .map(w => w[0]!)
    .join('')
    .toUpperCase()
    .substring(0, 5);
}
