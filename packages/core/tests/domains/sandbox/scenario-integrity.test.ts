/**
 * Scenario Integrity Tests — verify sandbox scenarios are correctly
 * structured with the expected violations and properties.
 *
 * Tests are methodology-agnostic where possible, but verify
 * profile-specific violations for each scenario.
 */

import { describe, it, expect } from 'vitest';
import { HYDRO_GOVERNANCE } from '../../../src/domains/sandbox/scenarios/hydro-governance.js';
import { SCRUM_SPRINT } from '../../../src/domains/sandbox/scenarios/scrum-sprint.js';
import { SHAPE_UP_CYCLE } from '../../../src/domains/sandbox/scenarios/shape-up-cycle.js';
import { ProfileRegistry } from '../../../src/profiles/registry.js';
import type { SandboxScenario } from '../../../src/domains/sandbox/types.js';

/** Generic scenario structural validation applicable to any scenario */
function describeScenarioStructure(scenario: SandboxScenario) {
  const profile = ProfileRegistry.getBuiltin(scenario.profileId);

  it('has valid profileId', () => {
    expect(() => ProfileRegistry.getBuiltin(scenario.profileId)).not.toThrow();
  });

  it('all task refs are unique', () => {
    const refs = scenario.tasks.map((t) => t.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('all parent issue refs are unique', () => {
    const refs = scenario.parentIssues.map((p) => p.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('all container instance refs are unique', () => {
    const refs = scenario.containerInstances.map((c) => c.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('all task container values reference defined container instance names', () => {
    const instanceNames = new Set(scenario.containerInstances.map((c) => c.name));
    for (const task of scenario.tasks) {
      for (const [_containerType, containerValue] of Object.entries(task.containers)) {
        // Skip parent refs (e.g., '#E1')
        if (containerValue.startsWith('#')) continue;
        expect(
          instanceNames.has(containerValue),
          `Task ${task.ref} references container "${containerValue}" which is not defined`,
        ).toBe(true);
      }
    }
  });

  it('all task parentRefs resolve to defined parent issues', () => {
    const parentRefs = new Set(scenario.parentIssues.map((p) => p.ref));
    for (const task of scenario.tasks) {
      if (task.parentRef) {
        expect(
          parentRefs.has(task.parentRef),
          `Task ${task.ref} has parentRef "${task.parentRef}" which is not defined`,
        ).toBe(true);
      }
    }
  });

  it('all task dependencyRefs resolve to defined tasks that appear earlier', () => {
    const taskRefs = new Set<string>();
    for (const task of scenario.tasks) {
      if (task.dependencyRefs) {
        for (const depRef of task.dependencyRefs) {
          expect(taskRefs.has(depRef), `${task.ref} depends on ${depRef} which hasn't appeared yet`).toBe(true);
        }
      }
      taskRefs.add(task.ref);
    }
  });

  it('all task statuses are valid for the profile', () => {
    const validStatusKeys = new Set(profile.states.map((s) => s.key));
    for (const task of scenario.tasks) {
      expect(
        validStatusKeys.has(task.status),
        `Task ${task.ref} has status "${task.status}" which is not valid for profile "${profile.id}"`,
      ).toBe(true);
    }
  });

  it('all container instance containerTypes are valid for the profile', () => {
    const validContainerIds = new Set(profile.containers.map((c) => c.id));
    for (const ci of scenario.containerInstances) {
      expect(
        validContainerIds.has(ci.containerType),
        `Container instance "${ci.ref}" has containerType "${ci.containerType}" which is not valid for profile "${profile.id}"`,
      ).toBe(true);
    }
  });

  it('all audit events reference valid task refs', () => {
    const taskRefs = new Set(scenario.tasks.map((t) => t.ref));
    for (const event of scenario.auditEvents) {
      expect(
        taskRefs.has(event.taskRef),
        `Audit event references "${event.taskRef}" which is not defined`,
      ).toBe(true);
    }
  });

  it('all agent locks reference valid task refs', () => {
    if (!scenario.agents?.locks) return;
    const taskRefs = new Set(scenario.tasks.map((t) => t.ref));
    for (const lock of scenario.agents.locks) {
      expect(
        taskRefs.has(lock.taskRef),
        `Agent lock references "${lock.taskRef}" which is not defined`,
      ).toBe(true);
    }
  });

  it('all tasks have required fields', () => {
    for (const task of scenario.tasks) {
      expect(task.ref, `Missing ref`).toBeTruthy();
      expect(task.title, `${task.ref} missing title`).toBeTruthy();
      expect(task.body, `${task.ref} missing body`).toBeTruthy();
      expect(task.status, `${task.ref} missing status`).toBeTruthy();
      // containers can be empty for backlog/cooldown/raw tasks
      expect(task.containers, `${task.ref} missing containers object`).toBeDefined();
    }
  });

  it('memorySeed is non-empty', () => {
    expect(scenario.memorySeed.length).toBeGreaterThan(0);
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
}

// ─── Hydro Governance ───

describe('Hydro Governance Scenario Integrity', () => {
  const scenario = HYDRO_GOVERNANCE;

  it('has correct metadata', () => {
    expect(scenario.id).toBe('hydro-governance');
    expect(scenario.name).toBe('Hydro Governance');
    expect(scenario.description).toBeTruthy();
    expect(scenario.profileId).toBe('hydro');
  });

  // ─── Generic structural tests ───
  describeScenarioStructure(scenario);

  // ─── Hydro-specific structural tests ───

  it('has 4 wave container instances', () => {
    const waves = scenario.containerInstances.filter((c) => c.containerType === 'wave');
    expect(waves).toHaveLength(4);
  });

  it('has 5 parent issues (epics)', () => {
    expect(scenario.parentIssues).toHaveLength(5);
  });

  it('has 20 tasks', () => {
    expect(scenario.tasks).toHaveLength(20);
  });

  // ─── Wave State ───

  it('wave-001-foundation is completed', () => {
    const wave = scenario.containerInstances.find((c) => c.name === 'wave-001-foundation');
    expect(wave?.state).toBe('completed');
  });

  it('wave-002-core is active', () => {
    const wave = scenario.containerInstances.find((c) => c.name === 'wave-002-core');
    expect(wave?.state).toBe('active');
  });

  it('wave-003 and wave-004 are planned', () => {
    const wave3 = scenario.containerInstances.find((c) => c.name === 'wave-003-advanced');
    const wave4 = scenario.containerInstances.find((c) => c.name === 'wave-004-polish');
    expect(wave3?.state).toBe('planned');
    expect(wave4?.state).toBe('planned');
  });

  // ─── Wave 1 — All Done ───

  it('all wave-001 tasks are DONE', () => {
    const wave1Tasks = scenario.tasks.filter((t) => t.containers.wave === 'wave-001-foundation');
    expect(wave1Tasks).toHaveLength(5);
    for (const task of wave1Tasks) {
      expect(task.status).toBe('DONE');
    }
  });

  // ─── Wave 2 — Mixed States ───

  it('wave-002 has 10 tasks with mixed states', () => {
    const wave2Tasks = scenario.tasks.filter((t) => t.containers.wave === 'wave-002-core');
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
    it('Auth epic E3 tasks span wave-002 and wave-003', () => {
      const e3Tasks = scenario.tasks.filter((t) => t.parentRef === 'E3');
      const e3Waves = new Set(e3Tasks.map((t) => t.containers.wave));
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
      const wave1Tasks = scenario.tasks.filter((t) => t.containers.wave === 'wave-001-foundation');
      for (const task of wave1Tasks) {
        expect(task.contextComments).toBeUndefined();
      }
    });
  });

  // ─── Clean Epics ───

  it('all other epics (E1, E2, E4, E5) are within single waves', () => {
    const singleWaveEpics = ['E1', 'E2', 'E4', 'E5'];
    for (const epicRef of singleWaveEpics) {
      const tasks = scenario.tasks.filter((t) => t.parentRef === epicRef);
      const waves = new Set(tasks.map((t) => t.containers.wave));
      expect(waves.size).toBe(1);
    }
  });

  // ─── Audit Events ───

  it('has audit events covering key transitions', () => {
    expect(scenario.auditEvents.length).toBeGreaterThan(20);
    // Verify spread across different task refs
    const taskRefs = new Set(scenario.auditEvents.map((e) => e.taskRef));
    expect(taskRefs.size).toBeGreaterThan(5);
  });

  // ─── Agents ───

  it('has agents with locks', () => {
    expect(scenario.agents).toBeDefined();
    expect(scenario.agents!.agents).toHaveLength(2);
    expect(scenario.agents!.locks).toHaveLength(1);
    expect(scenario.agents!.locks![0]!.taskRef).toBe('T7');
  });
});

// ─── Scrum Sprint Showcase ───

describe('Scrum Sprint Scenario Integrity', () => {
  const scenario = SCRUM_SPRINT;

  it('has correct metadata', () => {
    expect(scenario.id).toBe('scrum-sprint');
    expect(scenario.name).toBe('Scrum Sprint Showcase');
    expect(scenario.description).toBeTruthy();
    expect(scenario.profileId).toBe('scrum');
  });

  // ─── Generic structural tests ───
  describeScenarioStructure(scenario);

  // ─── Scrum-specific structural tests ───

  it('has 2 sprint container instances', () => {
    const sprints = scenario.containerInstances.filter((c) => c.containerType === 'sprint');
    expect(sprints).toHaveLength(2);
  });

  it('has no parent issues (standard Scrum)', () => {
    expect(scenario.parentIssues).toHaveLength(0);
  });

  it('has 15 tasks', () => {
    expect(scenario.tasks).toHaveLength(15);
  });

  // ─── Sprint States ───

  it('Sprint 13 is completed', () => {
    const s13 = scenario.containerInstances.find((c) => c.name === 'Sprint 13');
    expect(s13?.state).toBe('completed');
  });

  it('Sprint 14 is active', () => {
    const s14 = scenario.containerInstances.find((c) => c.name === 'Sprint 14');
    expect(s14?.state).toBe('active');
  });

  // ─── Sprint 13 — All Done (carry-over) ───

  it('all Sprint 13 tasks are DONE', () => {
    const s13Tasks = scenario.tasks.filter((t) => t.containers.sprint === 'Sprint 13');
    expect(s13Tasks).toHaveLength(2);
    for (const task of s13Tasks) {
      expect(task.status).toBe('DONE');
    }
  });

  // ─── Sprint 14 — Mixed States ───

  it('Sprint 14 has 10 tasks with mixed states', () => {
    const s14Tasks = scenario.tasks.filter((t) => t.containers.sprint === 'Sprint 14');
    expect(s14Tasks).toHaveLength(10);

    const statuses = s14Tasks.map((t) => t.status);
    expect(statuses.filter((s) => s === 'DONE')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'IN_PROGRESS')).toHaveLength(2);
    expect(statuses.filter((s) => s === 'IN_REVIEW')).toHaveLength(3);
    expect(statuses.filter((s) => s === 'BLOCKED')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'SPRINT')).toHaveLength(3);
  });

  // ─── Backlog Tasks ───

  it('3 backlog tasks have no sprint assignment', () => {
    const backlogTasks = scenario.tasks.filter((t) => t.status === 'BACKLOG');
    expect(backlogTasks).toHaveLength(3);
    for (const task of backlogTasks) {
      expect(Object.keys(task.containers)).toHaveLength(0);
    }
  });

  // ─── Work Item Types (via labels) ───

  it('all tasks have type labels', () => {
    for (const task of scenario.tasks) {
      expect(task.labels, `${task.ref} should have labels`).toBeDefined();
      expect(task.labels!.length).toBeGreaterThan(0);
      expect(
        task.labels!.some((l) => l.startsWith('type:')),
        `${task.ref} should have a type: label`,
      ).toBe(true);
    }
  });

  it('has all 5 work item types represented', () => {
    const allLabels = scenario.tasks.flatMap((t) => t.labels ?? []);
    const types = new Set(allLabels.filter((l) => l.startsWith('type:')));
    expect(types.has('type:story')).toBe(true);
    expect(types.has('type:bug')).toBe(true);
    expect(types.has('type:spike')).toBe(true);
    expect(types.has('type:tech-debt')).toBe(true);
    expect(types.has('type:chore')).toBe(true);
  });

  // ─── Governance Violations ───

  describe('DoR Violation', () => {
    it('T5 has DOR_VIOLATION governance signal', () => {
      const t5 = scenario.tasks.find((t) => t.ref === 'T5');
      expect(t5?.governanceSignal).toBe('DOR_VIOLATION');
    });

    it('T5 body lacks acceptance criteria section', () => {
      const t5 = scenario.tasks.find((t) => t.ref === 'T5');
      expect(t5?.body).not.toContain('### Acceptance Criteria');
    });
  });

  describe('False Status', () => {
    it('T10 is IN_REVIEW with FALSE_STATUS signal and no seedPR', () => {
      const t10 = scenario.tasks.find((t) => t.ref === 'T10');
      expect(t10?.status).toBe('IN_REVIEW');
      expect(t10?.governanceSignal).toBe('FALSE_STATUS');
      expect(t10?.seedPR).toBeUndefined();
    });
  });

  describe('Review Bottleneck', () => {
    it('T8 is IN_REVIEW with REVIEW_BOTTLENECK signal and seedPR', () => {
      const t8 = scenario.tasks.find((t) => t.ref === 'T8');
      expect(t8?.status).toBe('IN_REVIEW');
      expect(t8?.governanceSignal).toBe('REVIEW_BOTTLENECK');
      expect(t8?.seedPR).toBeDefined();
    });
  });

  describe('Cascade Blocker', () => {
    it('T11 is BLOCKED by T3', () => {
      const t11 = scenario.tasks.find((t) => t.ref === 'T11');
      expect(t11?.status).toBe('BLOCKED');
      expect(t11?.dependencyRefs).toContain('T3');
    });

    it('T3 is IN_PROGRESS (the root cause)', () => {
      const t3 = scenario.tasks.find((t) => t.ref === 'T3');
      expect(t3?.status).toBe('IN_PROGRESS');
    });
  });

  describe('Scope Creep Risk', () => {
    it('T15 has SCOPE_CREEP_RISK signal in backlog', () => {
      const t15 = scenario.tasks.find((t) => t.ref === 'T15');
      expect(t15?.status).toBe('BACKLOG');
      expect(t15?.governanceSignal).toBe('SCOPE_CREEP_RISK');
      expect(t15?.riskLevel).toBe('CRITICAL');
    });
  });

  // ─── Audit Events ───

  it('has audit events for Sprint 13 and Sprint 14 tasks', () => {
    expect(scenario.auditEvents.length).toBeGreaterThan(15);
    const taskRefs = new Set(scenario.auditEvents.map((e) => e.taskRef));
    // Sprint 13
    expect(taskRefs.has('T1')).toBe(true);
    expect(taskRefs.has('T2')).toBe(true);
    // Sprint 14
    expect(taskRefs.has('T3')).toBe(true);
    expect(taskRefs.has('T11')).toBe(true);
  });

  // ─── Agents ───

  it('has agents with alpha locked on T3', () => {
    expect(scenario.agents).toBeDefined();
    expect(scenario.agents!.agents).toHaveLength(2);
    expect(scenario.agents!.locks).toHaveLength(1);
    expect(scenario.agents!.locks![0]!.agentId).toBe('agent-alpha');
    expect(scenario.agents!.locks![0]!.taskRef).toBe('T3');
  });
});

// ─── Shape Up Cycle Showcase ───

describe('Shape Up Cycle Scenario Integrity', () => {
  const scenario = SHAPE_UP_CYCLE;

  it('has correct metadata', () => {
    expect(scenario.id).toBe('shape-up-cycle');
    expect(scenario.name).toBe('Shape Up Cycle Showcase');
    expect(scenario.description).toBeTruthy();
    expect(scenario.profileId).toBe('shape-up');
  });

  // ─── Generic structural tests ───
  describeScenarioStructure(scenario);

  // ─── Shape Up specific structural tests ───

  it('has 2 cycle container instances', () => {
    const cycles = scenario.containerInstances.filter((c) => c.containerType === 'cycle');
    expect(cycles).toHaveLength(2);
  });

  it('has 3 bet container instances', () => {
    const bets = scenario.containerInstances.filter((c) => c.containerType === 'bet');
    expect(bets).toHaveLength(3);
  });

  it('has 11 scope container instances', () => {
    const scopes = scenario.containerInstances.filter((c) => c.containerType === 'scope');
    expect(scopes).toHaveLength(11);
  });

  it('has 3 parent issues (bets)', () => {
    expect(scenario.parentIssues).toHaveLength(3);
  });

  it('has 16 tasks', () => {
    expect(scenario.tasks).toHaveLength(16);
  });

  // ─── Cycle States ───

  it('cycle-002-mobile is completed', () => {
    const c2 = scenario.containerInstances.find((c) => c.name === 'cycle-002-mobile');
    expect(c2?.state).toBe('completed');
  });

  it('cycle-003-notifications is active with startDate metadata', () => {
    const c3 = scenario.containerInstances.find((c) => c.name === 'cycle-003-notifications');
    expect(c3?.state).toBe('active');
    expect(c3?.metadata).toBeDefined();
    expect(c3?.metadata?.startDate).toBeTruthy();
  });

  // ─── Bet States ───

  it('bet-push-notifications and bet-search-redesign are active', () => {
    const b1 = scenario.containerInstances.find((c) => c.name === 'bet-push-notifications');
    const b2 = scenario.containerInstances.find((c) => c.name === 'bet-search-redesign');
    expect(b1?.state).toBe('active');
    expect(b2?.state).toBe('active');
  });

  it('bet-onboarding-flow is killed', () => {
    const b3 = scenario.containerInstances.find((c) => c.name === 'bet-onboarding-flow');
    expect(b3?.state).toBe('killed');
  });

  // ─── Push Notifications Bet (on track) ───

  it('push notifications bet has 3 tasks', () => {
    const pushTasks = scenario.tasks.filter((t) => t.parentRef === 'B1' && !t.governanceSignal?.includes('INTEGRITY'));
    expect(pushTasks).toHaveLength(3);
  });

  it('T1 iOS push is SHIPPED', () => {
    const t1 = scenario.tasks.find((t) => t.ref === 'T1');
    expect(t1?.status).toBe('SHIPPED');
  });

  it('T2 Android push is in QA with seedPR', () => {
    const t2 = scenario.tasks.find((t) => t.ref === 'T2');
    expect(t2?.status).toBe('QA');
    expect(t2?.seedPR).toBeDefined();
  });

  // ─── Search Redesign Bet (at risk) ───

  it('search redesign bet has 7 tasks (scope creep from 3)', () => {
    const searchTasks = scenario.tasks.filter((t) => t.parentRef === 'B2');
    expect(searchTasks).toHaveLength(7);
  });

  it('search bet has 6 scope container instances (doubled from 3)', () => {
    const searchScopes = scenario.containerInstances.filter((c) =>
      c.containerType === 'scope' && c.name.startsWith('scope-search-'),
    );
    expect(searchScopes).toHaveLength(6);
  });

  // ─── Killed Bet (correct behavior) ───

  it('onboarding bet tasks are KILLED', () => {
    const t11 = scenario.tasks.find((t) => t.ref === 'T11');
    const t12 = scenario.tasks.find((t) => t.ref === 'T12');
    expect(t11?.status).toBe('KILLED');
    expect(t12?.status).toBe('KILLED');
  });

  it('killed bet scopes are killed', () => {
    const sc10 = scenario.containerInstances.find((c) => c.name === 'scope-welcome-screen');
    const sc11 = scenario.containerInstances.find((c) => c.name === 'scope-tutorial-flow');
    expect(sc10?.state).toBe('killed');
    expect(sc11?.state).toBe('killed');
  });

  // ─── Cooldown / Raw Ideas ───

  it('3 cooldown tasks have no container assignments', () => {
    const cooldownTasks = scenario.tasks.filter((t) => ['RAW', 'SHAPED'].includes(t.status));
    expect(cooldownTasks).toHaveLength(3);
    for (const task of cooldownTasks) {
      expect(Object.keys(task.containers)).toHaveLength(0);
    }
  });

  // ─── Governance Violations ───

  describe('Bet-Cycle Integrity Violation', () => {
    it('T13 is in bet-push-notifications but assigned to wrong cycle', () => {
      const t13 = scenario.tasks.find((t) => t.ref === 'T13');
      expect(t13?.containers.cycle).toBe('cycle-002-mobile');
      expect(t13?.containers.bet).toBe('#B1');
      expect(t13?.governanceSignal).toBe('INTEGRITY_VIOLATION');
    });

    it('other B1 tasks are in cycle-003-notifications (correct)', () => {
      const b1Tasks = scenario.tasks.filter(
        (t) => t.parentRef === 'B1' && t.ref !== 'T13',
      );
      for (const task of b1Tasks) {
        expect(task.containers.cycle).toBe('cycle-003-notifications');
      }
    });
  });

  describe('Scope Creep', () => {
    it('T9 has SCOPE_CREEP governance signal', () => {
      const t9 = scenario.tasks.find((t) => t.ref === 'T9');
      expect(t9?.governanceSignal).toBe('SCOPE_CREEP');
    });
  });

  describe('False Status', () => {
    it('T8 is in QA with FALSE_STATUS signal and no seedPR', () => {
      const t8 = scenario.tasks.find((t) => t.ref === 'T8');
      expect(t8?.status).toBe('QA');
      expect(t8?.governanceSignal).toBe('FALSE_STATUS');
      expect(t8?.seedPR).toBeUndefined();
    });
  });

  describe('Blocked Dependency', () => {
    it('T10 is BLOCKED by T5', () => {
      const t10 = scenario.tasks.find((t) => t.ref === 'T10');
      expect(t10?.status).toBe('BLOCKED');
      expect(t10?.dependencyRefs).toContain('T5');
    });
  });

  // ─── Audit Events ───

  it('has audit events spanning full lifecycle', () => {
    expect(scenario.auditEvents.length).toBeGreaterThan(30);
    const transitions = new Set(scenario.auditEvents.map((e) => e.transition));
    expect(transitions.has('shape')).toBe(true);
    expect(transitions.has('bet')).toBe(true);
    expect(transitions.has('start')).toBe(true);
    expect(transitions.has('ship')).toBe(true);
    expect(transitions.has('kill')).toBe(true);
  });

  it('killed tasks have kill audit events', () => {
    const killEvents = scenario.auditEvents.filter((e) => e.transition === 'kill');
    expect(killEvents).toHaveLength(2);
    const killedRefs = new Set(killEvents.map((e) => e.taskRef));
    expect(killedRefs.has('T11')).toBe(true);
    expect(killedRefs.has('T12')).toBe(true);
  });

  // ─── Agents ───

  it('has agents with alpha locked on T5', () => {
    expect(scenario.agents).toBeDefined();
    expect(scenario.agents!.agents).toHaveLength(2);
    expect(scenario.agents!.locks).toHaveLength(1);
    expect(scenario.agents!.locks![0]!.agentId).toBe('agent-alpha');
    expect(scenario.agents!.locks![0]!.taskRef).toBe('T5');
  });
});
