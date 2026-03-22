/**
 * Scenario Integrity Tests (v3) — verify that the ScenarioBuilder produces
 * valid SandboxScenario output from each ScenarioConfig + a mock ingestion result.
 *
 * Tests the ALGORITHMIC output: container assignments, states, violations,
 * audit events, context comments, narrative — all computed, not hardcoded.
 */

import { describe, it, expect } from 'vitest';
import { HYDRO_GOVERNANCE } from '../../../src/domains/sandbox/scenarios/hydro-governance.js';
import { SCRUM_SPRINT } from '../../../src/domains/sandbox/scenarios/scrum-sprint.js';
import { SHAPE_UP_CYCLE } from '../../../src/domains/sandbox/scenarios/shape-up-cycle.js';
import { ScenarioBuilder } from '../../../src/domains/sandbox/scenario-builder.js';
import { ProfileRegistry } from '../../../src/profiles/registry.js';
import { parseSpec } from '../../../src/domains/ingestion/spec-parser.js';
import { mapSpec } from '../../../src/domains/ingestion/spec-mapper.js';
import type { ScenarioConfig, SandboxScenario } from '../../../src/domains/sandbox/types.js';
import type { IngestSpecResult } from '../../../src/domains/ingestion/types.js';

/** Create a mock IngestSpecResult from a technical spec + profile */
function mockIngestion(config: ScenarioConfig): IngestSpecResult {
  const parsed = parseSpec(config.technicalSpecContent);
  const profile = ProfileRegistry.getBuiltin(config.profileId);
  const mapped = mapSpec(parsed, profile);

  let issueCounter = 100;
  const groupIssues = mapped.groupIssues.map((g) => ({
    ref: g.ref,
    issueNumber: issueCounter++,
    title: g.title,
    url: `https://github.com/test/repo/issues/${issueCounter - 1}`,
  }));

  const tasks = mapped.tasks.map((t) => ({
    ref: t.ref,
    issueNumber: issueCounter++,
    title: t.request.title,
    url: `https://github.com/test/repo/issues/${issueCounter - 1}`,
    dependsOn: t.dependsOn,
    groupRef: t.groupRef,
  }));

  return {
    success: true,
    parsed: {
      projectName: parsed.project.name,
      groupCount: parsed.groups.length,
      taskCount: mapped.tasks.length,
      parseErrors: [],
    },
    created: {
      groupIssues,
      tasks,
      subIssueRelationships: tasks.length,
      totalIssues: groupIssues.length + tasks.length,
    },
    failed: [],
    warnings: [],
    suggestions: [],
  };
}

/** Build a scenario from config using the algorithmic builder */
function buildScenario(config: ScenarioConfig): SandboxScenario {
  const profile = ProfileRegistry.getBuiltin(config.profileId);
  const ingestion = mockIngestion(config);
  return ScenarioBuilder.build(ingestion, profile, config);
}

/** Generic structural validation for any built scenario */
function describeBuiltScenarioStructure(config: ScenarioConfig) {
  const profile = ProfileRegistry.getBuiltin(config.profileId);
  const scenario = buildScenario(config);
  const specRefs = new Set(mockIngestion(config).created.tasks.map((t) => t.ref));

  it('has valid profileId', () => {
    expect(() => ProfileRegistry.getBuiltin(scenario.profileId)).not.toThrow();
  });

  it('technical spec parses without errors', () => {
    const parsed = parseSpec(scenario.technicalSpecContent);
    const fatalErrors = parsed.errors.filter((e) => e.severity === 'error');
    expect(fatalErrors).toHaveLength(0);
  });

  it('has container assignments for tasks', () => {
    expect(Object.keys(scenario.containerAssignments).length).toBeGreaterThan(0);
  });

  it('all container assignment refs exist in spec', () => {
    for (const ref of Object.keys(scenario.containerAssignments)) {
      expect(specRefs.has(ref), `Assignment ref '${ref}' not in spec`).toBe(true);
    }
  });

  it('has task states', () => {
    expect(Object.keys(scenario.taskStates).length).toBeGreaterThan(0);
  });

  it('all task state refs exist in spec', () => {
    for (const ref of Object.keys(scenario.taskStates)) {
      expect(specRefs.has(ref), `State ref '${ref}' not in spec`).toBe(true);
    }
  });

  it('all task state values are valid for the profile', () => {
    const validKeys = new Set(profile.states.map((s) => s.key));
    for (const [ref, state] of Object.entries(scenario.taskStates)) {
      expect(validKeys.has(state), `Task ${ref} has invalid state '${state}'`).toBe(true);
    }
  });

  it('has at least one violation', () => {
    expect(scenario.violations.length).toBeGreaterThan(0);
  });

  it('all violation refs exist in spec', () => {
    for (const v of scenario.violations) {
      expect(specRefs.has(v.taskRef), `Violation ref '${v.taskRef}' not in spec`).toBe(true);
    }
  });

  it('has audit events', () => {
    expect(scenario.auditEvents.length).toBeGreaterThan(0);
  });

  it('all audit event refs exist in spec', () => {
    for (const e of scenario.auditEvents) {
      expect(specRefs.has(e.taskRef), `Audit ref '${e.taskRef}' not in spec`).toBe(true);
    }
  });

  it('has agents', () => {
    expect(scenario.agents?.agents.length).toBeGreaterThan(0);
  });

  it('has context comments', () => {
    expect(Object.keys(scenario.contextComments).length).toBeGreaterThan(0);
  });

  it('all context comment refs exist in spec', () => {
    for (const ref of Object.keys(scenario.contextComments)) {
      expect(specRefs.has(ref), `Comment ref '${ref}' not in spec`).toBe(true);
    }
  });

  it('has narrative with all required fields', () => {
    expect(scenario.narrative.setup).toBeTruthy();
    expect(scenario.narrative.tension).toBeTruthy();
    expect(Object.keys(scenario.narrative.violationContext).length).toBeGreaterThan(0);
    expect(scenario.narrative.expectedFindings.length).toBeGreaterThan(0);
    expect(scenario.narrative.resolution).toBeTruthy();
  });

  it('has non-empty memory seed', () => {
    expect(scenario.memorySeed.length).toBeGreaterThan(0);
  });

  it('container instances are non-empty', () => {
    expect(scenario.containerInstances.length).toBeGreaterThan(0);
  });

  it('has a FALSE_STATUS violation', () => {
    expect(scenario.violations.some((v) => v.type === 'FALSE_STATUS')).toBe(true);
  });

  it('has a cascade blocker (task in active state)', () => {
    const activeStates = new Set(profile.semantics.activeStates);
    const hasActive = Object.values(scenario.taskStates).some((s) => activeStates.has(s));
    expect(hasActive).toBe(true);
  });

  it('has blocked tasks', () => {
    const blockedStates = new Set(profile.semantics.blockedStates);
    const hasBlocked = Object.values(scenario.taskStates).some((s) => blockedStates.has(s));
    expect(hasBlocked).toBe(true);
  });

  it('has completed tasks', () => {
    const terminalStates = new Set(profile.semantics.terminalStates);
    const hasTerminal = Object.values(scenario.taskStates).some((s) => terminalStates.has(s));
    expect(hasTerminal).toBe(true);
  });
}

// ─── Hydro Governance ───

describe('Hydro Governance (Built)', () => {
  it('has correct config metadata', () => {
    expect(HYDRO_GOVERNANCE.id).toBe('hydro-governance');
    expect(HYDRO_GOVERNANCE.profileId).toBe('hydro');
  });

  it('has 4 wave execution containers', () => {
    expect(HYDRO_GOVERNANCE.executionContainers).toHaveLength(4);
    expect(HYDRO_GOVERNANCE.executionContainers.every((c) => c.containerType === 'wave')).toBe(true);
  });

  describe('Built scenario structure', () => {
    describeBuiltScenarioStructure(HYDRO_GOVERNANCE);
  });

  it('builder produces INTEGRITY_VIOLATION for Hydro (epic-wave integrity)', () => {
    const scenario = buildScenario(HYDRO_GOVERNANCE);
    expect(scenario.violations.some((v) => v.type === 'INTEGRITY_VIOLATION')).toBe(true);
  });

  it('builder assigns tasks across multiple waves', () => {
    const scenario = buildScenario(HYDRO_GOVERNANCE);
    const waveValues = new Set(
      Object.values(scenario.containerAssignments)
        .map((a) => a.wave)
        .filter(Boolean),
    );
    expect(waveValues.size).toBeGreaterThanOrEqual(2);
  });
});

// ─── Scrum Sprint ───

describe('Scrum Sprint (Built)', () => {
  it('has correct config metadata', () => {
    expect(SCRUM_SPRINT.id).toBe('scrum-sprint');
    expect(SCRUM_SPRINT.profileId).toBe('scrum');
  });

  it('has 2 sprint execution containers', () => {
    expect(SCRUM_SPRINT.executionContainers).toHaveLength(2);
    expect(SCRUM_SPRINT.executionContainers.every((c) => c.containerType === 'sprint')).toBe(true);
  });

  describe('Built scenario structure', () => {
    describeBuiltScenarioStructure(SCRUM_SPRINT);
  });

  it('builder assigns tasks to sprints', () => {
    const scenario = buildScenario(SCRUM_SPRINT);
    const hasSprintAssignments = Object.values(scenario.containerAssignments).some((a) => a.sprint);
    expect(hasSprintAssignments).toBe(true);
  });
});

// ─── Shape Up Cycle ───

describe('Shape Up Cycle (Built)', () => {
  it('has correct config metadata', () => {
    expect(SHAPE_UP_CYCLE.id).toBe('shape-up-cycle');
    expect(SHAPE_UP_CYCLE.profileId).toBe('shape-up');
  });

  it('has 2 cycle execution containers', () => {
    const cycles = SHAPE_UP_CYCLE.executionContainers.filter((c) => c.containerType === 'cycle');
    expect(cycles).toHaveLength(2);
  });

  it('has grouping containers (bets)', () => {
    expect(SHAPE_UP_CYCLE.groupingContainers).toHaveLength(3);
  });

  describe('Built scenario structure', () => {
    describeBuiltScenarioStructure(SHAPE_UP_CYCLE);
  });

  it('builder produces killed tasks for killed capability', () => {
    const scenario = buildScenario(SHAPE_UP_CYCLE);
    const killedStates = Object.entries(scenario.taskStates).filter(([_ref, state]) => state === 'KILLED');
    expect(killedStates.length).toBeGreaterThan(0);
  });

  it('builder assigns bet containers', () => {
    const scenario = buildScenario(SHAPE_UP_CYCLE);
    const hasBets = Object.values(scenario.containerAssignments).some((a) => a.bet);
    expect(hasBets).toBe(true);
  });

  it('has cycle with startDate metadata', () => {
    const activeCycle = SHAPE_UP_CYCLE.executionContainers.find((c) => c.state === 'active');
    expect(activeCycle?.metadata?.startDate).toBeTruthy();
  });

  it('builder creates cooldown tasks', () => {
    const scenario = buildScenario(SHAPE_UP_CYCLE);
    const initialState = 'RAW';
    const cooldownTasks = Object.entries(scenario.taskStates).filter(([_ref, state]) => state === initialState);
    expect(cooldownTasks.length).toBeGreaterThan(0);
  });
});
