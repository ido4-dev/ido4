import { describe, it, expect, vi, afterEach } from 'vitest';
import { DateFormatter } from '../../../src/shared/utils/date-formatter.js';

describe('DateFormatter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelative', () => {
    it('shows minutes for recent times', () => {
      vi.useFakeTimers();
      const now = new Date('2025-07-15T10:30:00Z');
      vi.setSystemTime(now);

      const fiveMinAgo = '2025-07-15T10:25:00Z';
      expect(DateFormatter.formatRelative(fiveMinAgo)).toBe('5 minutes ago');
    });

    it('shows hours for same-day times', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-07-15T14:00:00Z'));

      expect(DateFormatter.formatRelative('2025-07-15T11:00:00Z')).toBe('3 hours ago');
    });

    it('shows days for recent dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-07-15T10:00:00Z'));

      expect(DateFormatter.formatRelative('2025-07-13T10:00:00Z')).toBe('2 days ago');
    });

    it('shows full date for older dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-07-15T10:00:00Z'));

      const result = DateFormatter.formatRelative('2025-06-01T09:30:00Z');
      expect(result).toContain('Jun');
      expect(result).toContain('2025');
    });

    it('returns "Invalid date" for invalid input', () => {
      expect(DateFormatter.formatRelative('')).toBe('Invalid date');
      expect(DateFormatter.formatRelative('not-a-date')).toBe('Invalid date');
    });

    it('shows "1 minute ago" for very recent times', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-07-15T10:00:30Z'));
      expect(DateFormatter.formatRelative('2025-07-15T10:00:00Z')).toBe('1 minute ago');
    });
  });

  describe('formatDate', () => {
    it('formats as "Mon DD, YYYY"', () => {
      expect(DateFormatter.formatDate('2025-07-31T10:17:00Z')).toMatch(/Jul 31, 2025/);
    });

    it('handles single-digit days', () => {
      expect(DateFormatter.formatDate('2025-01-05T00:00:00Z')).toMatch(/Jan 5, 2025/);
    });

    it('returns "Invalid date" for invalid input', () => {
      expect(DateFormatter.formatDate('')).toBe('Invalid date');
      expect(DateFormatter.formatDate('garbage')).toBe('Invalid date');
    });
  });

  describe('formatDateTime', () => {
    it('includes time in AM/PM format', () => {
      // Note: output depends on timezone. We test structure.
      const result = DateFormatter.formatDateTime('2025-07-31T10:17:00Z');
      expect(result).toContain('2025');
      expect(result).toMatch(/[AP]M$/);
    });

    it('handles midnight (12 AM)', () => {
      const result = DateFormatter.formatDateTime('2025-01-01T00:00:00Z');
      expect(result).toContain('2025');
      expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/);
    });

    it('returns "Invalid date" for invalid input', () => {
      expect(DateFormatter.formatDateTime('')).toBe('Invalid date');
    });
  });
});
