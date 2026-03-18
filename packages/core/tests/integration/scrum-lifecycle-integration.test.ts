/**
 * Scrum Lifecycle Integration Test — Profile-Driven Pipeline Verification
 *
 * Verifies the complete data flow for the Scrum methodology profile:
 *   transition events → audit persistence → analytics computation → compliance scoring
 *
 * Scrum-specific characteristics verified:
 *   - 6 states: BACKLOG, SPRINT, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED
 *   - 4-step lifecycle: plan → start → review → approve
 *   - Sprint singularity (only one active sprint)
 *   - No integrity rules (integrityRules: [])
 *   - Type-scoped pipelines: story, bug, spike, chore, tech-debt
 *   - Compliance weights: brePassRate=0.40, qualityGates=0.25, processAdherence=0.25, flowEfficiency=0.10
 *   - Unblock returns to SPRINT (not READY_FOR_DEV like Hydro)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InMemoryEventBus } from '../../src/shared/events/in-memory-event-bus.js';
import { AuditService } from '../../src/domains/audit/audit-service.js';
import { JsonlAuditStore } from '../../src/domains/audit/audit-store.js';
import { AnalyticsService } from '../../src/domains/analytics/analytics-service.js';
import { ComplianceService } from '../../src/domains/compliance/compliance-service.js';
import { MethodologyConfig } from '../../src/config/methodology-config.js';
import { resolveWorkItemType } from '../../src/profiles/work-item-resolver.js';
import type { TaskTransitionEvent, ContainerAssignmentEvent } from '../../src/shared/events/types.js';
import type { IContainerService } from '../../src/container/interfaces.js';
import type { AuditValidationResult } from '../../src/container/interfaces.js';
import { TestLogger } from '../helpers/test-logger.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';

// ─── Helpers ───

const DAY = 24 * 3600_000;
const HOUR = 3600_000;

function timestamp(base: number, offsetMs: number): string {
  return new Date(base + offsetMs).toISOString();
}

function transitionEvent(
  issueNumber: number,
  transition: string,
  fromStatus: string,
  toStatus: string,
  ts: string,
  actorId: string,
  validationResult?: AuditValidationResult,
): TaskTransitionEvent {
  return {
    type: 'task.transition',
    issueNumber,
    transition,
    fromStatus,
    toStatus,
    timestamp: ts,
    sessionId: 'session-scrum-lifecycle',
    actor: { type: 'ai-agent', id: actorId, name: `Agent ${actorId}` },
    dryRun: false,
    validationResult,
  };
}

function containerAssignment(
  issueNumber: number,
  containerName: string,
  integrityMaintained: boolean,
  ts: string,
  actorId: string,
): ContainerAssignmentEvent {
  return {
    type: 'container.assignment',
    issueNumber,
    containerName,
    integrityMaintained,
    timestamp: ts,
    sessionId: 'session-scrum-lifecycle',
    actor: { type: 'ai-agent', id: actorId, name: `Agent ${actorId}` },
  };
}

const PASSING_VALIDATION: AuditValidationResult = {
  stepsRun: 4,
  stepsPassed: 4,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'SourceStatusValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'DependencyValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ContainerAssignmentValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const FAILING_VALIDATION: AuditValidationResult = {
  stepsRun: 4,
  stepsPassed: 2,
  stepsFailed: 2,
  stepsWarned: 0,
  details: [
    { stepName: 'SourceStatusValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'DependencyValidation', passed: false, severity: 'error', message: 'dependency not met' },
    { stepName: 'ContainerAssignmentValidation', passed: false, severity: 'error', message: 'not assigned to sprint' },
  ],
};

const APPROVE_WITH_QUALITY_GATES: AuditValidationResult = {
  stepsRun: 4,
  stepsPassed: 4,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ApprovalRequirementValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'SubtaskCompletionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'PRReviewValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const APPROVE_FAILING_QUALITY_GATE: AuditValidationResult = {
  stepsRun: 4,
  stepsPassed: 3,
  stepsFailed: 1,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ApprovalRequirementValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'SubtaskCompletionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'PRReviewValidation', passed: false, severity: 'error', message: 'insufficient approvals' },
  ],
};

// ─── Tests ───

describe('Scrum Lifecycle Integration', () => {
  let tmpDir: string;
  let eventBus: InMemoryEventBus;
  let auditService: AuditService;
  let analyticsService: AnalyticsService;
  let complianceService: ComplianceService;
  let logger: TestLogger;

  // Timeline: Day 0 = sprint start
  const DAY_0 = new Date('2024-06-01T09:00:00Z').getTime();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scrum-lifecycle-'));
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    logger = new TestLogger();
    eventBus = new InMemoryEventBus();

    const auditStore = new JsonlAuditStore(tmpDir, logger);
    auditService = new AuditService(auditStore, eventBus, logger);

    const containerService = createMockContainerService([50, 51, 52, 53, 54, 55]);
    analyticsService = new AnalyticsService(auditService, containerService, eventBus, logger, SCRUM_PROFILE);

    complianceService = new ComplianceService(auditService, analyticsService, eventBus, logger, SCRUM_PROFILE);
  });

  afterEach(async () => {
    auditService.dispose();
    analyticsService.dispose();
    complianceService.dispose();
    eventBus.removeAllListeners();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Test 1: Connected Pipeline — Happy Path ───

  it('plan → start → review → approve flows through audit → analytics → compliance', async () => {
    // Task 50: full Scrum lifecycle (plan → start → review → approve)
    const events = [
      transitionEvent(50, 'plan', 'BACKLOG', 'SPRINT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'start', 'SPRINT', 'IN_PROGRESS', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 1 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 1.5 * DAY), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Layer 1: Audit captured all 4 transitions
    const auditResult = await auditService.queryEvents({ issueNumber: 50 });
    expect(auditResult.events).toHaveLength(4);
    expect(auditResult.events.map((e) => (e.event as Record<string, unknown>).transition))
      .toEqual(['plan', 'start', 'review', 'approve']);

    // Layer 2: Analytics computed cycle time (IN_PROGRESS → DONE)
    const cycleTime = await analyticsService.getTaskCycleTime(50);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.issueNumber).toBe(50);
    expect(cycleTime!.startedAt).toBe(timestamp(DAY_0, 2 * HOUR));
    expect(cycleTime!.completedAt).toBe(timestamp(DAY_0, 1.5 * DAY));
    // Cycle time: 2h → 36h = 34h
    expect(cycleTime!.cycleTimeHours).toBeCloseTo(34, 0);
    expect(cycleTime!.blockCount).toBe(0);
    expect(cycleTime!.blockingTimeHours).toBe(0);

    // Layer 3: Compliance — 4/4 lifecycle steps = 100% process adherence
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.score).toBeGreaterThan(0);
    expect(compliance.grade).toBeDefined();
    expect(compliance.categories.brePassRate.score).toBe(100);
    expect(compliance.categories.qualityGates.score).toBe(100);
    expect(compliance.categories.processAdherence.score).toBe(100);
    expect(compliance.categories.flowEfficiency.score).toBe(100);
    expect(compliance.metadata.totalTransitions).toBe(4);
    expect(compliance.metadata.totalTasks).toBe(1);
  });

  // ─── Test 2: Type-Scoped Pipeline Resolution — plan ───

  it('plan pipeline resolves type-scoped steps for story, bug, and spike', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);

    // Story: must have acceptance criteria + effort estimation
    const storySteps = config.getStepsForTransition('plan', 'story');
    expect(storySteps).toContain('AcceptanceCriteriaValidation');
    expect(storySteps).toContain('EffortEstimationValidation');
    expect(storySteps).toContain('SourceStatusValidation:BACKLOG');
    expect(storySteps).toContain('StatusTransitionValidation:SPRINT');

    // Bug: must have BaseTaskFieldsValidation (repro steps), NO AcceptanceCriteriaValidation
    const bugSteps = config.getStepsForTransition('plan', 'bug');
    expect(bugSteps).toContain('BaseTaskFieldsValidation');
    expect(bugSteps).not.toContain('AcceptanceCriteriaValidation');

    // Spike: minimal — just source status + transition
    const spikeSteps = config.getStepsForTransition('plan', 'spike');
    expect(spikeSteps).toEqual([
      'SourceStatusValidation:BACKLOG',
      'StatusTransitionValidation:SPRINT',
    ]);
  });

  // ─── Test 3: Type-Scoped Pipeline Resolution — approve ───

  it('approve pipeline resolves type-scoped steps for spike and tech-debt', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);

    // Spike: relaxed DoD — only StatusTransitionValidation (no PR approval, no subtask completion)
    const spikeSteps = config.getStepsForTransition('approve', 'spike');
    expect(spikeSteps).toEqual(['StatusTransitionValidation:DONE']);
    expect(spikeSteps).not.toContain('ApprovalRequirementValidation');
    expect(spikeSteps).not.toContain('SubtaskCompletionValidation');

    // Tech-debt: includes PRReviewValidation:2 (architectural review, 2 reviewers)
    const techDebtSteps = config.getStepsForTransition('approve', 'tech-debt');
    expect(techDebtSteps).toContain('PRReviewValidation:2');
    expect(techDebtSteps).toContain('ApprovalRequirementValidation');
  });

  // ─── Test 4: Type-Scoped Pipeline Resolution — start ───

  it('start pipeline: bugs skip DependencyValidation, default type has it', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);

    // Bug start: NO DependencyValidation
    const bugSteps = config.getStepsForTransition('start', 'bug');
    expect(bugSteps).not.toContain('DependencyValidation');
    expect(bugSteps).toContain('StatusTransitionValidation:IN_PROGRESS');
    expect(bugSteps).toContain('ContainerAssignmentValidation:sprint');

    // Default type start: HAS DependencyValidation
    const defaultSteps = config.getStepsForTransition('start');
    expect(defaultSteps).toContain('DependencyValidation');
    expect(defaultSteps).toContain('StatusTransitionValidation:IN_PROGRESS');
  });

  // ─── Test 5: Work Item Type Resolution from Labels ───

  it('resolves work item types from labels using type: prefix', () => {
    // type:bug label → 'bug'
    expect(resolveWorkItemType(['type:bug', 'priority:high'], SCRUM_PROFILE)).toBe('bug');

    // No type label → default 'story'
    expect(resolveWorkItemType(['priority:high'], SCRUM_PROFILE)).toBe('story');

    // Empty labels → default 'story'
    expect(resolveWorkItemType([], SCRUM_PROFILE)).toBe('story');

    // type:spike label → 'spike'
    expect(resolveWorkItemType(['type:spike'], SCRUM_PROFILE)).toBe('spike');

    // Unknown type falls through to default 'story'
    expect(resolveWorkItemType(['type:unknown'], SCRUM_PROFILE)).toBe('story');
  });

  // ─── Test 6: Sprint Singularity ───

  it('start pipeline includes ContainerSingularityValidation:sprint', () => {
    const config = MethodologyConfig.fromProfile(SCRUM_PROFILE);

    const startSteps = config.getStepsForTransition('start');
    expect(startSteps).toContain('ContainerSingularityValidation:sprint');
  });

  // ─── Test 7: No Container Integrity ───

  it('Scrum has no integrity rules — containerIntegrity weight is 0 and contributes nothing', async () => {
    // Verify integrityRules is empty
    expect(SCRUM_PROFILE.integrityRules).toEqual([]);

    // Verify compliance weights have no containerIntegrity key
    expect(SCRUM_PROFILE.compliance.weights).not.toHaveProperty('containerIntegrity');

    // Emit container assignment events to verify zero contribution
    const events = [
      containerAssignment(50, 'Sprint 1', true, timestamp(DAY_0, 0), 'agent-alpha'),
      containerAssignment(51, 'Sprint 1', false, timestamp(DAY_0, 1 * HOUR), 'agent-alpha'), // violation
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // containerIntegrity should have weight 0 (not present in Scrum weights)
    expect(compliance.categories.containerIntegrity.weight).toBe(0);
    // With weight 0, contribution should be 0 regardless of score
    expect(compliance.categories.containerIntegrity.contribution).toBe(0);
  });

  // ─── Test 8: Block/Unblock — Scrum Unblocks to SPRINT ───

  it('block/unblock cycle: IN_PROGRESS → BLOCKED → SPRINT with blocking time tracked', async () => {
    // Verify from profile: unblock goes to SPRINT (not READY_FOR_DEV like Hydro)
    const unblockTransition = SCRUM_PROFILE.transitions.find((t) => t.action === 'unblock');
    expect(unblockTransition).toBeDefined();
    expect(unblockTransition!.to).toBe('SPRINT');

    // Full cycle: plan → start → block → unblock → start → review → approve
    const events = [
      transitionEvent(50, 'plan', 'BACKLOG', 'SPRINT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'start', 'SPRINT', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'block', 'IN_PROGRESS', 'BLOCKED', timestamp(DAY_0, 3 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'unblock', 'BLOCKED', 'SPRINT', timestamp(DAY_0, 9 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'start', 'SPRINT', 'IN_PROGRESS', timestamp(DAY_0, 9 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 15 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 18 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Analytics: 6h blocked (3h → 9h)
    const cycleTime = await analyticsService.getTaskCycleTime(50);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.blockCount).toBe(1);
    expect(cycleTime!.blockingTimeHours).toBe(6);

    // Flow efficiency should reflect the blocking
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.flowEfficiency.score).toBeLessThan(100);
  });

  // ─── Test 9: Compliance Weights ───

  it('Scrum compliance weights sum to 1.0 with correct per-category values', () => {
    const weights = SCRUM_PROFILE.compliance.weights;

    // Verify individual weights
    expect(weights.brePassRate).toBe(0.40);
    expect(weights.qualityGates).toBe(0.25);
    expect(weights.processAdherence).toBe(0.25);
    expect(weights.flowEfficiency).toBe(0.10);

    // containerIntegrity should be absent (not 0, just not present)
    expect(weights).not.toHaveProperty('containerIntegrity');

    // Weights sum to 1.0
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  // ─── Test 10: Process Adherence Recommendation Text ───

  it('process adherence recommendation shows Scrum lifecycle, not Hydro lifecycle', async () => {
    // Task 50: full lifecycle = 100% adherence
    const task50Events = [
      transitionEvent(50, 'plan', 'BACKLOG', 'SPRINT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'start', 'SPRINT', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(50, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 10 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    // Task 51: skipped plan and start (2/4 steps = 50%) → drags average below 90
    const task51Events = [
      transitionEvent(51, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 6 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(51, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 8 * HOUR), 'agent-beta', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of [...task50Events, ...task51Events]) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 15));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // Process adherence: (100% + 50%) / 2 = 75% — below 90 threshold
    expect(compliance.categories.processAdherence.score).toBe(75);

    // Should have recommendation about lifecycle steps
    const lifecycleRec = compliance.recommendations.find((r) =>
      r.toLowerCase().includes('lifecycle') || r.toLowerCase().includes('step'),
    );
    expect(lifecycleRec).toBeDefined();

    // Recommendation should mention Scrum lifecycle (plan → start → review → approve)
    expect(lifecycleRec).toContain('plan');
    expect(lifecycleRec).toContain('start');
    expect(lifecycleRec).toContain('review');
    expect(lifecycleRec).toContain('approve');

    // Should NOT mention Hydro-specific steps
    expect(lifecycleRec).not.toContain('refine');
    expect(lifecycleRec).not.toContain('ready');
  });
});

// ─── Mock ───

function createMockContainerService(taskNumbers: number[]): IContainerService {
  return {
    getContainerStatus: async () => ({
      name: 'Sprint 1',
      status: 'active',
      tasks: taskNumbers.map((n) => ({ number: n, title: `Task ${n}`, status: 'IN_PROGRESS' })),
      totalTasks: taskNumbers.length,
      completedTasks: 0,
      progress: 0,
    }),
    listContainers: async () => [],
    createContainer: async () => ({ success: true }),
    assignTaskToContainer: async () => ({ success: true }),
    validateContainerCompletion: async () => ({ complete: false, blockers: [] }),
  } as unknown as IContainerService;
}
