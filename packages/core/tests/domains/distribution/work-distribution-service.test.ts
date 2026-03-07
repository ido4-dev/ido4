/**
 * WorkDistributionService tests — verifies scoring algorithm, candidate filtering,
 * handoff coordination, and audit event emission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkDistributionService } from '../../../src/domains/distribution/work-distribution-service.js';
import { InMemoryEventBus } from '../../../src/shared/events/in-memory-event-bus.js';
import { NoopLogger } from '../../../src/shared/noop-logger.js';
import type { TaskData, RegisteredAgent } from '../../../src/container/interfaces.js';

// ─── Helpers ───

function makeTask(overrides: Partial<TaskData> & { number: number }): TaskData {
  return {
    id: `ID_${overrides.number}`,
    itemId: `ITEM_${overrides.number}`,
    title: overrides.title ?? `Task #${overrides.number}`,
    body: '',
    status: overrides.status ?? 'Ready for Dev',
    number: overrides.number,
    wave: overrides.wave ?? 'wave-001',
    epic: overrides.epic,
    dependencies: overrides.dependencies,
    taskType: overrides.taskType,
    riskLevel: overrides.riskLevel,
    effort: overrides.effort,
    ...overrides,
  };
}

function createMocks() {
  const eventBus = new InMemoryEventBus();
  const logger = new NoopLogger();

  const waveService = {
    listWaves: vi.fn().mockResolvedValue([
      { name: 'wave-001', status: 'active', taskCount: 5, completedCount: 1, completionPercentage: 20 },
    ]),
    getWaveStatus: vi.fn().mockResolvedValue({
      name: 'wave-001',
      tasks: [],
      metrics: { total: 0, completed: 0, inProgress: 0, blocked: 0, ready: 0 },
    }),
  };

  const agentService = {
    getAgent: vi.fn().mockResolvedValue(null),
    getTaskLock: vi.fn().mockResolvedValue(null),
    listAgents: vi.fn().mockResolvedValue([]),
    releaseTask: vi.fn().mockResolvedValue(undefined),
  };

  const taskService = {
    approveTask: vi.fn().mockResolvedValue({ success: true, data: { issueNumber: 0, fromStatus: 'In Review', toStatus: 'Done' } }),
    getTask: vi.fn().mockResolvedValue(makeTask({ number: 1 })),
  };

  const auditService = {
    queryEvents: vi.fn().mockResolvedValue({ events: [], total: 0, query: {} }),
  };

  const service = new WorkDistributionService(
    waveService as any,
    agentService as any,
    taskService as any,
    auditService as any,
    eventBus,
    'test-session',
    logger,
  );

  return { service, waveService, agentService, taskService, auditService, eventBus };
}

// ─── Tests ───

describe('WorkDistributionService', () => {
  describe('getNextTask', () => {
    it('returns null recommendation when no candidates exist', async () => {
      const { service, waveService } = createMocks();
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [makeTask({ number: 1, status: 'Done' }), makeTask({ number: 2, status: 'In Progress' })],
        metrics: { total: 2, completed: 1, inProgress: 1, blocked: 0, ready: 0 },
      });

      const result = await service.getNextTask('agent-alpha', 'wave-001');

      expect(result.recommendation).toBeNull();
      expect(result.alternatives).toHaveLength(0);
      expect(result.context.totalCandidates).toBe(0);
    });

    it('filters to Ready and Refinement tasks only', async () => {
      const { service, waveService } = createMocks();
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 1, status: 'Done' }),
          makeTask({ number: 2, status: 'In Progress' }),
          makeTask({ number: 3, status: 'Blocked' }),
          makeTask({ number: 4, status: 'Ready for Dev' }),
          makeTask({ number: 5, status: 'In Refinement' }),
          makeTask({ number: 6, status: 'In Review' }),
        ],
        metrics: {},
      });

      const result = await service.getNextTask('agent-alpha', 'wave-001');

      expect(result.context.totalCandidates).toBe(2);
      const recommended = [
        result.recommendation?.issueNumber,
        ...result.alternatives.map((a) => a.issueNumber),
      ];
      expect(recommended).not.toContain(1); // Done
      expect(recommended).not.toContain(2); // In Progress
      expect(recommended).not.toContain(3); // Blocked
    });

    it('excludes tasks locked by other agents', async () => {
      const { service, waveService, agentService } = createMocks();
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 10, status: 'Ready for Dev' }),
          makeTask({ number: 11, status: 'Ready for Dev' }),
        ],
        metrics: {},
      });
      agentService.getTaskLock.mockImplementation(async (issueNumber: number) => {
        if (issueNumber === 10) return { issueNumber: 10, agentId: 'other-agent', acquiredAt: '', expiresAt: '' };
        return null;
      });

      const result = await service.getNextTask('agent-alpha', 'wave-001');

      expect(result.context.totalCandidates).toBe(1);
      expect(result.recommendation?.issueNumber).toBe(11);
      expect(result.context.lockedTasks).toContain(10);
    });

    it('allows tasks locked by the requesting agent', async () => {
      const { service, waveService, agentService } = createMocks();
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [makeTask({ number: 10, status: 'Ready for Dev' })],
        metrics: {},
      });
      agentService.getTaskLock.mockResolvedValue({ issueNumber: 10, agentId: 'agent-alpha', acquiredAt: '', expiresAt: '' });

      const result = await service.getNextTask('agent-alpha', 'wave-001');

      expect(result.context.totalCandidates).toBe(1);
      expect(result.recommendation?.issueNumber).toBe(10);
    });

    it('auto-detects active wave when waveName not provided', async () => {
      const { service, waveService } = createMocks();
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [makeTask({ number: 1, status: 'Ready for Dev' })],
        metrics: {},
      });

      const result = await service.getNextTask('agent-alpha');

      expect(waveService.listWaves).toHaveBeenCalled();
      expect(result.context.activeWave).toBe('wave-001');
    });

    it('throws when no active wave exists and none provided', async () => {
      const { service, waveService } = createMocks();
      waveService.listWaves.mockResolvedValue([
        { name: 'wave-001', status: 'completed', taskCount: 5, completedCount: 5, completionPercentage: 100 },
      ]);

      await expect(service.getNextTask('agent-alpha')).rejects.toThrow('No active wave');
    });

    describe('cascade scoring', () => {
      it('scores higher for tasks that unblock more downstream tasks', async () => {
        const { service, waveService } = createMocks();
        // Task 1 (Ready) unblocks tasks 3 and 4 (they depend on #1)
        // Task 2 (Ready) unblocks nothing
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev' }),
            makeTask({ number: 2, status: 'Ready for Dev' }),
            makeTask({ number: 3, status: 'Blocked', dependencies: '#1' }),
            makeTask({ number: 4, status: 'Blocked', dependencies: '#1' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation?.issueNumber).toBe(1);
        expect(result.recommendation!.scoreBreakdown.cascadeValue).toBeGreaterThan(0);
        const task2 = result.alternatives.find((a) => a.issueNumber === 2);
        expect(task2?.scoreBreakdown.cascadeValue).toBe(0);
      });

      it('gives higher cascade score for depth-1 than depth-2 dependents', async () => {
        const { service, waveService } = createMocks();
        // Task 1 -> Task 2 (depth 1) -> Task 3 (depth 2)
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev' }),
            makeTask({ number: 2, status: 'Blocked', dependencies: '#1' }),
            makeTask({ number: 3, status: 'Blocked', dependencies: '#2' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation?.issueNumber).toBe(1);
        // Score should be 15 (depth-1 for #2) + 8 (depth-2 for #3) = 23
        expect(result.recommendation!.scoreBreakdown.cascadeValue).toBe(23);
      });

      it('caps cascade score at 40', async () => {
        const { service, waveService } = createMocks();
        // Task 1 unblocks many tasks
        const dependents = Array.from({ length: 5 }, (_, i) =>
          makeTask({ number: i + 2, status: 'Blocked', dependencies: '#1' }),
        );
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Ready for Dev' }), ...dependents],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.scoreBreakdown.cascadeValue).toBeLessThanOrEqual(40);
      });
    });

    describe('epic momentum scoring', () => {
      it('scores higher for tasks in nearly-complete epics', async () => {
        const { service, waveService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            // Epic A: 3/4 done — high momentum
            makeTask({ number: 1, status: 'Done', epic: 'Epic A' }),
            makeTask({ number: 2, status: 'Done', epic: 'Epic A' }),
            makeTask({ number: 3, status: 'Done', epic: 'Epic A' }),
            makeTask({ number: 4, status: 'Ready for Dev', epic: 'Epic A' }),
            // Epic B: 0/3 done — no momentum
            makeTask({ number: 5, status: 'Ready for Dev', epic: 'Epic B' }),
            makeTask({ number: 6, status: 'Blocked', epic: 'Epic B' }),
            makeTask({ number: 7, status: 'Blocked', epic: 'Epic B' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        // Task 4 should win on epic momentum (last task in epic = max 25)
        const task4 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 4);
        const task5 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 5);
        expect(task4!.scoreBreakdown.epicMomentum).toBeGreaterThan(task5!.scoreBreakdown.epicMomentum);
      });

      it('gives max score to the last remaining task in an epic', async () => {
        const { service, waveService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Done', epic: 'Epic A' }),
            makeTask({ number: 2, status: 'Ready for Dev', epic: 'Epic A' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.scoreBreakdown.epicMomentum).toBe(25);
      });

      it('returns 0 for tasks without an epic', async () => {
        const { service, waveService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Ready for Dev' })], // no epic
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.scoreBreakdown.epicMomentum).toBe(0);
      });
    });

    describe('capability matching', () => {
      it('scores neutral (10) when agent has no registration', async () => {
        const { service, waveService, agentService } = createMocks();
        agentService.getAgent.mockResolvedValue(null);
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Ready for Dev' })],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.scoreBreakdown.capabilityMatch).toBe(10);
      });

      it('scores higher for matching role and task type', async () => {
        const { service, waveService, agentService } = createMocks();
        agentService.getAgent.mockResolvedValue({
          agentId: 'agent-alpha', name: 'Alpha', role: 'coding',
          registeredAt: '', lastHeartbeat: '',
        } as RegisteredAgent);

        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev', taskType: 'FEATURE' }),
            makeTask({ number: 2, status: 'Ready for Dev', taskType: 'DOCUMENTATION' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        const task1 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 1);
        const task2 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 2);
        expect(task1!.scoreBreakdown.capabilityMatch).toBeGreaterThan(task2!.scoreBreakdown.capabilityMatch);
      });

      it('scores higher when agent capabilities match task title keywords', async () => {
        const { service, waveService, agentService } = createMocks();
        agentService.getAgent.mockResolvedValue({
          agentId: 'agent-alpha', name: 'Alpha', role: 'coding',
          capabilities: ['backend', 'api'],
          registeredAt: '', lastHeartbeat: '',
        } as RegisteredAgent);

        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev', title: 'Implement backend API endpoint' }),
            makeTask({ number: 2, status: 'Ready for Dev', title: 'Style the landing page' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        const task1 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 1);
        const task2 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 2);
        expect(task1!.scoreBreakdown.capabilityMatch).toBeGreaterThan(task2!.scoreBreakdown.capabilityMatch);
      });

      it('caps capability score at 20', async () => {
        const { service, waveService, agentService } = createMocks();
        agentService.getAgent.mockResolvedValue({
          agentId: 'agent-alpha', name: 'Alpha', role: 'coding',
          capabilities: ['data', 'pipeline'],
          registeredAt: '', lastHeartbeat: '',
        } as RegisteredAgent);

        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Ready for Dev', title: 'Data pipeline feature', taskType: 'FEATURE', riskLevel: 'CRITICAL' })],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.scoreBreakdown.capabilityMatch).toBeLessThanOrEqual(20);
      });
    });

    describe('dependency freshness scoring', () => {
      it('scores higher when dependencies were recently completed', async () => {
        const { service, waveService, auditService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Done' }),
            makeTask({ number: 2, status: 'Ready for Dev', dependencies: '#1' }),
            makeTask({ number: 3, status: 'Ready for Dev' }), // no dependencies
          ],
          metrics: {},
        });

        // Task #1 was recently approved
        auditService.queryEvents.mockResolvedValue({
          events: [{
            id: 1,
            event: { type: 'task.transition', transition: 'approve', issueNumber: 1, timestamp: new Date().toISOString(), sessionId: 'test', actor: { type: 'ai-agent', id: 'test' } },
            persistedAt: new Date().toISOString(),
          }],
          total: 1,
          query: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        const task2 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 2);
        const task3 = [result.recommendation, ...result.alternatives].find((r) => r?.issueNumber === 3);
        expect(task2!.scoreBreakdown.dependencyFreshness).toBeGreaterThan(0);
        expect(task3!.scoreBreakdown.dependencyFreshness).toBe(0);
      });

      it('returns 0 freshness for tasks with no dependencies', async () => {
        const { service, waveService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Ready for Dev' })],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.scoreBreakdown.dependencyFreshness).toBe(0);
      });
    });

    describe('result structure', () => {
      it('returns up to 3 alternatives', async () => {
        const { service, waveService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev' }),
            makeTask({ number: 2, status: 'Ready for Dev' }),
            makeTask({ number: 3, status: 'Ready for Dev' }),
            makeTask({ number: 4, status: 'Ready for Dev' }),
            makeTask({ number: 5, status: 'Ready for Dev' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation).not.toBeNull();
        expect(result.alternatives.length).toBeLessThanOrEqual(3);
      });

      it('includes reasoning in recommendation', async () => {
        const { service, waveService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev' }),
            makeTask({ number: 2, status: 'Blocked', dependencies: '#1' }),
          ],
          metrics: {},
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.recommendation!.reasoning).toContain('Unblocks');
        expect(result.recommendation!.reasoning).toContain('#2');
      });

      it('includes context with locked tasks', async () => {
        const { service, waveService, agentService } = createMocks();
        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [
            makeTask({ number: 1, status: 'Ready for Dev' }),
            makeTask({ number: 2, status: 'In Progress' }),
          ],
          metrics: {},
        });
        agentService.getTaskLock.mockImplementation(async (num: number) => {
          if (num === 2) return { issueNumber: 2, agentId: 'other', acquiredAt: '', expiresAt: '' };
          return null;
        });

        const result = await service.getNextTask('agent-alpha', 'wave-001');

        expect(result.context.lockedTasks).toContain(2);
        expect(result.context.agentId).toBe('agent-alpha');
        expect(result.context.activeWave).toBe('wave-001');
      });
    });

    describe('audit events', () => {
      it('emits work.recommendation event', async () => {
        const { service, waveService, eventBus } = createMocks();
        const emitted: any[] = [];
        eventBus.on('work.recommendation', (event) => emitted.push(event));

        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Ready for Dev' })],
          metrics: {},
        });

        await service.getNextTask('agent-alpha', 'wave-001');

        expect(emitted).toHaveLength(1);
        expect(emitted[0].agentId).toBe('agent-alpha');
        expect(emitted[0].recommendedIssue).toBe(1);
        expect(emitted[0].waveName).toBe('wave-001');
      });

      it('emits event with null recommendation when no candidates', async () => {
        const { service, waveService, eventBus } = createMocks();
        const emitted: any[] = [];
        eventBus.on('work.recommendation', (event) => emitted.push(event));

        waveService.getWaveStatus.mockResolvedValue({
          name: 'wave-001',
          tasks: [makeTask({ number: 1, status: 'Done' })],
          metrics: {},
        });

        await service.getNextTask('agent-alpha', 'wave-001');

        expect(emitted).toHaveLength(1);
        expect(emitted[0].recommendedIssue).toBeNull();
        expect(emitted[0].totalCandidates).toBe(0);
      });
    });
  });

  describe('completeAndHandoff', () => {
    it('approves the task and releases the lock', async () => {
      const { service, waveService, taskService, agentService } = createMocks();
      taskService.getTask.mockResolvedValue(makeTask({ number: 42, title: 'Build API', status: 'Done' }));
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [makeTask({ number: 42, status: 'Done' })],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(taskService.approveTask).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 42 }));
      expect(agentService.releaseTask).toHaveBeenCalledWith('agent-alpha', 42);
    });

    it('identifies newly-unblocked downstream tasks', async () => {
      const { service, waveService, taskService } = createMocks();
      taskService.getTask.mockResolvedValue(makeTask({ number: 42, title: 'Build API', status: 'Done' }));

      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 42, status: 'Done' }),
          makeTask({ number: 43, status: 'Blocked', dependencies: '#42', title: 'Use API' }),
        ],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      const result = await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(result.completed.issueNumber).toBe(42);
      expect(result.newlyUnblocked).toHaveLength(1);
      expect(result.newlyUnblocked[0]!.issueNumber).toBe(43);
    });

    it('does not report tasks with unsatisfied dependencies as unblocked', async () => {
      const { service, waveService, taskService } = createMocks();
      taskService.getTask.mockResolvedValue(makeTask({ number: 42, status: 'Done' }));

      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 42, status: 'Done' }),
          makeTask({ number: 41, status: 'In Progress' }), // NOT done
          makeTask({ number: 43, status: 'Blocked', dependencies: '#42, #41' }), // needs both
        ],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      const result = await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(result.newlyUnblocked).toHaveLength(0);
    });

    it('continues gracefully if lock release fails', async () => {
      const { service, waveService, taskService, agentService } = createMocks();
      taskService.getTask.mockResolvedValue(makeTask({ number: 42, status: 'Done' }));
      agentService.releaseTask.mockRejectedValue(new Error('No lock'));
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [makeTask({ number: 42, status: 'Done' })],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      // Should not throw
      const result = await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(result.completed.issueNumber).toBe(42);
    });

    it('returns next task recommendation for the completing agent', async () => {
      const { service, waveService, taskService } = createMocks();
      taskService.getTask.mockResolvedValue(makeTask({ number: 42, status: 'Done' }));
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 42, status: 'Done' }),
          makeTask({ number: 50, status: 'Ready for Dev', title: 'Next task' }),
        ],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      const result = await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(result.agentNextTask.recommendation).not.toBeNull();
      expect(result.agentNextTask.recommendation!.issueNumber).toBe(50);
    });

    it('emits work.handoff event', async () => {
      const { service, waveService, taskService, eventBus } = createMocks();
      const emitted: any[] = [];
      eventBus.on('work.handoff', (event) => emitted.push(event));

      taskService.getTask.mockResolvedValue(makeTask({ number: 42, status: 'Done' }));
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 42, status: 'Done' }),
          makeTask({ number: 43, status: 'Blocked', dependencies: '#42' }),
        ],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(emitted).toHaveLength(1);
      expect(emitted[0].completedIssue).toBe(42);
      expect(emitted[0].agentId).toBe('agent-alpha');
      expect(emitted[0].newlyUnblocked).toContain(43);
    });

    it('suggests agent for newly-unblocked tasks', async () => {
      const { service, waveService, taskService, agentService } = createMocks();
      taskService.getTask.mockResolvedValue(makeTask({ number: 42, status: 'Done' }));
      agentService.listAgents.mockResolvedValue([
        { agentId: 'agent-alpha', name: 'Alpha', role: 'coding', registeredAt: '', lastHeartbeat: '' },
        { agentId: 'agent-beta', name: 'Beta', role: 'coding', registeredAt: '', lastHeartbeat: '' },
      ]);

      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 42, status: 'Done' }),
          makeTask({ number: 43, status: 'Blocked', dependencies: '#42', title: 'Frontend task', taskType: 'FEATURE' }),
        ],
        metrics: {},
      });

      const actor = { type: 'ai-agent' as const, id: 'agent-alpha', name: 'Alpha' };
      const result = await service.completeAndHandoff(42, 'agent-alpha', actor);

      expect(result.newlyUnblocked).toHaveLength(1);
      // Should suggest beta (since alpha is excluded as the completing agent)
      expect(result.newlyUnblocked[0]!.recommendedAgent).toBe('agent-beta');
      expect(result.newlyUnblocked[0]!.reasoning).toBeTruthy();
    });
  });

  describe('composite scoring', () => {
    it('combines all dimensions to pick the highest-leverage task', async () => {
      const { service, waveService, auditService } = createMocks();

      // Task 10: unblocks 2 tasks (cascade=30), in 80% done epic (momentum=20)
      // Task 11: unblocks 0, no epic, but has fresh dependency
      waveService.getWaveStatus.mockResolvedValue({
        name: 'wave-001',
        tasks: [
          makeTask({ number: 10, status: 'Ready for Dev', epic: 'Auth' }),
          makeTask({ number: 11, status: 'Ready for Dev', dependencies: '#99' }),
          makeTask({ number: 12, status: 'Blocked', dependencies: '#10' }),
          makeTask({ number: 13, status: 'Blocked', dependencies: '#10' }),
          // Epic Auth context: 3 done + task 10 ready = last task
          makeTask({ number: 20, status: 'Done', epic: 'Auth' }),
          makeTask({ number: 21, status: 'Done', epic: 'Auth' }),
          makeTask({ number: 22, status: 'Done', epic: 'Auth' }),
        ],
        metrics: {},
      });

      auditService.queryEvents.mockResolvedValue({
        events: [{
          id: 1,
          event: { type: 'task.transition', transition: 'approve', issueNumber: 99, timestamp: new Date().toISOString(), sessionId: 'test', actor: { type: 'ai-agent', id: 'test' } },
          persistedAt: new Date().toISOString(),
        }],
        total: 1,
        query: {},
      });

      const result = await service.getNextTask('agent-alpha', 'wave-001');

      // Task 10 should win: cascade (30) + epic momentum (25, last task) = 55 vs task 11's freshness (15)
      expect(result.recommendation!.issueNumber).toBe(10);
      expect(result.recommendation!.score).toBeGreaterThan(
        result.alternatives.find((a) => a.issueNumber === 11)?.score ?? 0,
      );
    });
  });
});
