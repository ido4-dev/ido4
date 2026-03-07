import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../../../src/domains/agents/agent-service.js';
import type { IAgentStore, AgentStoreData } from '../../../src/domains/agents/agent-store.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { BusinessRuleError, NotFoundError } from '../../../src/shared/errors/index.js';

function createMockStore(): IAgentStore {
  const data: AgentStoreData = { agents: {}, locks: {} };
  return {
    load: vi.fn().mockResolvedValue(data),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentService', () => {
  let store: ReturnType<typeof createMockStore>;
  let logger: TestLogger;
  let service: AgentService;

  beforeEach(() => {
    store = createMockStore();
    logger = new TestLogger();
    service = new AgentService(store, logger, 5000); // 5s TTL for testing
  });

  describe('registerAgent', () => {
    it('registers an agent and returns it', async () => {
      const agent = await service.registerAgent({
        agentId: 'agent-1',
        name: 'Claude Alpha',
        role: 'coding',
        capabilities: ['typescript', 'react'],
      });

      expect(agent.agentId).toBe('agent-1');
      expect(agent.name).toBe('Claude Alpha');
      expect(agent.role).toBe('coding');
      expect(agent.registeredAt).toBeDefined();
      expect(agent.lastHeartbeat).toBeDefined();
      expect(store.save).toHaveBeenCalled();
    });

    it('appears in agent list after registration', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await service.registerAgent({ agentId: 'agent-2', name: 'A2', role: 'review' });

      const agents = await service.listAgents();
      expect(agents).toHaveLength(2);
    });
  });

  describe('getAgent', () => {
    it('returns null for unregistered agent', async () => {
      const agent = await service.getAgent('nonexistent');
      expect(agent).toBeNull();
    });

    it('returns registered agent', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });

      const agent = await service.getAgent('agent-1');
      expect(agent).not.toBeNull();
      expect(agent!.agentId).toBe('agent-1');
    });
  });

  describe('lockTask', () => {
    it('locks a task for a registered agent', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });

      const lock = await service.lockTask('agent-1', 42);

      expect(lock.issueNumber).toBe(42);
      expect(lock.agentId).toBe('agent-1');
      expect(lock.acquiredAt).toBeDefined();
      expect(lock.expiresAt).toBeDefined();
    });

    it('throws NotFoundError for unregistered agent', async () => {
      await expect(service.lockTask('unknown', 42)).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when task locked by different agent', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await service.registerAgent({ agentId: 'agent-2', name: 'A2', role: 'review' });

      await service.lockTask('agent-1', 42);
      await expect(service.lockTask('agent-2', 42)).rejects.toThrow(BusinessRuleError);
    });

    it('extends lock when same agent re-locks', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });

      const lock1 = await service.lockTask('agent-1', 42);
      const lock2 = await service.lockTask('agent-1', 42);

      expect(lock2.agentId).toBe('agent-1');
      // Extended lock should have later or equal expiry
      expect(new Date(lock2.expiresAt).getTime()).toBeGreaterThanOrEqual(
        new Date(lock1.expiresAt).getTime(),
      );
    });

    it('getTaskLock returns the lock', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await service.lockTask('agent-1', 42);

      const lock = await service.getTaskLock(42);
      expect(lock).not.toBeNull();
      expect(lock!.agentId).toBe('agent-1');
    });

    it('getTaskLock returns null for unlocked task', async () => {
      const lock = await service.getTaskLock(42);
      expect(lock).toBeNull();
    });
  });

  describe('releaseTask', () => {
    it('releases a lock held by the agent', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await service.lockTask('agent-1', 42);

      await service.releaseTask('agent-1', 42);

      const lock = await service.getTaskLock(42);
      expect(lock).toBeNull();
    });

    it('throws BusinessRuleError when releasing another agent\'s lock', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await service.registerAgent({ agentId: 'agent-2', name: 'A2', role: 'review' });
      await service.lockTask('agent-1', 42);

      await expect(service.releaseTask('agent-2', 42)).rejects.toThrow(BusinessRuleError);
    });

    it('no-ops when releasing unlocked task', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await expect(service.releaseTask('agent-1', 42)).resolves.not.toThrow();
    });
  });

  describe('expired locks', () => {
    it('auto-releases expired locks on getTaskLock', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });

      // Use a very short TTL
      const shortService = new AgentService(store, logger, 1); // 1ms TTL
      await shortService.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await shortService.lockTask('agent-1', 42);

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10));

      const lock = await shortService.getTaskLock(42);
      expect(lock).toBeNull();
    });

    it('releaseExpiredLocks returns count of released', async () => {
      const shortService = new AgentService(store, logger, 1); // 1ms TTL
      await shortService.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });
      await shortService.lockTask('agent-1', 42);
      await shortService.lockTask('agent-1', 43);

      await new Promise((r) => setTimeout(r, 10));

      const released = await shortService.releaseExpiredLocks();
      expect(released).toBe(2);
    });
  });

  describe('heartbeat', () => {
    it('updates lastHeartbeat timestamp', async () => {
      await service.registerAgent({ agentId: 'agent-1', name: 'A1', role: 'coding' });

      const before = (await service.getAgent('agent-1'))!.lastHeartbeat;
      await new Promise((r) => setTimeout(r, 5));
      await service.heartbeat('agent-1');
      const after = (await service.getAgent('agent-1'))!.lastHeartbeat;

      expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
    });

    it('throws NotFoundError for unregistered agent', async () => {
      await expect(service.heartbeat('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('stale detection', () => {
    it('detects agent as stale after threshold', () => {
      const staleAgent = {
        agentId: 'agent-1',
        name: 'A1',
        role: 'coding' as const,
        registeredAt: '2024-01-01T00:00:00Z',
        lastHeartbeat: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      };

      expect(service.isAgentStale(staleAgent)).toBe(true);
    });

    it('detects recent agent as not stale', () => {
      const freshAgent = {
        agentId: 'agent-1',
        name: 'A1',
        role: 'coding' as const,
        registeredAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
      };

      expect(service.isAgentStale(freshAgent)).toBe(false);
    });
  });
});
