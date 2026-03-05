/**
 * DateFormatter — Deterministic date formatting utilities.
 *
 * Fixes from CLI:
 * - Input validation on all methods (returns "Invalid date" for bad input)
 * - Removed formatRelativeEnhanced (near-duplicate of formatRelative)
 * - Removed formatSimple (non-deterministic locale)
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export class DateFormatter {
  /**
   * Format as relative time: "5 minutes ago", "3 hours ago", "2 days ago",
   * or absolute date if older than 7 days.
   */
  static formatRelative(isoString: string): string {
    const date = DateFormatter.parse(isoString);
    if (!date) return 'Invalid date';

    const now = Date.now();
    const diffMs = now - date.getTime();

    if (diffMs < HOUR_MS) {
      const mins = Math.max(1, Math.floor(diffMs / MINUTE_MS));
      return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
    }

    if (diffMs < DAY_MS) {
      const hours = Math.floor(diffMs / HOUR_MS);
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }

    if (diffMs < DAY_MS * 7) {
      const days = Math.floor(diffMs / DAY_MS);
      return days === 1 ? '1 day ago' : `${days} days ago`;
    }

    return DateFormatter.formatDateTime(isoString);
  }

  /**
   * Format as absolute date: "Jul 31, 2025"
   */
  static formatDate(isoString: string): string {
    const date = DateFormatter.parse(isoString);
    if (!date) return 'Invalid date';

    const month = MONTHS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  /**
   * Format as absolute date+time: "Jul 31, 2025, 10:17 AM"
   */
  static formatDateTime(isoString: string): string {
    const date = DateFormatter.parse(isoString);
    if (!date) return 'Invalid date';

    const month = MONTHS[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${month} ${day}, ${year}, ${displayHour}:${displayMinutes} ${ampm}`;
  }

  /** Parse an ISO string into a Date, returning undefined for invalid input. */
  private static parse(isoString: string): Date | undefined {
    if (!isoString) return undefined;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return undefined;
    return date;
  }
}
