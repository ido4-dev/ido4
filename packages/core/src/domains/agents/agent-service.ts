/**
 * AgentService — Multi-agent registration, task locking, and lifecycle management.
 *
 * Provides agent registration with unique identity, task locking via in-memory Map
 * (single-process, race-condition-free), with file persistence for crash recovery.
 */

import type { ILogger } from '../../shared/logger.js';
import type {
  IAgentStore,
  AgentRegistration,
  RegisteredAgent,
  TaskLock,
  AgentStoreData,
} from './agent-store.js';
import { BusinessRuleError, NotFoundError } from '../../shared/errors/index.js';

const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes
const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export interface IAgentService {
  registerAgent(registration: AgentRegistration): Promise<RegisteredAgent>;
  getAgent(agentId: string): Promise<RegisteredAgent | null>;
  listAgents(): Promise<RegisteredAgent[]>;
  lockTask(agentId: string, issueNumber: number): Promise<TaskLock>;
  releaseTask(agentId: string, issueNumber: number): Promise<void>;
  getTaskLock(issueNumber: number): Promise<TaskLock | null>;
  releaseExpiredLocks(): Promise<number>;
  heartbeat(agentId: string): Promise<void>;
}

export class AgentService implements IAgentService {
  private data: AgentStoreData = { agents: {}, locks: {} };
  private initialized = false;
  private readonly lockTtlMs: number;

  constructor(
    private readonly store: IAgentStore,
    private readonly logger: ILogger,
    lockTtlMs?: number,
  ) {
    this.lockTtlMs = lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  }

  async registerAgent(registration: AgentRegistration): Promise<RegisteredAgent> {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    const agent: RegisteredAgent = {
      ...registration,
      registeredAt: now,
      lastHeartbeat: now,
    };

    this.data.agents[registration.agentId] = agent;
    await this.persist();

    this.logger.info('Agent registered', { agentId: registration.agentId, role: registration.role });
    return agent;
  }

  async getAgent(agentId: string): Promise<RegisteredAgent | null> {
    await this.ensureInitialized();
    return this.data.agents[agentId] ?? null;
  }

  async listAgents(): Promise<RegisteredAgent[]> {
    await this.ensureInitialized();
    return Object.values(this.data.agents);
  }

  async lockTask(agentId: string, issueNumber: number): Promise<TaskLock> {
    await this.ensureInitialized();

    // Verify agent exists
    const agent = this.data.agents[agentId];
    if (!agent) {
      throw new NotFoundError({
        message: `Agent "${agentId}" not registered`,
        resource: 'agent',
        identifier: agentId,
        remediation: 'Register the agent first with register_agent.',
      });
    }

    // Release expired locks first
    await this.releaseExpiredLocks();

    // Check existing lock
    const existing = this.data.locks[issueNumber];
    if (existing) {
      if (existing.agentId === agentId) {
        // Same agent — extend the lock
        existing.expiresAt = new Date(Date.now() + this.lockTtlMs).toISOString();
        await this.persist();
        return existing;
      }

      throw new BusinessRuleError({
        message: `Task #${issueNumber} is locked by agent "${existing.agentId}"`,
        rule: 'TaskLockExclusion',
        context: { issueNumber, lockedBy: existing.agentId, expiresAt: existing.expiresAt },
        remediation: `Wait for agent "${existing.agentId}" to release the task, or wait for lock expiry at ${existing.expiresAt}.`,
      });
    }

    const lock: TaskLock = {
      issueNumber,
      agentId,
      acquiredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.lockTtlMs).toISOString(),
    };

    this.data.locks[issueNumber] = lock;
    await this.persist();

    this.logger.info('Task locked', { agentId, issueNumber });
    return lock;
  }

  async releaseTask(agentId: string, issueNumber: number): Promise<void> {
    await this.ensureInitialized();

    const lock = this.data.locks[issueNumber];
    if (!lock) return; // No lock to release

    if (lock.agentId !== agentId) {
      throw new BusinessRuleError({
        message: `Task #${issueNumber} is locked by agent "${lock.agentId}", not "${agentId}"`,
        rule: 'TaskLockOwnership',
        context: { issueNumber, lockedBy: lock.agentId, requestedBy: agentId },
        remediation: 'Only the agent that acquired the lock can release it.',
      });
    }

    delete this.data.locks[issueNumber];
    await this.persist();

    this.logger.info('Task released', { agentId, issueNumber });
  }

  async getTaskLock(issueNumber: number): Promise<TaskLock | null> {
    await this.ensureInitialized();

    const lock = this.data.locks[issueNumber];
    if (!lock) return null;

    // Check if expired
    if (new Date(lock.expiresAt) < new Date()) {
      delete this.data.locks[issueNumber];
      await this.persist();
      return null;
    }

    return lock;
  }

  async releaseExpiredLocks(): Promise<number> {
    await this.ensureInitialized();

    const now = new Date();
    let released = 0;

    for (const [key, lock] of Object.entries(this.data.locks)) {
      if (new Date(lock.expiresAt) < now) {
        delete this.data.locks[Number(key)];
        released++;
        this.logger.info('Expired lock released', { agentId: lock.agentId, issueNumber: lock.issueNumber });
      }
    }

    if (released > 0) {
      await this.persist();
    }

    return released;
  }

  async heartbeat(agentId: string): Promise<void> {
    await this.ensureInitialized();

    const agent = this.data.agents[agentId];
    if (!agent) {
      throw new NotFoundError({
        message: `Agent "${agentId}" not registered`,
        resource: 'agent',
        identifier: agentId,
      });
    }

    agent.lastHeartbeat = new Date().toISOString();
    await this.persist();
  }

  isAgentStale(agent: RegisteredAgent): boolean {
    const lastHeartbeat = new Date(agent.lastHeartbeat).getTime();
    return Date.now() - lastHeartbeat > STALE_THRESHOLD_MS;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.data = await this.store.load();
      this.initialized = true;
    }
  }

  private async persist(): Promise<void> {
    await this.store.save(this.data);
  }
}
