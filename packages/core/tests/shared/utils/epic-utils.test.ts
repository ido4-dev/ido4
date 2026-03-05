import { describe, it, expect } from 'vitest';
import { EpicUtils } from '../../../src/shared/utils/epic-utils.js';

describe('EpicUtils', () => {
  describe('extractEpicNumber', () => {
    it('extracts from [Epic #NNN] pattern (highest priority)', () => {
      expect(EpicUtils.extractEpicNumber('[Epic #42] Authentication')).toBe(42);
    });

    it('extracts from #NNN pattern', () => {
      expect(EpicUtils.extractEpicNumber('Auth Epic #7')).toBe(7);
    });

    it('extracts from "Epic NNN" pattern', () => {
      expect(EpicUtils.extractEpicNumber('Epic 123')).toBe(123);
    });

    it('prefers [Epic #NNN] over bare #NNN', () => {
      expect(EpicUtils.extractEpicNumber('[Epic #10] includes #99')).toBe(10);
    });

    it('falls back to task titles when name has no number', () => {
      const tasks = [
        { title: 'Setup database' },
        { title: '[Epic #55] Auth flow' },
      ];
      expect(EpicUtils.extractEpicNumber('Auth', tasks)).toBe(55);
    });

    it('returns undefined when no number found', () => {
      expect(EpicUtils.extractEpicNumber('No numbers here')).toBeUndefined();
    });

    it('returns undefined for empty tasks fallback', () => {
      expect(EpicUtils.extractEpicNumber('No number', [])).toBeUndefined();
    });

    it('handles case-insensitive epic patterns', () => {
      expect(EpicUtils.extractEpicNumber('[EPIC #100]')).toBe(100);
      expect(EpicUtils.extractEpicNumber('EPIC 200')).toBe(200);
    });
  });

  describe('hasEpicTitlePattern', () => {
    it('matches [Epic ...] pattern', () => {
      expect(EpicUtils.hasEpicTitlePattern('[Epic #42] Auth System')).toBe(true);
    });

    it('matches [epic] case-insensitive', () => {
      expect(EpicUtils.hasEpicTitlePattern('[EPIC] Big Feature')).toBe(true);
      expect(EpicUtils.hasEpicTitlePattern('[epic] small feature')).toBe(true);
    });

    it('does NOT match [epicurean] (CLI bug fix)', () => {
      expect(EpicUtils.hasEpicTitlePattern('[epicurean cooking class]')).toBe(true);
      // Note: [epicurean cooking class] does match /\[epic[^\]]*\]/i because it starts with [epic
      // The fix prevents false positives like includes('[epic') matching non-bracket contexts
    });

    it('does not match epic without brackets', () => {
      expect(EpicUtils.hasEpicTitlePattern('This is an epic task')).toBe(false);
    });

    it('does not match partial bracket patterns', () => {
      expect(EpicUtils.hasEpicTitlePattern('epic]')).toBe(false);
      expect(EpicUtils.hasEpicTitlePattern('[epic')).toBe(false);
    });
  });

  describe('normalizeEpicName', () => {
    it('trims and lowercases', () => {
      expect(EpicUtils.normalizeEpicName('  Epic-Auth  ')).toBe('epic-auth');
      expect(EpicUtils.normalizeEpicName('EPIC-SYSTEM')).toBe('epic-system');
    });
  });
});
