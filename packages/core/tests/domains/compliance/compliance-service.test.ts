import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplianceService } from '../../../src/domains/compliance/compliance-service.js';
import type { IAuditService } from '../../../src/domains/audit/audit-service.js';
import type { IAnalyticsService } from '../../../src/domains/analytics/analytics-service.js';
import type { PersistedAuditEvent } from '../../../src/domains/audit/audit-store.js';
import type { TaskCycleTime } from '../../../src/domains/analytics/analytics-service.js';
import type { MethodologyProfile } from '../../../src/profiles/types.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';
import { InMemoryEventBus } from '../../../src/shared/events/in-memory-event-bus.js';
import { TestLogger } from '../../helpers/test-logger.js';

// ─── Test Helpers ───

function createMockAuditService(): IAuditService {
  return {
    queryEvents: vi.fn().mockResolvedValue({ events: [], total: 0, query: {} }),
    getSummary: vi.fn().mockResolvedValue({
      period: {}, totalEvents: 0, byType: {}, byActor: {}, byTransition: {}, recentActivity: [],
    }),
    getRecentEvents: vi.fn().mockResolvedValue([]),
    getEventCount: vi.fn().mockResolvedValue(0),
  };
}

function createMockAnalyticsService(): IAnalyticsService {
  return {
    getContainerAnalytics: vi.fn().mockResolvedValue({}),
    getProjectAnalytics: vi.fn().mockResolvedValue({}),
    getTaskCycleTime: vi.fn().mockResolvedValue(null),
  };
}

function makeTransitionEvent(overrides: {
  issueNumber?: number;
  transition?: string;
  timestamp?: string;
  actorId?: string;
  validationResult?: {
    stepsRun: number;
    stepsPassed: number;
    stepsFailed: number;
    stepsWarned: number;
    details: Array<{ stepName: string; passed: boolean; message?: string }>;
  };
}): PersistedAuditEvent {
  return {
    id: 1,
    event: {
      type: 'task.transition',
      timestamp: overrides.timestamp ?? '2024-06-01T10:00:00Z',
      sessionId: 'test-session',
      actor: { type: 'ai-agent', id: overrides.actorId ?? 'mcp-session' },
      issueNumber: overrides.issueNumber ?? 42,
      transition: overrides.transition ?? 'start',
      validationResult: overrides.validationResult ?? {
        stepsRun: 3,
        stepsPassed: 3,
        stepsFailed: 0,
        stepsWarned: 0,
        details: [
          { stepName: 'StatusTransitionValidation', passed: true },
          { stepName: 'BaseTaskFieldsValidation', passed: true },
          { stepName: 'WaveAssignmentValidation', passed: true },
        ],
      },
    },
    persistedAt: '2024-06-01T10:00:00Z',
  };
}

function makeContainerAssignmentEvent(overrides: {
  issueNumber?: number;
  containerName?: string;
  integrityMaintained?: boolean;
  timestamp?: string;
}): PersistedAuditEvent {
  return {
    id: 1,
    event: {
      type: 'container.assignment',
      timestamp: overrides.timestamp ?? '2024-06-01T10:00:00Z',
      sessionId: 'test-session',
      actor: { type: 'ai-agent', id: 'mcp-session' },
      issueNumber: overrides.issueNumber ?? 42,
      containerName: overrides.containerName ?? 'wave-001',
      integrityMaintained: overrides.integrityMaintained ?? true,
    },
    persistedAt: '2024-06-01T10:00:00Z',
  };
}

// ─── Tests ───

describe('ComplianceService', () => {
  let auditService: ReturnType<typeof createMockAuditService>;
  let analyticsService: ReturnType<typeof createMockAnalyticsService>;
  let eventBus: InMemoryEventBus;
  let logger: TestLogger;
  let service: ComplianceService;

  beforeEach(() => {
    auditService = createMockAuditService();
    analyticsService = createMockAnalyticsService();
    eventBus = new InMemoryEventBus();
    logger = new TestLogger();
    service = new ComplianceService(auditService, analyticsService, eventBus, logger, HYDRO_PROFILE);
  });

  describe('empty state', () => {
    it('returns score 100 with grade A when no events exist', async () => {
      const result = await service.computeComplianceScore();

      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.metadata.totalTransitions).toBe(0);
      expect(result.metadata.totalTasks).toBe(0);
      expect(result.recommendations).toHaveLength(0);
      expect(result.categories.brePassRate.score).toBe(100);
      expect(result.categories.qualityGates.score).toBe(100);
      expect(result.categories.processAdherence.score).toBe(100);
      expect(result.categories.containerIntegrity.score).toBe(100);
      expect(result.categories.flowEfficiency.score).toBe(100);
    });
  });

  describe('BRE pass rate (40%)', () => {
    it('scores 100 when all transitions pass BRE', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 43, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 44, transition: 'review' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 3, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.brePassRate.score).toBe(100);
      expect(result.categories.brePassRate.detail).toContain('3/3');
    });

    it('scores 0 when all transitions fail BRE', async () => {
      const failedValidation = {
        stepsRun: 3, stepsPassed: 1, stepsFailed: 2, stepsWarned: 0,
        details: [
          { stepName: 'StatusTransitionValidation', passed: true },
          { stepName: 'BaseTaskFieldsValidation', passed: false },
          { stepName: 'WaveAssignmentValidation', passed: false },
        ],
      };
      const events = [
        makeTransitionEvent({ issueNumber: 42, validationResult: failedValidation }),
        makeTransitionEvent({ issueNumber: 43, validationResult: failedValidation }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.brePassRate.score).toBe(0);
    });

    it('computes proportional score for mixed results', async () => {
      const passing = {
        stepsRun: 3, stepsPassed: 3, stepsFailed: 0, stepsWarned: 0,
        details: [{ stepName: 'A', passed: true }],
      };
      const failing = {
        stepsRun: 3, stepsPassed: 1, stepsFailed: 2, stepsWarned: 0,
        details: [{ stepName: 'A', passed: false }],
      };
      const events = [
        makeTransitionEvent({ issueNumber: 42, validationResult: passing }),
        makeTransitionEvent({ issueNumber: 43, validationResult: passing }),
        makeTransitionEvent({ issueNumber: 44, validationResult: passing }),
        makeTransitionEvent({ issueNumber: 45, validationResult: failing }),
        makeTransitionEvent({ issueNumber: 46, validationResult: failing }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 5, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.brePassRate.score).toBe(60);
    });

    it('skips events with no validation data (stepsRun=0)', async () => {
      const noValidation = {
        stepsRun: 0, stepsPassed: 0, stepsFailed: 0, stepsWarned: 0,
        details: [],
      };
      const passing = {
        stepsRun: 3, stepsPassed: 3, stepsFailed: 0, stepsWarned: 0,
        details: [{ stepName: 'A', passed: true }],
      };
      const events = [
        makeTransitionEvent({ issueNumber: 42, validationResult: noValidation }),
        makeTransitionEvent({ issueNumber: 43, validationResult: passing }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.brePassRate.score).toBe(100);
      expect(result.categories.brePassRate.detail).toContain('1/1');
    });
  });

  describe('quality gates (20%)', () => {
    it('scores 100 when all approve transitions have passing quality gates', async () => {
      const events = [
        makeTransitionEvent({
          issueNumber: 42, transition: 'approve',
          validationResult: {
            stepsRun: 5, stepsPassed: 5, stepsFailed: 0, stepsWarned: 0,
            details: [
              { stepName: 'StatusTransitionValidation', passed: true },
              { stepName: 'PRReviewValidation', passed: true },
              { stepName: 'TestCoverageValidation', passed: true },
              { stepName: 'SecurityScanValidation', passed: true },
              { stepName: 'EpicIntegrityValidation', passed: true },
            ],
          },
        }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.qualityGates.score).toBe(100);
    });

    it('penalizes when quality gate step fails on approve', async () => {
      const events = [
        makeTransitionEvent({
          issueNumber: 42, transition: 'approve',
          validationResult: {
            stepsRun: 4, stepsPassed: 3, stepsFailed: 1, stepsWarned: 0,
            details: [
              { stepName: 'StatusTransitionValidation', passed: true },
              { stepName: 'PRReviewValidation', passed: false },
              { stepName: 'TestCoverageValidation', passed: true },
              { stepName: 'EpicIntegrityValidation', passed: true },
            ],
          },
        }),
        makeTransitionEvent({
          issueNumber: 43, transition: 'approve',
          validationResult: {
            stepsRun: 4, stepsPassed: 4, stepsFailed: 0, stepsWarned: 0,
            details: [
              { stepName: 'StatusTransitionValidation', passed: true },
              { stepName: 'PRReviewValidation', passed: true },
              { stepName: 'TestCoverageValidation', passed: true },
              { stepName: 'EpicIntegrityValidation', passed: true },
            ],
          },
        }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.qualityGates.score).toBe(50);
    });

    it('scores 100 when no approve events exist', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 43, transition: 'review' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.qualityGates.score).toBe(100);
      expect(result.categories.qualityGates.detail).toContain('No closing transitions');
    });

    it('counts as pass when quality gate steps not in pipeline', async () => {
      const events = [
        makeTransitionEvent({
          issueNumber: 42, transition: 'approve',
          validationResult: {
            stepsRun: 2, stepsPassed: 2, stepsFailed: 0, stepsWarned: 0,
            details: [
              { stepName: 'StatusTransitionValidation', passed: true },
              { stepName: 'EpicIntegrityValidation', passed: true },
            ],
          },
        }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.qualityGates.score).toBe(100);
    });
  });

  describe('process adherence (20%)', () => {
    it('scores 100 for task following full lifecycle', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'refine' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'ready' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'review' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'approve' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 5, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.processAdherence.score).toBe(100);
    });

    it('penalizes when lifecycle steps are skipped', async () => {
      // Only start + approve = 2/5 = 40%
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'approve' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.processAdherence.score).toBe(40);
    });

    it('excludes in-progress tasks (no approve)', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'review' }),
        // No approve → not evaluated
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.processAdherence.score).toBe(100);
      expect(result.categories.processAdherence.detail).toContain('No completed tasks');
    });

    it('averages across multiple completed tasks', async () => {
      const events = [
        // Task 42: full lifecycle = 100%
        makeTransitionEvent({ issueNumber: 42, transition: 'refine' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'ready' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'review' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'approve' }),
        // Task 43: only start + approve = 40%
        makeTransitionEvent({ issueNumber: 43, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 43, transition: 'approve' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 7, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.processAdherence.score).toBe(70); // (100+40)/2
    });
  });

  describe('epic integrity (10%)', () => {
    it('scores 100 when all assignments maintain integrity', async () => {
      const containerEvents = [
        makeContainerAssignmentEvent({ issueNumber: 42, integrityMaintained: true }),
        makeContainerAssignmentEvent({ issueNumber: 43, integrityMaintained: true }),
      ];

      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events: [], total: 0, query: {} }) // transitions
        .mockResolvedValueOnce({ events: containerEvents, total: 2, query: {} }); // container assignments

      const result = await service.computeComplianceScore();
      expect(result.categories.containerIntegrity.score).toBe(100);
    });

    it('computes proportional score for mixed integrity', async () => {
      const containerEvents = Array.from({ length: 10 }, (_, i) =>
        makeContainerAssignmentEvent({
          issueNumber: 40 + i,
          integrityMaintained: i < 8, // 8/10 maintained
        }),
      );

      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events: [], total: 0, query: {} })
        .mockResolvedValueOnce({ events: containerEvents, total: 10, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.categories.containerIntegrity.score).toBe(80);
    });

    it('scores 100 when no container assignments exist', async () => {
      // Provide some transition events so we don't get the empty report
      const events = [makeTransitionEvent({ issueNumber: 42, transition: 'start' })];
      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events, total: 1, query: {} }) // transitions
        .mockResolvedValueOnce({ events: [], total: 0, query: {} }); // container assignments

      const result = await service.computeComplianceScore();
      expect(result.categories.containerIntegrity.score).toBe(100);
      expect(result.categories.containerIntegrity.detail).toContain('No container assignments');
    });
  });

  describe('flow efficiency (10%)', () => {
    it('scores 100 when no blocking occurs', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });

      const cycleData: TaskCycleTime = {
        issueNumber: 42,
        startedAt: '2024-06-01T10:00:00Z',
        completedAt: '2024-06-01T20:00:00Z',
        cycleTimeHours: 10,
        leadTimeHours: 12,
        blockingTimeHours: 0,
        blockCount: 0,
      };
      vi.mocked(analyticsService.getTaskCycleTime).mockResolvedValue(cycleData);

      const result = await service.computeComplianceScore();
      expect(result.categories.flowEfficiency.score).toBe(100);
    });

    it('penalizes blocking time proportionally', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });

      const cycleData: TaskCycleTime = {
        issueNumber: 42,
        startedAt: '2024-06-01T10:00:00Z',
        completedAt: '2024-06-01T20:00:00Z',
        cycleTimeHours: 10,
        leadTimeHours: 12,
        blockingTimeHours: 3, // 30% blocked
        blockCount: 1,
      };
      vi.mocked(analyticsService.getTaskCycleTime).mockResolvedValue(cycleData);

      const result = await service.computeComplianceScore();
      expect(result.categories.flowEfficiency.score).toBe(70);
    });

    it('scores 100 when no cycle time data available', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });
      vi.mocked(analyticsService.getTaskCycleTime).mockResolvedValue(null);

      const result = await service.computeComplianceScore();
      expect(result.categories.flowEfficiency.score).toBe(100);
    });
  });

  describe('weighted total', () => {
    it('computes correct weighted score from category contributions', async () => {
      // Set up: all BRE pass (100×0.4=40), mixed quality gates, mixed process, etc.
      // Simple scenario: all categories at 100
      const result = await service.computeComplianceScore();
      expect(result.score).toBe(100);
      expect(result.categories.brePassRate.contribution).toBe(40);
      expect(result.categories.qualityGates.contribution).toBe(20);
      expect(result.categories.processAdherence.contribution).toBe(20);
      expect(result.categories.containerIntegrity.contribution).toBe(10);
      expect(result.categories.flowEfficiency.contribution).toBe(10);
    });

    it('weights sum to 1.0', async () => {
      const result = await service.computeComplianceScore();
      const totalWeight =
        result.categories.brePassRate.weight +
        result.categories.qualityGates.weight +
        result.categories.processAdherence.weight +
        result.categories.containerIntegrity.weight +
        result.categories.flowEfficiency.weight;
      expect(totalWeight).toBe(1.0);
    });
  });

  describe('grade boundaries', () => {
    function mockScoreScenario(breScore: number) {
      // Only manipulate BRE pass rate to control the score.
      // Other categories return 100 by default (no container assignment events).
      // BRE is 40% of total. To get a specific overall score:
      //   score = breScore × 0.4 + 100 × 0.6
      const passing = {
        stepsRun: 1, stepsPassed: 1, stepsFailed: 0, stepsWarned: 0,
        details: [{ stepName: 'A', passed: true }],
      };
      const failing = {
        stepsRun: 1, stepsPassed: 0, stepsFailed: 1, stepsWarned: 0,
        details: [{ stepName: 'A', passed: false }],
      };

      const total = 100;
      const passCount = Math.round((breScore / 100) * total);
      const events: PersistedAuditEvent[] = [];
      for (let i = 0; i < total; i++) {
        events.push(makeTransitionEvent({
          issueNumber: i,
          validationResult: i < passCount ? passing : failing,
        }));
      }

      // Use mockResolvedValueOnce: first call returns transitions, second returns empty container assignments
      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events, total: events.length, query: {} })
        .mockResolvedValueOnce({ events: [], total: 0, query: {} });
    }

    it('assigns grade A for score >= 90', async () => {
      // BRE=100 → total = 100×0.4 + 100×0.6 = 100
      mockScoreScenario(100);
      const result = await service.computeComplianceScore();
      expect(result.grade).toBe('A');
    });

    it('assigns grade B for score 80-89', async () => {
      // BRE=25 → total = 25×0.4 + 100×0.6 = 10 + 60 = 70... that's C
      // BRE=50 → total = 50×0.4 + 100×0.6 = 20 + 60 = 80
      mockScoreScenario(50);
      const result = await service.computeComplianceScore();
      expect(result.grade).toBe('B');
    });

    it('assigns grade C for score 70-79', async () => {
      // BRE=25 → 10+60=70
      mockScoreScenario(25);
      const result = await service.computeComplianceScore();
      expect(result.grade).toBe('C');
    });

    it('assigns grade D for score 60-69', async () => {
      // BRE=0 → 0+60=60
      mockScoreScenario(0);
      const result = await service.computeComplianceScore();
      expect(result.grade).toBe('D');
    });

    it('assigns grade F for score < 60', async () => {
      // Need other categories to fail too. Use epic integrity violations.
      const failing = {
        stepsRun: 1, stepsPassed: 0, stepsFailed: 1, stepsWarned: 0,
        details: [{ stepName: 'A', passed: false }],
      };
      const transitionEvents = Array.from({ length: 10 }, (_, i) =>
        makeTransitionEvent({ issueNumber: i, validationResult: failing }),
      );
      const containerEvents = Array.from({ length: 10 }, (_, i) =>
        makeContainerAssignmentEvent({ issueNumber: i, integrityMaintained: false }),
      );

      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events: transitionEvents, total: 10, query: {} })
        .mockResolvedValueOnce({ events: containerEvents, total: 10, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.score).toBeLessThan(60);
      expect(result.grade).toBe('F');
    });
  });

  describe('recommendations', () => {
    it('generates recommendations for categories below 90', async () => {
      const failing = {
        stepsRun: 1, stepsPassed: 0, stepsFailed: 1, stepsWarned: 0,
        details: [{ stepName: 'A', passed: false }],
      };
      const events = Array.from({ length: 10 }, (_, i) =>
        makeTransitionEvent({ issueNumber: i, validationResult: failing }),
      );
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 10, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.includes('BRE'))).toBe(true);
    });

    it('no recommendations when all categories are perfect', async () => {
      const result = await service.computeComplianceScore();
      expect(result.recommendations).toHaveLength(0);
    });
  });

  describe('caching', () => {
    it('returns cached result on second call', async () => {
      await service.computeComplianceScore({ since: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' });
      await service.computeComplianceScore({ since: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' });

      // queryEvents should only be called once (2 calls for first invocation: transitions + container assignments)
      expect(auditService.queryEvents).toHaveBeenCalledTimes(2);
    });

    it('invalidates cache when event bus fires', async () => {
      await service.computeComplianceScore({ since: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' });

      // Emit event to clear cache
      eventBus.emit({ type: 'task.transition', timestamp: new Date().toISOString(), sessionId: 'x', actor: { type: 'ai-agent', id: 'x', name: 'x' }, issueNumber: 1, transition: 'start', fromStatus: 'A', toStatus: 'B', dryRun: false });

      await service.computeComplianceScore({ since: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' });

      // 2 calls for first invocation + 2 calls for second (cache was cleared)
      expect(auditService.queryEvents).toHaveBeenCalledTimes(4);
    });
  });

  describe('filtering', () => {
    it('passes actorId filter to queryEvents', async () => {
      await service.computeComplianceScore({ actorId: 'agent-alpha' });

      expect(auditService.queryEvents).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'agent-alpha', eventType: 'task.transition' }),
      );
    });

    it('filters by containerName using container.assignment correlation', async () => {
      const transitionEvents = [
        makeTransitionEvent({ issueNumber: 42 }),
        makeTransitionEvent({ issueNumber: 43 }),
        makeTransitionEvent({ issueNumber: 99 }), // Not in container
      ];
      const containerAssignmentEvents = [
        makeContainerAssignmentEvent({ issueNumber: 42, containerName: 'wave-001' }),
        makeContainerAssignmentEvent({ issueNumber: 43, containerName: 'wave-001' }),
      ];

      // First call: transitions, Second: container assignments for scope, Third: container assignments for epic integrity
      // The filterByContainer also queries container assignments
      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events: transitionEvents, total: 3, query: {} })  // transitions
        .mockResolvedValueOnce({ events: containerAssignmentEvents, total: 2, query: {} }) // container assignments for scope
        .mockResolvedValueOnce({ events: containerAssignmentEvents, total: 2, query: {} }); // container assignments for epic integrity

      const result = await service.computeComplianceScore({ containerName: 'wave-001' });
      expect(result.metadata.totalTasks).toBe(2); // Only 42 and 43
    });
  });

  describe('dispose', () => {
    it('unsubscribes from event bus', async () => {
      service.dispose();

      // After dispose, emitting events should NOT clear cache
      await service.computeComplianceScore({ since: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' });

      eventBus.emit({ type: 'task.transition', timestamp: new Date().toISOString(), sessionId: 'x', actor: { type: 'ai-agent', id: 'x', name: 'x' }, issueNumber: 1, transition: 'start', fromStatus: 'A', toStatus: 'B', dryRun: false });

      await service.computeComplianceScore({ since: '2024-01-01T00:00:00Z', until: '2024-12-31T23:59:59Z' });

      // Should still use cache (only 2 calls from first invocation)
      expect(auditService.queryEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('metadata', () => {
    it('counts unique tasks correctly', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'review' }),
        makeTransitionEvent({ issueNumber: 43, transition: 'start' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 3, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.metadata.totalTransitions).toBe(3);
      expect(result.metadata.totalTasks).toBe(2);
    });

    it('includes computedAt timestamp', async () => {
      const result = await service.computeComplianceScore();
      expect(result.metadata.computedAt).toBeDefined();
      expect(new Date(result.metadata.computedAt).getTime()).not.toBeNaN();
    });
  });

  describe('summary', () => {
    it('says excellent for score >= 90', async () => {
      // Provide passing events so we don't hit the empty report path
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'review' }),
      ];
      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events, total: 2, query: {} })
        .mockResolvedValueOnce({ events: [], total: 0, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.summary).toContain('excellent');
    });

    it('says acceptable for score 70-89', async () => {
      // BRE=50 → total=80 → grade B
      const passing = { stepsRun: 1, stepsPassed: 1, stepsFailed: 0, stepsWarned: 0, details: [{ stepName: 'A', passed: true }] };
      const failing = { stepsRun: 1, stepsPassed: 0, stepsFailed: 1, stepsWarned: 0, details: [{ stepName: 'A', passed: false }] };
      const events = [
        ...Array.from({ length: 50 }, (_, i) => makeTransitionEvent({ issueNumber: i, validationResult: passing })),
        ...Array.from({ length: 50 }, (_, i) => makeTransitionEvent({ issueNumber: 50 + i, validationResult: failing })),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 100, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.summary).toContain('acceptable');
    });

    it('says needs attention for score < 70', async () => {
      const failing = { stepsRun: 1, stepsPassed: 0, stepsFailed: 1, stepsWarned: 0, details: [{ stepName: 'A', passed: false }] };
      const transitionEvents = Array.from({ length: 10 }, (_, i) =>
        makeTransitionEvent({ issueNumber: i, validationResult: failing }),
      );
      const containerEvents = Array.from({ length: 10 }, (_, i) =>
        makeContainerAssignmentEvent({ issueNumber: i, integrityMaintained: false }),
      );

      vi.mocked(auditService.queryEvents)
        .mockResolvedValueOnce({ events: transitionEvents, total: 10, query: {} })
        .mockResolvedValueOnce({ events: containerEvents, total: 10, query: {} });

      const result = await service.computeComplianceScore();
      expect(result.summary).toContain('needs attention');
    });
  });

  describe('cross-profile: non-standard closing transitions', () => {
    /**
     * These tests verify methodology-agnosticism by creating a profile where
     * the closing transition is 'finish' instead of 'approve'. If the engine
     * still hardcodes 'approve', these tests will fail.
     */
    const customProfile: MethodologyProfile = {
      ...HYDRO_PROFILE,
      id: 'test-custom',
      behaviors: {
        ...HYDRO_PROFILE.behaviors,
        closingTransitions: ['finish'],
      },
      compliance: {
        lifecycle: ['plan', 'start', 'review', 'finish'],
        weights: HYDRO_PROFILE.compliance.weights,
      },
    };
    let customService: ComplianceService;

    beforeEach(() => {
      customService = new ComplianceService(
        auditService, analyticsService, eventBus, logger, customProfile,
      );
    });

    it('recognizes "finish" (not "approve") as closing transition for quality gates', async () => {
      const events = [
        makeTransitionEvent({
          issueNumber: 42, transition: 'finish',
          validationResult: {
            stepsRun: 3, stepsPassed: 3, stepsFailed: 0, stepsWarned: 0,
            details: [
              { stepName: 'PRReviewValidation', passed: true },
              { stepName: 'TestCoverageValidation', passed: true },
              { stepName: 'SecurityScanValidation', passed: true },
            ],
          },
        }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 1, query: {} });

      const result = await customService.computeComplianceScore();
      expect(result.categories.qualityGates.score).toBe(100);
      expect(result.categories.qualityGates.detail).toContain('1/1');
    });

    it('ignores "approve" events when closing transition is "finish"', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'approve' }),
        makeTransitionEvent({ issueNumber: 43, transition: 'start' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await customService.computeComplianceScore();
      // 'approve' is NOT a closing transition in this profile, so quality gates should show "no closing transitions"
      expect(result.categories.qualityGates.detail).toContain('No closing transitions');
    });

    it('evaluates process adherence using "finish" as closing transition', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'plan' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'review' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'finish' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 4, query: {} });

      const result = await customService.computeComplianceScore();
      // Full lifecycle: plan, start, review, finish — all present = 100%
      expect(result.categories.processAdherence.score).toBe(100);
    });

    it('does not evaluate process adherence for tasks with only "approve" (not "finish")', async () => {
      const events = [
        makeTransitionEvent({ issueNumber: 42, transition: 'start' }),
        makeTransitionEvent({ issueNumber: 42, transition: 'approve' }),
      ];
      vi.mocked(auditService.queryEvents).mockResolvedValue({ events, total: 2, query: {} });

      const result = await customService.computeComplianceScore();
      // Task 42 has 'approve' but not 'finish' → not considered complete → excluded
      expect(result.categories.processAdherence.detail).toContain('No completed tasks');
    });
  });
});
