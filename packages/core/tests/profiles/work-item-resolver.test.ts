import { describe, it, expect } from 'vitest';
import { resolveWorkItemType } from '../../src/profiles/work-item-resolver.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';

describe('resolveWorkItemType', () => {
  describe('Scrum profile (label-based, 5 types)', () => {
    it('resolves type:bug label to bug', () => {
      expect(resolveWorkItemType(['type:bug', 'priority:high'], SCRUM_PROFILE)).toBe('bug');
    });

    it('resolves type:spike label to spike', () => {
      expect(resolveWorkItemType(['type:spike'], SCRUM_PROFILE)).toBe('spike');
    });

    it('resolves type:tech-debt label to tech-debt', () => {
      expect(resolveWorkItemType(['type:tech-debt'], SCRUM_PROFILE)).toBe('tech-debt');
    });

    it('resolves type:chore label to chore', () => {
      expect(resolveWorkItemType(['type:chore'], SCRUM_PROFILE)).toBe('chore');
    });

    it('resolves type:story label to story', () => {
      expect(resolveWorkItemType(['type:story'], SCRUM_PROFILE)).toBe('story');
    });

    it('falls back to default type when no matching label', () => {
      expect(resolveWorkItemType(['priority:high', 'component:auth'], SCRUM_PROFILE)).toBe('story');
    });

    it('falls back to default type for empty labels', () => {
      expect(resolveWorkItemType([], SCRUM_PROFILE)).toBe('story');
    });

    it('falls back to default type for unknown type label', () => {
      expect(resolveWorkItemType(['type:unknown-thing'], SCRUM_PROFILE)).toBe('story');
    });

    it('uses first matching type label', () => {
      expect(resolveWorkItemType(['type:bug', 'type:spike'], SCRUM_PROFILE)).toBe('bug');
    });
  });

  describe('Shape Up profile (label-based, 1 type)', () => {
    it('resolves type:task label to task', () => {
      expect(resolveWorkItemType(['type:task'], SHAPE_UP_PROFILE)).toBe('task');
    });

    it('falls back to task as default', () => {
      expect(resolveWorkItemType([], SHAPE_UP_PROFILE)).toBe('task');
    });
  });

  describe('Hydro profile', () => {
    it('falls back to default type', () => {
      expect(resolveWorkItemType([], HYDRO_PROFILE)).toBe(HYDRO_PROFILE.workItems.defaultType);
    });
  });
});
