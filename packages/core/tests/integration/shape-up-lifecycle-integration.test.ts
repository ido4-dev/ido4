/**
 * Shape Up Lifecycle Integration Test — The Connected Pipeline
 *
 * Verifies the complete data flow for the Shape Up methodology profile:
 *   transition events → audit persistence → analytics computation → compliance scoring
 *
 * Simulates Shape Up workflows:
 *   - Full lifecycle: shape → bet → start → review → ship
 *   - Circuit breaker path: shape → bet → start → kill
 *   - Kill from QA, kill from BLOCKED
 *   - Block/unblock cycles
 *   - Bet-cycle integrity via container assignments
 *   - Multi-agent actor breakdown
 *
 * Shape Up states: RAW, SHAPED, BET, BUILDING, QA, SHIPPED, KILLED, BLOCKED
 * Shape Up transitions: shape, bet, start, review, ship, block, unblock, kill, return
 * Closing transitions: ship, kill
 * Containers: cycle (singularity=true, 6 weeks), bet, scope (parent=bet)
 * Integrity: bet-cycle-integrity (all tasks in same bet must be in same cycle)
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
import { AgentService } from '../../src/domains/agents/agent-service.js';
import { FileAgentStore } from '../../src/domains/agents/agent-store.js';
import { InMemoryContainerMetadataService } from '../../src/domains/containers/container-metadata-service.js';
import type { TaskTransitionEvent, ContainerAssignmentEvent } from '../../src/shared/events/types.js';
import type { IContainerService } from '../../src/container/interfaces.js';
import type { AuditValidationResult } from '../../src/container/interfaces.js';
import { TestLogger } from '../helpers/test-logger.js';
import { SHAPE_UP_PROFILE } from '../../src/profiles/shape-up.js';

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
    sessionId: 'session-shapeup',
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
    sessionId: 'session-shapeup',
    actor: { type: 'ai-agent', id: actorId, name: `Agent ${actorId}` },
  };
}

const PASSING_VALIDATION: AuditValidationResult = {
  stepsRun: 5,
  stepsPassed: 5,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'DependencyValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ContainerAssignmentValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ContainerIntegrityValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'CircuitBreakerValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const FAILING_VALIDATION: AuditValidationResult = {
  stepsRun: 5,
  stepsPassed: 3,
  stepsFailed: 2,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'DependencyValidation', passed: false, severity: 'error', message: 'dependency not met' },
    { stepName: 'ContainerAssignmentValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ContainerIntegrityValidation', passed: false, severity: 'error', message: 'integrity violation' },
    { stepName: 'CircuitBreakerValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const SHIP_WITH_QUALITY_GATES: AuditValidationResult = {
  stepsRun: 6,
  stepsPassed: 6,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'ApprovalRequirementValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'PRReviewValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'TestCoverageValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'SecurityScanValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'FieldRequirementValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const KILL_VALIDATION: AuditValidationResult = {
  stepsRun: 2,
  stepsPassed: 2,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'TaskAlreadyCompletedValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const BLOCK_VALIDATION: AuditValidationResult = {
  stepsRun: 2,
  stepsPassed: 2,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'TaskAlreadyCompletedValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const UNBLOCK_VALIDATION: AuditValidationResult = {
  stepsRun: 3,
  stepsPassed: 3,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'TaskAlreadyCompletedValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'CircuitBreakerValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

// ─── Tests ───

describe('Shape Up Lifecycle Integration', () => {
  let tmpDir: string;
  let eventBus: InMemoryEventBus;
  let auditService: AuditService;
  let analyticsService: AnalyticsService;
  let complianceService: ComplianceService;
  let agentService: AgentService;
  let logger: TestLogger;

  // Timeline: Day 0 = cycle start
  const DAY_0 = new Date('2024-06-01T09:00:00Z').getTime();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shapeup-lifecycle-'));
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    logger = new TestLogger();
    eventBus = new InMemoryEventBus();

    const auditStore = new JsonlAuditStore(tmpDir, logger);
    auditService = new AuditService(auditStore, eventBus, logger);

    const containerService = createMockContainerService([10, 11, 12, 13, 14, 15]);
    analyticsService = new AnalyticsService(auditService, containerService, eventBus, logger, SHAPE_UP_PROFILE);

    complianceService = new ComplianceService(auditService, analyticsService, eventBus, logger, SHAPE_UP_PROFILE);

    const agentStore = new FileAgentStore(tmpDir, logger);
    agentService = new AgentService(agentStore, logger);
  });

  afterEach(async () => {
    auditService.dispose();
    analyticsService.dispose();
    complianceService.dispose();
    eventBus.removeAllListeners();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Test 1: Connected Pipeline — Happy Path ───

  it('shape→bet→start→review→ship flows through audit → analytics → compliance', async () => {
    // Task 10: full Shape Up lifecycle
    const events = [
      transitionEvent(10, 'shape', 'RAW', 'SHAPED', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'bet', 'SHAPED', 'BET', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'review', 'BUILDING', 'QA', timestamp(DAY_0, 1 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'ship', 'QA', 'SHIPPED', timestamp(DAY_0, 1.5 * DAY), 'agent-alpha', SHIP_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Layer 1: Audit captured all 5 transitions
    const auditResult = await auditService.queryEvents({ issueNumber: 10 });
    expect(auditResult.events).toHaveLength(5);
    expect(auditResult.events.map((e) => (e.event as Record<string, unknown>).transition))
      .toEqual(['shape', 'bet', 'start', 'review', 'ship']);

    // Layer 2: Analytics computed cycle time (BUILDING → SHIPPED)
    const cycleTime = await analyticsService.getTaskCycleTime(10);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.issueNumber).toBe(10);
    // start at 4h (BET→BUILDING), completed at 36h (1.5 days) → cycle = 32h
    expect(cycleTime!.startedAt).toBe(timestamp(DAY_0, 4 * HOUR));
    expect(cycleTime!.completedAt).toBe(timestamp(DAY_0, 1.5 * DAY));
    expect(cycleTime!.cycleTimeHours).toBeCloseTo(32, 0);
    expect(cycleTime!.blockCount).toBe(0);
    expect(cycleTime!.blockingTimeHours).toBe(0);

    // Layer 3: Compliance consumed audit + analytics
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.score).toBeGreaterThan(0);
    expect(compliance.grade).toBeDefined();
    expect(compliance.categories.brePassRate.score).toBe(100);
    expect(compliance.categories.qualityGates.score).toBe(100);
    expect(compliance.categories.processAdherence.score).toBe(100); // 5/5 lifecycle steps
    expect(compliance.categories.flowEfficiency.score).toBe(100);
    expect(compliance.metadata.totalTransitions).toBe(5);
    expect(compliance.metadata.totalTasks).toBe(1);
  });

  // ─── Test 2: Circuit Breaker Path ───

  it('shape→bet→start→kill uses alternate lifecycle for 100% adherence', async () => {
    // Task 10: circuit breaker — killed before shipping
    const events = [
      transitionEvent(10, 'shape', 'RAW', 'SHAPED', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'bet', 'SHAPED', 'BET', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'kill', 'BUILDING', 'KILLED', timestamp(DAY_0, 3 * DAY), 'agent-alpha', KILL_VALIDATION),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Audit: 4 transitions captured
    const auditResult = await auditService.queryEvents({ issueNumber: 10 });
    expect(auditResult.events).toHaveLength(4);
    expect(auditResult.events.map((e) => (e.event as Record<string, unknown>).transition))
      .toEqual(['shape', 'bet', 'start', 'kill']);

    // Kill is a closing transition
    const lastTransition = (auditResult.events[3].event as Record<string, unknown>).toStatus;
    expect(lastTransition).toBe('KILLED');

    // Analytics: cycle time starts at start (BUILDING), ends at kill (KILLED)
    const cycleTime = await analyticsService.getTaskCycleTime(10);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.completedAt).toBe(timestamp(DAY_0, 3 * DAY));

    // Compliance: alternate lifecycle [shape, bet, start, kill] → 4/4 = 100%
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.processAdherence.score).toBe(100);
    expect(compliance.categories.processAdherence.detail).toContain('1 completed task');
  });

  // ─── Test 3: Kill from QA ───

  it('shape→bet→start→review→kill from QA uses alternate lifecycle', async () => {
    // Task 10: progressed to QA, then killed
    const events = [
      transitionEvent(10, 'shape', 'RAW', 'SHAPED', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'bet', 'SHAPED', 'BET', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'review', 'BUILDING', 'QA', timestamp(DAY_0, 1 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'kill', 'QA', 'KILLED', timestamp(DAY_0, 2 * DAY), 'agent-alpha', KILL_VALIDATION),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Audit: 5 transitions captured
    const auditResult = await auditService.queryEvents({ issueNumber: 10 });
    expect(auditResult.events).toHaveLength(5);

    // Kill from QA is valid — task ends in KILLED
    const lastEvent = auditResult.events[4].event as Record<string, unknown>;
    expect(lastEvent.transition).toBe('kill');
    expect(lastEvent.fromStatus).toBe('QA');
    expect(lastEvent.toStatus).toBe('KILLED');

    // Analytics: cycle time from start (BUILDING) to kill (KILLED)
    const cycleTime = await analyticsService.getTaskCycleTime(10);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.startedAt).toBe(timestamp(DAY_0, 4 * HOUR));
    expect(cycleTime!.completedAt).toBe(timestamp(DAY_0, 2 * DAY));

    // Compliance: alternate lifecycle is [shape, bet, start, kill]
    // Task has: shape, bet, start, review, kill
    // Matches: shape(Y), bet(Y), start(Y), kill(Y) → 4/4 = 100%
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.processAdherence.score).toBe(100);
  });

  // ─── Test 4: Kill from BLOCKED ───

  it('shape→bet→start→block→kill computes blocking time up to kill', async () => {
    // Task 10: building, blocked, then killed while blocked
    const events = [
      transitionEvent(10, 'shape', 'RAW', 'SHAPED', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'bet', 'SHAPED', 'BET', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'block', 'BUILDING', 'BLOCKED', timestamp(DAY_0, 6 * HOUR), 'agent-alpha', BLOCK_VALIDATION),
      transitionEvent(10, 'kill', 'BLOCKED', 'KILLED', timestamp(DAY_0, 12 * HOUR), 'agent-alpha', KILL_VALIDATION),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Analytics: blocking time = 12h - 6h = 6h (block to kill)
    // kill from BLOCKED is recognized as an unblock action (transitions FROM blocked to non-blocked)
    const cycleTime = await analyticsService.getTaskCycleTime(10);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.blockCount).toBe(1);
    expect(cycleTime!.blockingTimeHours).toBe(6); // blocked at 6h, killed at 12h
    expect(cycleTime!.startedAt).toBe(timestamp(DAY_0, 2 * HOUR));
    expect(cycleTime!.completedAt).toBe(timestamp(DAY_0, 12 * HOUR));
    // Cycle time: 12h - 2h = 10h
    expect(cycleTime!.cycleTimeHours).toBe(10);

    // Flow efficiency: (10 - 6) / 10 = 40%
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.flowEfficiency.score).toBe(40);
  });

  // ─── Test 5: Circuit Breaker Step in Pipelines ───

  it('CircuitBreakerValidation:cycle appears in correct pipelines', () => {
    const circuitBreakerStep = 'CircuitBreakerValidation:cycle';

    // Should appear in: start, review, unblock, return
    expect(SHAPE_UP_PROFILE.pipelines.start.steps).toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.review.steps).toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.unblock.steps).toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.return.steps).toContain(circuitBreakerStep);

    // Should NOT appear in: shape, bet, ship, kill, block
    expect(SHAPE_UP_PROFILE.pipelines.shape.steps).not.toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.bet.steps).not.toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.ship.steps).not.toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.kill.steps).not.toContain(circuitBreakerStep);
    expect(SHAPE_UP_PROFILE.pipelines.block.steps).not.toContain(circuitBreakerStep);
  });

  // ─── Test 6: Bet-Cycle Integrity ───

  it('container assignments with integrity violations reduce containerIntegrity score', async () => {
    // 3 cycle assignments: 2 maintain bet-cycle integrity, 1 violates
    const events = [
      containerAssignment(10, 'cycle-001-auth', true, timestamp(DAY_0, 0), 'agent-alpha'),
      containerAssignment(11, 'cycle-001-auth', true, timestamp(DAY_0, 1 * HOUR), 'agent-alpha'),
      containerAssignment(12, 'cycle-002-payments', false, timestamp(DAY_0, 2 * HOUR), 'agent-beta'), // violation
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // 2/3 maintained = 66.67%
    expect(compliance.categories.containerIntegrity.score).toBeCloseTo(66.67, 0);
    expect(compliance.categories.containerIntegrity.detail).toContain('2/3');

    // Weight should be 0.10 for Shape Up
    expect(compliance.categories.containerIntegrity.weight).toBe(0.10);
  });

  // ─── Test 7: Block/Unblock Cycle ───

  it('block/unblock cycle computes blocking time correctly', async () => {
    // Task 10: BUILDING → BLOCKED → BUILDING
    const events = [
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'block', 'BUILDING', 'BLOCKED', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', BLOCK_VALIDATION),
      transitionEvent(10, 'unblock', 'BLOCKED', 'BUILDING', timestamp(DAY_0, 10 * HOUR), 'agent-alpha', UNBLOCK_VALIDATION),
      transitionEvent(10, 'review', 'BUILDING', 'QA', timestamp(DAY_0, 16 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'ship', 'QA', 'SHIPPED', timestamp(DAY_0, 20 * HOUR), 'agent-alpha', SHIP_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Analytics: blocking time = 10h - 4h = 6h
    const cycleTime = await analyticsService.getTaskCycleTime(10);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.blockCount).toBe(1);
    expect(cycleTime!.blockingTimeHours).toBe(6);
    expect(cycleTime!.cycleTimeHours).toBe(20); // 0h → 20h

    // Unblock target is BUILDING (verified by the transition event)
    const auditResult = await auditService.queryEvents({ issueNumber: 10 });
    const unblockEvent = auditResult.events.find(
      (e) => (e.event as Record<string, unknown>).transition === 'unblock',
    );
    expect(unblockEvent).toBeDefined();
    expect((unblockEvent!.event as Record<string, unknown>).toStatus).toBe('BUILDING');

    // Compliance: flow efficiency = (20 - 6) / 20 = 70%
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.flowEfficiency.score).toBe(70);
  });

  // ─── Test 8: Process Adherence with Mixed Outcomes ───

  it('shipped and killed tasks both achieve 100% adherence with respective lifecycles', async () => {
    // Task 10: full shipped lifecycle (shape→bet→start→review→ship = 5/5 = 100%)
    const task10Events = [
      transitionEvent(10, 'shape', 'RAW', 'SHAPED', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'bet', 'SHAPED', 'BET', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'review', 'BUILDING', 'QA', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(10, 'ship', 'QA', 'SHIPPED', timestamp(DAY_0, 10 * HOUR), 'agent-alpha', SHIP_WITH_QUALITY_GATES),
    ];

    // Task 11: killed lifecycle (shape→bet→start→kill = 4/4 via alternate = 100%)
    const task11Events = [
      transitionEvent(11, 'shape', 'RAW', 'SHAPED', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(11, 'bet', 'SHAPED', 'BET', timestamp(DAY_0, 1 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(11, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 2 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(11, 'kill', 'BUILDING', 'KILLED', timestamp(DAY_0, 6 * HOUR), 'agent-beta', KILL_VALIDATION),
    ];

    for (const event of [...task10Events, ...task11Events]) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 15));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // Both tasks: 100% adherence → average = 100%
    expect(compliance.categories.processAdherence.score).toBe(100);
    expect(compliance.categories.processAdherence.detail).toContain('2 completed tasks');
    expect(compliance.metadata.totalTasks).toBe(2);
  });

  // ─── Test 9: Compliance Weights ───

  it('Shape Up compliance weights sum to 1.0 and match expected values', () => {
    const weights = SHAPE_UP_PROFILE.compliance.weights;

    expect(weights.brePassRate).toBe(0.35);
    expect(weights.qualityGates).toBe(0.25);
    expect(weights.processAdherence).toBe(0.20);
    expect(weights.containerIntegrity).toBe(0.10);
    expect(weights.flowEfficiency).toBe(0.10);

    const total = weights.brePassRate + weights.qualityGates + weights.processAdherence +
      weights.containerIntegrity + weights.flowEfficiency;
    expect(total).toBeCloseTo(1.0, 5);
  });

  // ─── Test 10: Multi-Agent Actor Breakdown ───

  it('multi-agent workflow produces distinct per-actor audit trails and compliance', async () => {
    // Register agents
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Shape Alpha', role: 'building' });
    await agentService.registerAgent({ agentId: 'agent-beta', name: 'Shape Beta', role: 'qa' });

    // Agent-alpha works on tasks 10, 11
    // Agent-beta works on tasks 12, 13
    const events = [
      transitionEvent(10, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(12, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(11, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(13, 'start', 'BET', 'BUILDING', timestamp(DAY_0, 1 * HOUR), 'agent-beta', FAILING_VALIDATION),
      transitionEvent(10, 'review', 'BUILDING', 'QA', timestamp(DAY_0, 6 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(12, 'block', 'BUILDING', 'BLOCKED', timestamp(DAY_0, 3 * HOUR), 'agent-beta', BLOCK_VALIDATION),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Audit trail per actor
    const alphaEvents = await auditService.queryEvents({ actorId: 'agent-alpha' });
    const betaEvents = await auditService.queryEvents({ actorId: 'agent-beta' });

    expect(alphaEvents.events).toHaveLength(3); // start(10), start(11), review(10)
    expect(betaEvents.events).toHaveLength(3); // start(12), start(13), block(12)

    // Summary shows actor breakdown
    const summary = await auditService.getSummary();
    expect(summary.byActor['agent-alpha']).toBe(3);
    expect(summary.byActor['agent-beta']).toBe(3);

    // Agent listing
    const agents = await agentService.listAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.agentId).sort()).toEqual(['agent-alpha', 'agent-beta']);

    // Per-actor compliance
    const alphaCompliance = await complianceService.computeComplianceScore({ actorId: 'agent-alpha' });
    const betaCompliance = await complianceService.computeComplianceScore({ actorId: 'agent-beta' });

    // Alpha: 3/3 passed BRE = 100%
    expect(alphaCompliance.categories.brePassRate.score).toBe(100);
    // Beta: 2/3 passed BRE (1 failing validation) = 66.67%
    expect(betaCompliance.categories.brePassRate.score).toBeCloseTo(66.67, 0);
  });
});

// ─── Mock ───

function createMockContainerService(taskNumbers: number[]): IContainerService {
  return {
    getContainerStatus: async () => ({
      name: 'cycle-001-auth',
      status: 'active',
      tasks: taskNumbers.map((n) => ({ number: n, title: `Task ${n}`, status: 'BUILDING' })),
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
