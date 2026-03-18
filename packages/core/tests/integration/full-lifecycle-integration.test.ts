/**
 * Full Lifecycle Integration Test — The Connected Pipeline
 *
 * Verifies the complete data flow that Phase 5B+C skills depend on:
 *   transition events → audit persistence → analytics computation → compliance scoring
 *
 * Simulates a realistic multi-day, multi-agent project workflow:
 *   - 2 agents working on 6 tasks across 2 epics in 1 wave
 *   - Full lifecycle (refine → ready → start → review → approve) for some tasks
 *   - Partial lifecycle (skipped steps) for others → process adherence impact
 *   - Block/unblock cycles → blocking time + flow efficiency impact
 *   - BRE validation failures → BRE pass rate impact
 *   - Container assignments with integrity → epic integrity impact
 *
 * Each test validates data shapes that skills will consume:
 *   - /standup reads: audit trail (24h), analytics (cycle time, throughput), agents, compliance
 *   - /retro reads: analytics (wave-level), audit trail (actor breakdown), compliance
 *   - /compliance reads: compliance score (5 categories), audit trail (actor patterns)
 *   - /health reads: compliance grade, analytics (throughput), agents
 *   - /plan-wave reads: analytics (capacity), compliance (grade), agents
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
import type { TaskTransitionEvent, ContainerAssignmentEvent } from '../../src/shared/events/types.js';
import type { IContainerService } from '../../src/container/interfaces.js';
import type { AuditValidationResult } from '../../src/container/interfaces.js';
import { TestLogger } from '../helpers/test-logger.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';

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
    sessionId: 'session-lifecycle',
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
    sessionId: 'session-lifecycle',
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
    { stepName: 'WaveAssignmentValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'FieldRequirementValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'PRReviewValidation', passed: true, severity: 'info', message: 'ok' },
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
    { stepName: 'WaveAssignmentValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'FieldRequirementValidation', passed: false, severity: 'error', message: 'missing field' },
    { stepName: 'PRReviewValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const APPROVE_WITH_QUALITY_GATES: AuditValidationResult = {
  stepsRun: 6,
  stepsPassed: 6,
  stepsFailed: 0,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'DependencyValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'PRReviewValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'TestCoverageValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'SecurityScanValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'FieldRequirementValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

const APPROVE_FAILING_QUALITY_GATE: AuditValidationResult = {
  stepsRun: 6,
  stepsPassed: 5,
  stepsFailed: 1,
  stepsWarned: 0,
  details: [
    { stepName: 'StatusTransitionValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'DependencyValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'PRReviewValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'TestCoverageValidation', passed: false, severity: 'error', message: 'coverage below 80%' },
    { stepName: 'SecurityScanValidation', passed: true, severity: 'info', message: 'ok' },
    { stepName: 'FieldRequirementValidation', passed: true, severity: 'info', message: 'ok' },
  ],
};

// ─── Tests ───

describe('Full Lifecycle Integration', () => {
  let tmpDir: string;
  let eventBus: InMemoryEventBus;
  let auditService: AuditService;
  let analyticsService: AnalyticsService;
  let complianceService: ComplianceService;
  let agentService: AgentService;
  let logger: TestLogger;

  // Timeline: Day 0 = project start
  const DAY_0 = new Date('2024-06-01T09:00:00Z').getTime();

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'full-lifecycle-'));
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    logger = new TestLogger();
    eventBus = new InMemoryEventBus();

    const auditStore = new JsonlAuditStore(tmpDir, logger);
    auditService = new AuditService(auditStore, eventBus, logger);

    const containerService = createMockContainerService([40, 41, 42, 43, 44, 45]);
    analyticsService = new AnalyticsService(auditService, containerService, eventBus, logger, HYDRO_PROFILE);

    complianceService = new ComplianceService(auditService, analyticsService, eventBus, logger, HYDRO_PROFILE);

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

  // ─── Test 1: Connected Pipeline ───

  it('transitions flow through audit → analytics → compliance as connected pipeline', async () => {
    // Task 40: full lifecycle by agent-alpha (refine → ready → start → review → approve)
    const events = [
      transitionEvent(40, 'refine', 'BACKLOG', 'IN_REFINEMENT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'ready', 'IN_REFINEMENT', 'READY_FOR_DEV', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 1 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 1.5 * DAY), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Layer 1: Audit captured all events
    const auditResult = await auditService.queryEvents({ issueNumber: 40 });
    expect(auditResult.events).toHaveLength(5);
    expect(auditResult.events.map((e) => (e.event as Record<string, unknown>).transition))
      .toEqual(['refine', 'ready', 'start', 'review', 'approve']);

    // Layer 2: Analytics computed cycle time from audit
    const cycleTime = await analyticsService.getTaskCycleTime(40);
    expect(cycleTime).not.toBeNull();
    expect(cycleTime!.issueNumber).toBe(40);
    expect(cycleTime!.startedAt).toBe(timestamp(DAY_0, 4 * HOUR));
    expect(cycleTime!.completedAt).toBe(timestamp(DAY_0, 1.5 * DAY));
    expect(cycleTime!.cycleTimeHours).toBeCloseTo(32, 0); // 4h → 36h = ~32h
    expect(cycleTime!.blockCount).toBe(0);
    expect(cycleTime!.blockingTimeHours).toBe(0);

    // Layer 3: Compliance consumed audit + analytics
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.score).toBeGreaterThan(0);
    expect(compliance.grade).toBeDefined();
    expect(compliance.categories.brePassRate.score).toBe(100); // All validations passed
    expect(compliance.categories.qualityGates.score).toBe(100); // Quality gates passed
    expect(compliance.categories.processAdherence.score).toBe(100); // Full lifecycle followed
    expect(compliance.categories.flowEfficiency.score).toBe(100); // No blocking time
    expect(compliance.metadata.totalTransitions).toBe(5);
    expect(compliance.metadata.totalTasks).toBe(1);
  });

  // ─── Test 2: BRE Failures Impact Compliance ───

  it('BRE validation failures reduce compliance BRE pass rate', async () => {
    // 3 passing transitions + 2 failing transitions
    const events = [
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 2 * HOUR), 'agent-beta', FAILING_VALIDATION),
      transitionEvent(43, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 3 * HOUR), 'agent-beta', FAILING_VALIDATION),
      transitionEvent(44, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // 3/5 passed = 60% BRE pass rate
    expect(compliance.categories.brePassRate.score).toBe(60);
    expect(compliance.categories.brePassRate.detail).toContain('3/5');

    // Overall score should be < 100 due to BRE failures
    expect(compliance.score).toBeLessThan(100);

    // Should generate recommendation about BRE failures
    expect(compliance.recommendations.length).toBeGreaterThan(0);
    expect(compliance.recommendations.some((r) => r.toLowerCase().includes('bre') || r.toLowerCase().includes('validation'))).toBe(true);
  });

  // ─── Test 3: Blocking Time Impacts Flow Efficiency ───

  it('blocking time reduces flow efficiency in compliance score', async () => {
    // Task 40: started, blocked for 6h (out of 12h total cycle), approved
    const events = [
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'block', 'IN_PROGRESS', 'BLOCKED', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'unblock', 'BLOCKED', 'READY_FOR_DEV', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 12 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Analytics: 6h blocked out of 12h cycle
    const cycleTime = await analyticsService.getTaskCycleTime(40);
    expect(cycleTime!.cycleTimeHours).toBe(12);
    expect(cycleTime!.blockingTimeHours).toBe(6);
    expect(cycleTime!.blockCount).toBe(1);

    // Compliance: flow efficiency = (12-6)/12 = 50%
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.flowEfficiency.score).toBe(50);
    expect(compliance.categories.flowEfficiency.detail).toContain('50');
  });

  // ─── Test 4: Process Adherence — Skipped Steps ───

  it('skipping lifecycle steps reduces process adherence score', async () => {
    // Task 40: full lifecycle (5/5 steps) → 100% adherence
    const task40Events = [
      transitionEvent(40, 'refine', 'BACKLOG', 'IN_REFINEMENT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'ready', 'IN_REFINEMENT', 'READY_FOR_DEV', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 10 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    // Task 41: skipped refine and ready (3/5 steps) → 60% adherence
    const task41Events = [
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 6 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 8 * HOUR), 'agent-beta', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of [...task40Events, ...task41Events]) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 15));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // Average: (100% + 60%) / 2 = 80%
    expect(compliance.categories.processAdherence.score).toBe(80);
    expect(compliance.categories.processAdherence.detail).toContain('2 completed tasks');
  });

  // ─── Test 5: Quality Gate Failures Impact Compliance ───

  it('quality gate failures reduce quality gate score', async () => {
    // Two tasks approved: one passes quality gates, one fails
    const events = [
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 8 * HOUR), 'agent-beta', APPROVE_FAILING_QUALITY_GATE),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    const compliance = await complianceService.computeComplianceScore();

    // 1/2 approvals passed quality gates = 50%
    expect(compliance.categories.qualityGates.score).toBe(50);
    expect(compliance.categories.qualityGates.detail).toContain('1/2');

    // Should recommend improving quality gates
    expect(compliance.recommendations.some((r) => r.toLowerCase().includes('quality gate'))).toBe(true);
  });

  // ─── Test 6: Epic Integrity via Wave Assignments ───

  it('container assignments with integrity violations reduce epic integrity score', async () => {
    // 3 wave assignments: 2 maintain epic integrity, 1 violates
    const events = [
      containerAssignment(40, 'wave-1', true, timestamp(DAY_0, 0), 'agent-alpha'),
      containerAssignment(41, 'wave-1', true, timestamp(DAY_0, 1 * HOUR), 'agent-alpha'),
      containerAssignment(42, 'wave-2', false, timestamp(DAY_0, 2 * HOUR), 'agent-beta'), // violation
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
  });

  // ─── Test 7: Multi-Agent Actor Breakdown ───

  it('multi-agent workflow produces distinct per-actor audit trails', async () => {
    // Register agents
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Claude Alpha', role: 'coding' });
    await agentService.registerAgent({ agentId: 'agent-beta', name: 'Claude Beta', role: 'review' });

    // Agent-alpha works on tasks 40, 41
    // Agent-beta works on tasks 42, 43
    const events = [
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(43, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-beta', FAILING_VALIDATION),
      transitionEvent(40, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 6 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(42, 'block', 'IN_PROGRESS', 'BLOCKED', timestamp(DAY_0, 3 * HOUR), 'agent-beta', PASSING_VALIDATION),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 100));

    // Audit trail per actor (what /standup and /retro consume)
    const alphaEvents = await auditService.queryEvents({ actorId: 'agent-alpha' });
    const betaEvents = await auditService.queryEvents({ actorId: 'agent-beta' });

    expect(alphaEvents.events).toHaveLength(3); // start(40), start(41), review(40)
    expect(betaEvents.events).toHaveLength(3); // start(42), start(43), block(42)

    // Summary shows actor breakdown (what /retro uses for actor analysis)
    const summary = await auditService.getSummary();
    expect(summary.byActor['agent-alpha']).toBe(3);
    expect(summary.byActor['agent-beta']).toBe(3);

    // Agent listing (what /standup and /health use)
    const agents = await agentService.listAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.agentId).sort()).toEqual(['agent-alpha', 'agent-beta']);

    // Per-actor compliance (what /compliance synthesis uses)
    const alphaCompliance = await complianceService.computeComplianceScore({ actorId: 'agent-alpha' });
    const betaCompliance = await complianceService.computeComplianceScore({ actorId: 'agent-beta' });

    // Alpha: 3/3 passed BRE = 100%
    expect(alphaCompliance.categories.brePassRate.score).toBe(100);
    // Beta: 2/3 passed BRE (1 failing validation) = 66.67%
    expect(betaCompliance.categories.brePassRate.score).toBeCloseTo(66.67, 0);
  });

  // ─── Test 8: Realistic Multi-Day Workflow ───

  it('multi-day workflow produces coherent data across all services', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });

    // Day 0: Container setup + start work
    const setupEvents = [
      containerAssignment(40, 'wave-1', true, timestamp(DAY_0, 0), 'agent-alpha'),
      containerAssignment(41, 'wave-1', true, timestamp(DAY_0, 0), 'agent-alpha'),
      containerAssignment(42, 'wave-1', true, timestamp(DAY_0, 0), 'agent-alpha'),
    ];

    // Day 0-1: Task 40 full lifecycle (2 days)
    const task40Events = [
      transitionEvent(40, 'refine', 'BACKLOG', 'IN_REFINEMENT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'ready', 'IN_REFINEMENT', 'READY_FOR_DEV', timestamp(DAY_0, 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 1 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 1.5 * DAY), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    // Day 1-3: Task 41 with blocking (3 days, 12h blocked)
    const task41Events = [
      transitionEvent(41, 'refine', 'BACKLOG', 'IN_REFINEMENT', timestamp(DAY_0, 1 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'ready', 'IN_REFINEMENT', 'READY_FOR_DEV', timestamp(DAY_0, 1 * DAY + 1 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 1 * DAY + 2 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'block', 'IN_PROGRESS', 'BLOCKED', timestamp(DAY_0, 1.5 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'unblock', 'BLOCKED', 'READY_FOR_DEV', timestamp(DAY_0, 2 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 2 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 2.5 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(41, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 3 * DAY), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    // Day 2-3: Task 42 skips refinement (partial lifecycle)
    const task42Events = [
      transitionEvent(42, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 2 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(42, 'review', 'IN_PROGRESS', 'IN_REVIEW', timestamp(DAY_0, 2.5 * DAY), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(42, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 3 * DAY), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
    ];

    const allEvents = [...setupEvents, ...task40Events, ...task41Events, ...task42Events];

    for (const event of allEvents) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 15));
    }
    await new Promise((r) => setTimeout(r, 200));

    // ── Verify all layers produce coherent data ──

    // Audit: total events
    const allAudit = await auditService.queryEvents({ eventType: 'task.transition' });
    expect(allAudit.events).toHaveLength(16); // 5 + 8 + 3

    // Audit: can query by time range (what /standup uses for "last 24h")
    const day2Events = await auditService.queryEvents({
      since: timestamp(DAY_0, 2 * DAY),
      until: timestamp(DAY_0, 3 * DAY),
    });
    expect(day2Events.events.length).toBeGreaterThan(0);

    // Analytics: per-task cycle times
    const ct40 = await analyticsService.getTaskCycleTime(40);
    const ct41 = await analyticsService.getTaskCycleTime(41);
    const ct42 = await analyticsService.getTaskCycleTime(42);

    expect(ct40!.cycleTimeHours).toBeCloseTo(32, 0); // 4h → 36h
    expect(ct40!.blockCount).toBe(0);

    expect(ct41!.blockCount).toBe(1);
    expect(ct41!.blockingTimeHours).toBe(12); // blocked for 12h
    expect(ct41!.cycleTimeHours).toBeCloseTo(46, 0); // 26h → 72h = 46h

    expect(ct42!.cycleTimeHours).toBe(24); // day 2 → day 3
    expect(ct42!.blockCount).toBe(0);

    // Compliance: connected scoring
    const compliance = await complianceService.computeComplianceScore();

    // BRE pass rate: all 16 transitions passed = 100%
    expect(compliance.categories.brePassRate.score).toBe(100);

    // Quality gates: all 3 approvals passed = 100%
    expect(compliance.categories.qualityGates.score).toBe(100);

    // Process adherence: task 40 = 5/5 (100%), task 41 = 5/5 (100%), task 42 = 3/5 (60%)
    // Average: (100 + 100 + 60) / 3 = 86.67%
    expect(compliance.categories.processAdherence.score).toBeCloseTo(86.67, 0);

    // Epic integrity: 3/3 maintained = 100%
    expect(compliance.categories.containerIntegrity.score).toBe(100);

    // Flow efficiency: task 41 had 12h blocked out of 46h cycle
    // Task 40: 100%, Task 41: (46-12)/46 = 73.9%, Task 42: 100%
    // Average: ~91.3%
    expect(compliance.categories.flowEfficiency.score).toBeGreaterThan(85);
    expect(compliance.categories.flowEfficiency.score).toBeLessThan(95);

    // Overall: should be high but not perfect (process adherence drag)
    expect(compliance.score).toBeGreaterThan(80);
    expect(compliance.score).toBeLessThan(100);
    expect(compliance.grade).toMatch(/^[AB]$/);

    // Metadata
    expect(compliance.metadata.totalTasks).toBe(3);
    expect(compliance.metadata.totalTransitions).toBe(16);

    // Summary should be readable
    expect(compliance.summary.length).toBeGreaterThan(20);

    // Recommendations: process adherence < 90 should trigger recommendation
    expect(compliance.recommendations.some((r) => r.toLowerCase().includes('lifecycle') || r.toLowerCase().includes('step'))).toBe(true);
  });

  // ─── Test 9: Cache Invalidation Across Layers ───

  it('new events invalidate compliance cache producing updated scores', async () => {
    // Initial state: 1 passing transition
    eventBus.emit(transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION));
    await new Promise((r) => setTimeout(r, 50));

    const score1 = await complianceService.computeComplianceScore();
    expect(score1.categories.brePassRate.score).toBe(100);

    // New event: failing validation → cache should be invalidated by event bus
    eventBus.emit(transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-beta', FAILING_VALIDATION));
    await new Promise((r) => setTimeout(r, 50));

    const score2 = await complianceService.computeComplianceScore();
    // Now 1/2 passed = 50% BRE pass rate (NOT 100% from cache)
    expect(score2.categories.brePassRate.score).toBe(50);
  });

  // ─── Test 10: Compliance Score Shape for Skills ───

  it('compliance score has all fields that skills and prompts consume', async () => {
    // Minimal workflow to produce a score — stagger emits to avoid JSONL write races
    eventBus.emit(transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION));
    await new Promise((r) => setTimeout(r, 30));
    eventBus.emit(transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 8 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES));
    await new Promise((r) => setTimeout(r, 200));

    const score = await complianceService.computeComplianceScore();

    // Shape validation — these are the fields the upgraded skills reference:

    // Top-level (used by /health headline, /standup headline, /compliance report)
    expect(typeof score.score).toBe('number');
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(score.grade);
    expect(typeof score.summary).toBe('string');
    expect(Array.isArray(score.recommendations)).toBe(true);

    // Period (used by /compliance for temporal trends)
    expect(typeof score.period.since).toBe('string');
    expect(typeof score.period.until).toBe('string');

    // Categories (used by /compliance category table, /retro governance quality)
    for (const cat of Object.values(score.categories)) {
      expect(typeof cat.score).toBe('number');
      expect(typeof cat.weight).toBe('number');
      expect(typeof cat.contribution).toBe('number');
      expect(typeof cat.detail).toBe('string');
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(100);
      expect(cat.weight).toBeGreaterThan(0);
      expect(cat.weight).toBeLessThanOrEqual(1);
    }

    // Category weights sum to 1.0
    const totalWeight = Object.values(score.categories).reduce((sum, cat) => sum + cat.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);

    // Metadata (used by /compliance report footer)
    expect(typeof score.metadata.totalTransitions).toBe('number');
    expect(typeof score.metadata.totalTasks).toBe('number');
    expect(typeof score.metadata.computedAt).toBe('string');
  });

  // ─── Test 11: Analytics Shape for Skills ───

  it('analytics produces data shapes that skills consume', async () => {
    // Two completed tasks with different characteristics
    const events = [
      transitionEvent(40, 'refine', 'BACKLOG', 'IN_REFINEMENT', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 4 * HOUR), 'agent-alpha', PASSING_VALIDATION),
      transitionEvent(40, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 12 * HOUR), 'agent-alpha', APPROVE_WITH_QUALITY_GATES),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'block', 'IN_PROGRESS', 'BLOCKED', timestamp(DAY_0, 2 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'unblock', 'BLOCKED', 'READY_FOR_DEV', timestamp(DAY_0, 6 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 6 * HOUR), 'agent-beta', PASSING_VALIDATION),
      transitionEvent(41, 'approve', 'IN_REVIEW', 'DONE', timestamp(DAY_0, 14 * HOUR), 'agent-beta', APPROVE_WITH_QUALITY_GATES),
    ];

    for (const event of events) {
      eventBus.emit(event);
      await new Promise((r) => setTimeout(r, 15));
    }
    await new Promise((r) => setTimeout(r, 100));

    // TaskCycleTime shape (used by /standup for outlier detection, /board for annotations)
    const ct = await analyticsService.getTaskCycleTime(40);
    expect(ct).not.toBeNull();
    expect(typeof ct!.issueNumber).toBe('number');
    expect(typeof ct!.cycleTimeHours).toBe('number');
    expect(typeof ct!.blockCount).toBe('number');
    expect(typeof ct!.blockingTimeHours).toBe('number');
    expect(ct!.startedAt).not.toBeNull();
    expect(ct!.completedAt).not.toBeNull();

    // Blocked task has different characteristics
    const ctBlocked = await analyticsService.getTaskCycleTime(41);
    expect(ctBlocked!.blockCount).toBe(1);
    expect(ctBlocked!.blockingTimeHours).toBe(4); // 4h blocked
    expect(ctBlocked!.cycleTimeHours).toBe(14); // 14h total

    // ContainerAnalytics shape (used by /retro for throughput, /plan-wave for capacity)
    const containerAnalytics = await analyticsService.getContainerAnalytics('wave-1');
    expect(typeof containerAnalytics.waveName).toBe('string');
    expect(typeof containerAnalytics.velocity).toBe('number');
    expect(typeof containerAnalytics.totalTransitions).toBe('number');
    expect(typeof containerAnalytics.blockedTaskCount).toBe('number');
    // avgCycleTime, avgLeadTime, throughput can be null if no completed tasks match container
    // but transitionBreakdown should always be an object
    expect(typeof containerAnalytics.transitionBreakdown).toBe('object');
  });

  // ─── Test 12: Dry-Run Events Don't Pollute Pipeline ───

  it('dry-run transitions do not affect audit, analytics, or compliance', async () => {
    // Real event
    eventBus.emit(transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION));
    await new Promise((r) => setTimeout(r, 30));

    // Dry-run event (should be ignored)
    const dryRunEvent: TaskTransitionEvent = {
      ...transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 1 * HOUR), 'agent-beta', FAILING_VALIDATION),
      dryRun: true,
    };
    eventBus.emit(dryRunEvent);
    await new Promise((r) => setTimeout(r, 50));

    // Audit: only 1 event (not 2)
    const audit = await auditService.queryEvents({});
    expect(audit.events).toHaveLength(1);

    // Analytics: only task 40 has data
    const ct40 = await analyticsService.getTaskCycleTime(40);
    expect(ct40).not.toBeNull();
    const ct41 = await analyticsService.getTaskCycleTime(41);
    expect(ct41).toBeNull();

    // Compliance: BRE rate = 100% (only the passing real event counted)
    const compliance = await complianceService.computeComplianceScore();
    expect(compliance.categories.brePassRate.score).toBe(100);
    expect(compliance.metadata.totalTransitions).toBe(1);
  });

  // ─── Test 13: Agent Lock + Audit Integration ───

  it('agent locks and audit trails work together for team coordination', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });
    await agentService.registerAgent({ agentId: 'agent-beta', name: 'Beta', role: 'review' });

    // Alpha locks task 40
    const lock = await agentService.lockTask('agent-alpha', 40);
    expect(lock.agentId).toBe('agent-alpha');
    expect(lock.issueNumber).toBe(40);

    // Alpha works on task 40
    eventBus.emit(transitionEvent(40, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-alpha', PASSING_VALIDATION));
    await new Promise((r) => setTimeout(r, 30));

    // Beta locked on different task
    await agentService.lockTask('agent-beta', 41);
    eventBus.emit(transitionEvent(41, 'start', 'READY_FOR_DEV', 'IN_PROGRESS', timestamp(DAY_0, 0), 'agent-beta', PASSING_VALIDATION));
    await new Promise((r) => setTimeout(r, 30));

    // Verify: agents list shows both with correct locks (what /health and /standup use)
    const agents = await agentService.listAgents();
    expect(agents).toHaveLength(2);

    const alphaLock = await agentService.getTaskLock(40);
    expect(alphaLock!.agentId).toBe('agent-alpha');

    const betaLock = await agentService.getTaskLock(41);
    expect(betaLock!.agentId).toBe('agent-beta');

    // Release and verify
    await agentService.releaseTask('agent-alpha', 40);
    const releasedLock = await agentService.getTaskLock(40);
    expect(releasedLock).toBeNull();
  });
});

// ─── Mock ───

function createMockContainerService(taskNumbers: number[]): IContainerService {
  return {
    getContainerStatus: async () => ({
      name: 'wave-1',
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
