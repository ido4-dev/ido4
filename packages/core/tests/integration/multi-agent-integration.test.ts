/**
 * Integration test: Agent Teams + Task Locking + Audit Trail
 *
 * Verifies that:
 * 1. Multiple agents can register and work concurrently
 * 2. Task locking prevents concurrent access to the same task
 * 3. Agent identities appear distinctly in the audit trail
 * 4. TaskLockValidation warns when a locked task is being accessed by another agent
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AgentService } from '../../src/domains/agents/agent-service.js';
import { FileAgentStore } from '../../src/domains/agents/agent-store.js';
import { TaskLockValidation } from '../../src/domains/tasks/validation-steps/task-lock-validation.js';
import { InMemoryEventBus } from '../../src/shared/events/in-memory-event-bus.js';
import { AuditService } from '../../src/domains/audit/audit-service.js';
import { JsonlAuditStore } from '../../src/domains/audit/audit-store.js';
import { BusinessRuleError } from '../../src/shared/errors/index.js';
import type { TaskTransitionEvent } from '../../src/shared/events/types.js';
import type { ValidationContext } from '../../src/domains/tasks/types.js';
import { TestLogger } from '../helpers/test-logger.js';

describe('Multi-Agent Integration', () => {
  let tmpDir: string;
  let agentService: AgentService;
  let auditService: AuditService;
  let eventBus: InMemoryEventBus;
  let logger: TestLogger;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multi-agent-integration-'));
    await fs.mkdir(path.join(tmpDir, '.ido4'), { recursive: true });
    logger = new TestLogger();
    eventBus = new InMemoryEventBus();

    const agentStore = new FileAgentStore(tmpDir, logger);
    agentService = new AgentService(agentStore, logger);

    const auditStore = new JsonlAuditStore(tmpDir, logger);
    auditService = new AuditService(auditStore, eventBus, logger);
  });

  afterEach(async () => {
    auditService.dispose();
    eventBus.removeAllListeners();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('two agents register and lock different tasks', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Claude Alpha', role: 'coding' });
    await agentService.registerAgent({ agentId: 'agent-beta', name: 'Claude Beta', role: 'review' });

    const agents = await agentService.listAgents();
    expect(agents).toHaveLength(2);

    const lock1 = await agentService.lockTask('agent-alpha', 42);
    const lock2 = await agentService.lockTask('agent-beta', 43);

    expect(lock1.agentId).toBe('agent-alpha');
    expect(lock2.agentId).toBe('agent-beta');

    // Each agent can only see their own lock
    const lockFor42 = await agentService.getTaskLock(42);
    expect(lockFor42!.agentId).toBe('agent-alpha');
    const lockFor43 = await agentService.getTaskLock(43);
    expect(lockFor43!.agentId).toBe('agent-beta');
  });

  it('locking a task already locked by another agent throws', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });
    await agentService.registerAgent({ agentId: 'agent-beta', name: 'Beta', role: 'coding' });

    await agentService.lockTask('agent-alpha', 42);
    await expect(agentService.lockTask('agent-beta', 42)).rejects.toThrow(BusinessRuleError);
  });

  it('agent transitions produce distinct audit trails per actor', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });
    await agentService.registerAgent({ agentId: 'agent-beta', name: 'Beta', role: 'review' });

    // Each agent makes transitions on different tasks
    const emitTransition = (issueNumber: number, transition: string, actorId: string) => {
      const event: TaskTransitionEvent = {
        type: 'task.transition',
        issueNumber,
        transition,
        fromStatus: 'READY_FOR_DEV',
        toStatus: 'IN_PROGRESS',
        timestamp: new Date().toISOString(),
        sessionId: 'session-1',
        actor: { type: 'ai-agent', id: actorId, name: `Agent ${actorId}` },
        dryRun: false,
      };
      eventBus.emit(event);
    };

    emitTransition(42, 'start', 'agent-alpha');
    emitTransition(43, 'start', 'agent-beta');
    emitTransition(42, 'review', 'agent-alpha');

    await new Promise((r) => setTimeout(r, 50));

    // Query audit by agent
    const alphaAudit = await auditService.queryEvents({ actorId: 'agent-alpha' });
    expect(alphaAudit.events).toHaveLength(2);

    const betaAudit = await auditService.queryEvents({ actorId: 'agent-beta' });
    expect(betaAudit.events).toHaveLength(1);

    // Summary should show both actors
    const summary = await auditService.getSummary();
    expect(summary.byActor['agent-alpha']).toBe(2);
    expect(summary.byActor['agent-beta']).toBe(1);
  });

  it('TaskLockValidation warns when task locked by different agent', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });
    await agentService.lockTask('agent-alpha', 42);

    const validation = new TaskLockValidation(agentService);

    // Agent beta tries to validate a transition on task locked by alpha
    const context: ValidationContext = {
      issueNumber: 42,
      transition: 'start',
      task: {
        number: 42,
        title: 'Test Task',
        status: 'READY_FOR_DEV',
        labels: [],
        body: '',
        url: '',
        assignees: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      config: {} as ValidationContext['config'],
      workflowConfig: {} as ValidationContext['workflowConfig'],
      gitWorkflowConfig: {} as ValidationContext['gitWorkflowConfig'],
      actor: { type: 'ai-agent', id: 'agent-beta', name: 'Beta' },
    };

    const result = await validation.validate(context);
    expect(result.passed).toBe(true); // Warning, not blocker
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('agent-alpha');
  });

  it('TaskLockValidation passes for the lock holder', async () => {
    await agentService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });
    await agentService.lockTask('agent-alpha', 42);

    const validation = new TaskLockValidation(agentService);

    const context: ValidationContext = {
      issueNumber: 42,
      transition: 'start',
      task: {
        number: 42, title: 'Test', status: 'READY_FOR_DEV',
        labels: [], body: '', url: '', assignees: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      config: {} as ValidationContext['config'],
      workflowConfig: {} as ValidationContext['workflowConfig'],
      gitWorkflowConfig: {} as ValidationContext['gitWorkflowConfig'],
      actor: { type: 'ai-agent', id: 'agent-alpha', name: 'Alpha' },
    };

    const result = await validation.validate(context);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
    expect(result.message).toContain('current agent');
  });

  it('TaskLockValidation passes for unlocked task', async () => {
    const validation = new TaskLockValidation(agentService);

    const context: ValidationContext = {
      issueNumber: 99,
      transition: 'start',
      task: {
        number: 99, title: 'Test', status: 'READY_FOR_DEV',
        labels: [], body: '', url: '', assignees: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      config: {} as ValidationContext['config'],
      workflowConfig: {} as ValidationContext['workflowConfig'],
      gitWorkflowConfig: {} as ValidationContext['gitWorkflowConfig'],
    };

    const result = await validation.validate(context);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('info');
  });

  it('expired locks are auto-released allowing other agents', async () => {
    const shortTtlService = new AgentService(new FileAgentStore(tmpDir, logger), logger, 1); // 1ms TTL
    await shortTtlService.registerAgent({ agentId: 'agent-alpha', name: 'Alpha', role: 'coding' });
    await shortTtlService.registerAgent({ agentId: 'agent-beta', name: 'Beta', role: 'coding' });

    await shortTtlService.lockTask('agent-alpha', 42);

    // Wait for lock to expire
    await new Promise((r) => setTimeout(r, 10));

    // Beta should now be able to lock it (expired lock auto-released)
    const lock = await shortTtlService.lockTask('agent-beta', 42);
    expect(lock.agentId).toBe('agent-beta');
  });
});
