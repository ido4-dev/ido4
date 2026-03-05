import { describe, it, expect } from 'vitest';
import { WorkflowConfig } from '../../src/config/workflow-config.js';
import { createMockProjectConfig } from '../helpers/mock-factories.js';
import { ConfigurationError } from '../../src/shared/errors/index.js';

describe('WorkflowConfig', () => {
  const config = new WorkflowConfig(createMockProjectConfig());

  describe('getStatusId', () => {
    it('returns the status option ID', () => {
      expect(config.getStatusId('BACKLOG')).toBe('opt_backlog');
      expect(config.getStatusId('IN_PROGRESS')).toBe('opt_progress');
      expect(config.getStatusId('DONE')).toBe('opt_done');
    });

    it('throws ConfigurationError for unknown key', () => {
      expect(() => config.getStatusId('UNKNOWN')).toThrow(ConfigurationError);
    });
  });

  describe('getStatusName', () => {
    it('returns the display name', () => {
      expect(config.getStatusName('BACKLOG')).toBe('Backlog');
      expect(config.getStatusName('IN_PROGRESS')).toBe('In Progress');
      expect(config.getStatusName('DONE')).toBe('Done');
    });

    it('throws ConfigurationError for unknown key', () => {
      expect(() => config.getStatusName('INVALID')).toThrow(ConfigurationError);
    });
  });

  describe('getFieldId', () => {
    it('returns the field ID', () => {
      expect(config.getFieldId('status')).toBe('PVTF_status_001');
      expect(config.getFieldId('wave')).toBe('PVTF_wave_001');
      expect(config.getFieldId('ai_suitability')).toBe('PVTF_ai_001');
    });

    it('throws ConfigurationError for unknown field', () => {
      expect(() => config.getFieldId('nonexistent')).toThrow(ConfigurationError);
    });
  });

  describe('isValidTransition', () => {
    it('accepts valid forward transitions', () => {
      expect(config.isValidTransition('Backlog', 'In Refinement')).toBe(true);
      expect(config.isValidTransition('In Refinement', 'Ready for Dev')).toBe(true);
      expect(config.isValidTransition('Ready for Dev', 'In Progress')).toBe(true);
      expect(config.isValidTransition('In Progress', 'In Review')).toBe(true);
      expect(config.isValidTransition('In Review', 'Done')).toBe(true);
    });

    it('accepts fast-track transition', () => {
      expect(config.isValidTransition('Backlog', 'Ready for Dev')).toBe(true);
    });

    it('accepts block transitions', () => {
      expect(config.isValidTransition('In Progress', 'Blocked')).toBe(true);
      expect(config.isValidTransition('Ready for Dev', 'Blocked')).toBe(true);
    });

    it('accepts unblock transition', () => {
      expect(config.isValidTransition('Blocked', 'Ready for Dev')).toBe(true);
    });

    it('accepts return (backward) transitions', () => {
      expect(config.isValidTransition('Ready for Dev', 'In Refinement')).toBe(true);
      expect(config.isValidTransition('In Progress', 'Ready for Dev')).toBe(true);
      expect(config.isValidTransition('In Review', 'In Progress')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(config.isValidTransition('Backlog', 'Done')).toBe(false);
      expect(config.isValidTransition('Done', 'Backlog')).toBe(false);
      expect(config.isValidTransition('In Review', 'Backlog')).toBe(false);
    });

    it('O(1) lookup (uses Set)', () => {
      // Just verifying it works consistently — Set-based internals are O(1)
      for (let i = 0; i < 100; i++) {
        expect(config.isValidTransition('Ready for Dev', 'In Progress')).toBe(true);
        expect(config.isValidTransition('Done', 'Backlog')).toBe(false);
      }
    });
  });

  describe('getAllStatusValues', () => {
    it('returns all 7 statuses', () => {
      const statuses = config.getAllStatusValues();
      expect(Object.keys(statuses).length).toBe(7);
      expect(statuses['BACKLOG']).toBe('Backlog');
      expect(statuses['DONE']).toBe('Done');
    });
  });

  describe('getValidNextTransitions', () => {
    it('returns valid destinations from In Progress', () => {
      const next = config.getValidNextTransitions('In Progress');
      expect(next).toContain('In Review');
      expect(next).toContain('Blocked');
      expect(next).toContain('Ready for Dev');
      expect(next).toHaveLength(3);
    });

    it('returns valid destinations from Backlog', () => {
      const next = config.getValidNextTransitions('Backlog');
      expect(next).toContain('In Refinement');
      expect(next).toContain('Ready for Dev');
      expect(next).toContain('Blocked');
    });

    it('returns valid destinations from Blocked (unblock only)', () => {
      const next = config.getValidNextTransitions('Blocked');
      expect(next).toContain('Ready for Dev');
      expect(next).toHaveLength(1);
    });

    it('returns Done→Done (administrative)', () => {
      const next = config.getValidNextTransitions('Done');
      expect(next).toContain('Done');
      expect(next).toHaveLength(1);
    });

    it('returns empty array for unknown status', () => {
      expect(config.getValidNextTransitions('Nonexistent')).toEqual([]);
    });
  });
});
