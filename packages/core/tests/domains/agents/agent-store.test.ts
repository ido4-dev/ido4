import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileAgentStore } from '../../../src/domains/agents/agent-store.js';
import type { AgentStoreData } from '../../../src/domains/agents/agent-store.js';
import { TestLogger } from '../../helpers/test-logger.js';

describe('FileAgentStore', () => {
  let tmpDir: string;
  let store: FileAgentStore;
  let logger: TestLogger;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-store-test-'));
    logger = new TestLogger();
    store = new FileAgentStore(tmpDir, logger);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty state when file does not exist', async () => {
    const data = await store.load();
    expect(data.agents).toEqual({});
    expect(data.locks).toEqual({});
  });

  it('saves and loads data', async () => {
    const data: AgentStoreData = {
      agents: {
        'agent-1': {
          agentId: 'agent-1',
          name: 'Claude Alpha',
          role: 'coding',
          registeredAt: '2024-01-01T00:00:00Z',
          lastHeartbeat: '2024-01-01T00:00:00Z',
        },
      },
      locks: {
        42: {
          issueNumber: 42,
          agentId: 'agent-1',
          acquiredAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-01-01T00:30:00Z',
        },
      },
    };

    await store.save(data);
    const loaded = await store.load();

    expect(loaded.agents['agent-1']!.name).toBe('Claude Alpha');
    expect(loaded.locks[42]!.agentId).toBe('agent-1');
  });

  it('creates .ido4 directory on save', async () => {
    await store.save({ agents: {}, locks: {} });

    const filePath = path.join(tmpDir, '.ido4', 'agent-locks.json');
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('handles corrupt file gracefully', async () => {
    const filePath = path.join(tmpDir, '.ido4', 'agent-locks.json');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '{corrupt!!!', 'utf-8');

    const data = await store.load();
    expect(data.agents).toEqual({});
    expect(data.locks).toEqual({});
    expect(logger.getEntries('warn')).toHaveLength(1);
  });
});
