import { describe, it, expect, vi } from 'vitest';
import {
  hasRegisteredTool,
  getRegisteredToolNames,
  hasRegisteredResource,
  hasRegisteredResourceTemplate,
  hasRegisteredPrompt,
} from './helpers/test-utils.js';

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { createServer } from '../src/server.js';

describe('createServer', () => {
  it('returns an McpServer instance', () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });

  it('registers all 12 task tools', () => {
    const server = createServer();

    const taskToolNames = [
      'start_task', 'review_task', 'approve_task', 'block_task',
      'unblock_task', 'return_task', 'refine_task', 'ready_task',
      'get_task', 'get_task_field', 'validate_transition', 'validate_all_transitions',
    ];

    for (const name of taskToolNames) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers all 5 wave tools', () => {
    const server = createServer();

    const waveToolNames = [
      'list_waves', 'get_wave_status', 'create_wave',
      'assign_task_to_wave', 'validate_wave_completion',
    ];

    for (const name of waveToolNames) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers all 2 dependency tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'analyze_dependencies')).toBe(true);
    expect(hasRegisteredTool(server, 'validate_dependencies')).toBe(true);
  });

  it('registers 19 tools total', () => {
    const server = createServer();
    expect(getRegisteredToolNames(server)).toHaveLength(19);
  });

  it('registers resources', () => {
    const server = createServer();
    expect(hasRegisteredResource(server, 'ido4://methodology/principles')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/workflow')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/statuses')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://project/status')).toBe(true);
  });

  it('registers resource templates', () => {
    const server = createServer();
    expect(hasRegisteredResourceTemplate(server, 'wave-status')).toBe(true);
  });

  it('registers prompts', () => {
    const server = createServer();
    expect(hasRegisteredPrompt(server, 'standup')).toBe(true);
    expect(hasRegisteredPrompt(server, 'plan-wave')).toBe(true);
    expect(hasRegisteredPrompt(server, 'board')).toBe(true);
  });
});
