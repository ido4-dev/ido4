/**
 * IAuditStore / FileAgentStore — Persistence for agent registrations and task locks.
 *
 * Stores data in `.ido4/agent-locks.json` for crash recovery.
 * In-memory Map is the primary store; file is written on each mutation.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { ILogger } from '../../shared/logger.js';

export interface AgentRegistration {
  agentId: string;
  name: string;
  role: 'coding' | 'review' | 'testing' | 'documentation' | 'general';
  capabilities?: string[];
}

export interface RegisteredAgent extends AgentRegistration {
  registeredAt: string;
  lastHeartbeat: string;
}

export interface TaskLock {
  issueNumber: number;
  agentId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface AgentStoreData {
  agents: Record<string, RegisteredAgent>;
  locks: Record<number, TaskLock>;
}

export interface IAgentStore {
  load(): Promise<AgentStoreData>;
  save(data: AgentStoreData): Promise<void>;
}

export class FileAgentStore implements IAgentStore {
  private readonly filePath: string;

  constructor(
    projectRoot: string,
    private readonly logger: ILogger,
  ) {
    this.filePath = path.join(projectRoot, '.ido4', 'agent-locks.json');
  }

  async load(): Promise<AgentStoreData> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as AgentStoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { agents: {}, locks: {} };
      }
      this.logger.warn('Failed to load agent store, using empty state', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { agents: {}, locks: {} };
    }
  }

  async save(data: AgentStoreData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
