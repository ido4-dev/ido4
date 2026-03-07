/**
 * Scenario Integrity Tests — verify the governance-showcase scenario is
 * correctly structured with the expected violations and properties.
 */

import { describe, it, expect } from 'vitest';
import { GOVERNANCE_SHOWCASE } from '../../../src/domains/sandbox/scenarios/governance-showcase.js';

describe('Governance Showcase Scenario Integrity', () => {
  const scenario = GOVERNANCE_SHOWCASE;

  it('has correct metadata', () => {
    expect(scenario.id).toBe('governance-showcase');
    expect(scenario.name).toBe('Governance Showcase');
    expect(scenario.description).toBeTruthy();
  });

  // ─── Structural Integrity ───

  it('has 4 waves', () => {
    expect(scenario.waves).toHaveLength(4);
  });

  it('has 5 epics', () => {
    expect(scenario.epics).toHaveLength(5);
  });

  it('has 20 tasks', () => {
    expect(scenario.tasks).toHaveLength(20);
  });

  it('all task epicRefs resolve to defined epics', () => {
    const epicRefs = new Set(scenario.epics.map((e) => e.ref));
    for (const task of scenario.tasks) {
      expect(epicRefs.has(task.epicRef)).toBe(true);
    }
  });

  it('all task dependencyRefs resolve to defined tasks that appear earlier', () => {
    const taskRefs = new Set<string>();
    for (const task of scenario.tasks) {
      if (task.dependencyRefs) {
        for (const depRef of task.dependencyRefs) {
          expect(taskRefs.has(depRef)).toBe(true);
        }
      }
      taskRefs.add(task.ref);
    }
  });

  it('all task waves reference defined wave names', () => {
    const waveNames = new Set(scenario.waves.map((w) => w.name));
    for (const task of scenario.tasks) {
      expect(waveNames.has(task.wave)).toBe(true);
    }
  });

  it('all task refs are unique', () => {
    const refs = scenario.tasks.map((t) => t.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('all epic refs are unique', () => {
    const refs = scenario.epics.map((e) => e.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  // ─── Wave State ───

  it('wave-001-foundation is completed', () => {
    const wave = scenario.waves.find((w) => w.name === 'wave-001-foundation');
    expect(wave?.state).toBe('completed');
  });

  it('wave-002-core is active', () => {
    const wave = scenario.waves.find((w) => w.name === 'wave-002-core');
    expect(wave?.state).toBe('active');
  });

  it('wave-003 and wave-004 are planned', () => {
    const wave3 = scenario.waves.find((w) => w.name === 'wave-003-advanced');
    const wave4 = scenario.waves.find((w) => w.name === 'wave-004-polish');
    expect(wave3?.state).toBe('planned');
    expect(wave4?.state).toBe('planned');
  });

  // ─── Wave 1 — All Done ───

  it('all wave-001 tasks are DONE', () => {
    const wave1Tasks = scenario.tasks.filter((t) => t.wave === 'wave-001-foundation');
    expect(wave1Tasks).toHaveLength(5);
    for (const task of wave1Tasks) {
      expect(task.status).toBe('DONE');
    }
  });

  // ─── Wave 2 — Mixed States ───

  it('wave-002 has 10 tasks with mixed states', () => {
    const wave2Tasks = scenario.tasks.filter((t) => t.wave === 'wave-002-core');
    expect(wave2Tasks).toHaveLength(10);

    const statuses = wave2Tasks.map((t) => t.status);
    expect(statuses.filter((s) => s === 'DONE')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'IN_PROGRESS')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'BLOCKED')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'IN_REVIEW')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'READY_FOR_DEV')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'IN_REFINEMENT')).toHaveLength(1);
  });

  // ─── Governance Violations ───

  describe('Epic Integrity Violation', () => {
    it('Auth epic E3 spans wave-002 and wave-003', () => {
      const e3Tasks = scenario.tasks.filter((t) => t.epicRef === 'E3');
      const e3Waves = new Set(e3Tasks.map((t) => t.wave));
      expect(e3Waves.size).toBeGreaterThan(1);
      expect(e3Waves.has('wave-002-core')).toBe(true);
      expect(e3Waves.has('wave-003-advanced')).toBe(true);
    });

    it('T16 has EPIC_INTEGRITY_VIOLATION governance signal', () => {
      const t16 = scenario.tasks.find((t) => t.ref === 'T16');
      expect(t16?.governanceSignal).toBe('EPIC_INTEGRITY_VIOLATION');
    });
  });

  describe('Cascade Depth for Work Distribution', () => {
    it('T14 depends on T13 (cascade depth for scoring differentiation)', () => {
      const t14 = scenario.tasks.find((t) => t.ref === 'T14');
      expect(t14?.dependencyRefs).toContain('T13');
    });
  });

  describe('Cascade Blocker', () => {
    it('T7 → T8 → T9 dependency cascade exists', () => {
      const t8 = scenario.tasks.find((t) => t.ref === 'T8');
      const t9 = scenario.tasks.find((t) => t.ref === 'T9');
      expect(t8?.dependencyRefs).toContain('T7');
      expect(t9?.dependencyRefs).toContain('T8');
    });

    it('T8 and T9 are BLOCKED', () => {
      const t8 = scenario.tasks.find((t) => t.ref === 'T8');
      const t9 = scenario.tasks.find((t) => t.ref === 'T9');
      expect(t8?.status).toBe('BLOCKED');
      expect(t9?.status).toBe('BLOCKED');
    });

    it('T7 is IN_PROGRESS (the root cause)', () => {
      const t7 = scenario.tasks.find((t) => t.ref === 'T7');
      expect(t7?.status).toBe('IN_PROGRESS');
    });
  });

  describe('False Status', () => {
    it('T10 is IN_REVIEW (but no PR exists in sandbox)', () => {
      const t10 = scenario.tasks.find((t) => t.ref === 'T10');
      expect(t10?.status).toBe('IN_REVIEW');
      expect(t10?.governanceSignal).toBe('FALSE_STATUS');
    });
  });

  describe('Review Bottleneck', () => {
    it('T12 is IN_REVIEW (stale review)', () => {
      const t12 = scenario.tasks.find((t) => t.ref === 'T12');
      expect(t12?.status).toBe('IN_REVIEW');
      expect(t12?.governanceSignal).toBe('REVIEW_BOTTLENECK');
    });
  });

  // ─── Seeded PR Configuration ───

  describe('Seeded PRs', () => {
    it('T12 has seedPR configured (stale review with real PR)', () => {
      const t12 = scenario.tasks.find((t) => t.ref === 'T12');
      expect(t12?.seedPR).toBeDefined();
      expect(t12?.seedPR?.branchName).toBeTruthy();
      expect(t12?.seedPR?.prTitle).toBeTruthy();
    });

    it('T10 does NOT have seedPR (false status — no PR)', () => {
      const t10 = scenario.tasks.find((t) => t.ref === 'T10');
      expect(t10?.seedPR).toBeUndefined();
    });
  });

  // ─── Context Comments ───

  describe('Context Comments', () => {
    it('T7, T8, T9, T10, T12 have contextComments', () => {
      const tasksWithComments = ['T7', 'T8', 'T9', 'T10', 'T12'];
      for (const ref of tasksWithComments) {
        const task = scenario.tasks.find((t) => t.ref === ref);
        expect(task?.contextComments, `${ref} should have contextComments`).toBeDefined();
        expect(task!.contextComments!.length).toBeGreaterThan(0);
      }
    });

    it('contextComments contain temporal language', () => {
      const tasksWithComments = ['T7', 'T8', 'T9', 'T10', 'T12'];
      const temporalPatterns = /\d+\s+days?\s+ago|\d+\s+days?|waiting/i;
      for (const ref of tasksWithComments) {
        const task = scenario.tasks.find((t) => t.ref === ref);
        const allComments = task!.contextComments!.join(' ');
        expect(
          temporalPatterns.test(allComments),
          `${ref} contextComments should contain temporal language`,
        ).toBe(true);
      }
    });

    it('wave-001 tasks have no contextComments', () => {
      const wave1Tasks = scenario.tasks.filter((t) => t.wave === 'wave-001-foundation');
      for (const task of wave1Tasks) {
        expect(task.contextComments).toBeUndefined();
      }
    });

    it('contextComments with #T_REF patterns reference valid task refs', () => {
      const taskRefs = new Set(scenario.tasks.map((t) => t.ref));
      for (const task of scenario.tasks) {
        if (task.contextComments) {
          for (const comment of task.contextComments) {
            const refs = comment.match(/#(T\d+)/g);
            if (refs) {
              for (const ref of refs) {
                const cleanRef = ref.replace('#', '');
                expect(taskRefs.has(cleanRef), `${task.ref} references ${cleanRef} which should exist`).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  // ─── Clean Epics ───

  it('all other epics (E1, E2, E4, E5) are within single waves', () => {
    const singleWaveEpics = ['E1', 'E2', 'E4', 'E5'];
    for (const epicRef of singleWaveEpics) {
      const tasks = scenario.tasks.filter((t) => t.epicRef === epicRef);
      const waves = new Set(tasks.map((t) => t.wave));
      expect(waves.size).toBe(1);
    }
  });

  // ─── Field Values ───

  it('all tasks have required fields', () => {
    for (const task of scenario.tasks) {
      expect(task.ref).toBeTruthy();
      expect(task.title).toBeTruthy();
      expect(task.body).toBeTruthy();
      expect(task.epicRef).toBeTruthy();
      expect(task.wave).toBeTruthy();
      expect(task.status).toBeTruthy();
      expect(task.effort).toBeTruthy();
      expect(task.riskLevel).toBeTruthy();
      expect(task.aiSuitability).toBeTruthy();
    }
  });
});
