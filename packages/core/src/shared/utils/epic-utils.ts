/**
 * EpicUtils — Utilities for epic name parsing and pattern matching.
 *
 * Bug fixes from CLI:
 * - extractEpicNumber: priority hierarchy [Epic #NNN] > #NNN > Epic NNN
 *   (was greedy \#?(\d+) that matches any number)
 * - hasEpicTitlePattern: uses /\[epic[^\]]*\]/i
 *   (was includes('[epic') which matches '[epicurean')
 * - epicTasks typed as ReadonlyArray (was any[])
 */

export class EpicUtils {
  /**
   * Extract the issue number from an epic name or its task titles.
   *
   * Priority hierarchy:
   *   1. [Epic #NNN] pattern in epicName
   *   2. #NNN pattern in epicName
   *   3. Epic NNN pattern in epicName
   *   4. [Epic #NNN] in any task title (fallback)
   */
  static extractEpicNumber(
    epicName: string,
    epicTasks: ReadonlyArray<{ readonly title?: string }> = [],
  ): number | undefined {
    // Priority 1: [Epic #NNN] in epic name
    const bracketMatch = /\[epic\s*#(\d+)\]/i.exec(epicName);
    if (bracketMatch?.[1]) {
      return parseInt(bracketMatch[1], 10);
    }

    // Priority 2: #NNN in epic name
    const hashMatch = /#(\d+)/.exec(epicName);
    if (hashMatch?.[1]) {
      return parseInt(hashMatch[1], 10);
    }

    // Priority 3: Epic NNN in epic name
    const epicNumMatch = /epic\s+(\d+)/i.exec(epicName);
    if (epicNumMatch?.[1]) {
      return parseInt(epicNumMatch[1], 10);
    }

    // Priority 4: search task titles
    for (const task of epicTasks) {
      if (task.title) {
        const titleMatch = /\[epic\s*#(\d+)\]/i.exec(task.title);
        if (titleMatch?.[1]) {
          return parseInt(titleMatch[1], 10);
        }
      }
    }

    return undefined;
  }

  /**
   * Check if a title contains an epic marker pattern.
   * Matches [epic ...] but NOT [epicurean] or similar false positives.
   */
  static hasEpicTitlePattern(title: string): boolean {
    return /\[epic[^\]]*\]/i.test(title);
  }

  /** Normalize an epic name for comparison. */
  static normalizeEpicName(epicName: string): string {
    return epicName.trim().toLowerCase();
  }
}
