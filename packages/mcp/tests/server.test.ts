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

  it('registers all 18 task tools', () => {
    const server = createServer();

    const taskToolNames = [
      'start_task', 'review_task', 'approve_task', 'block_task',
      'unblock_task', 'return_task', 'refine_task', 'ready_task',
      'get_task', 'get_task_field', 'list_tasks', 'create_task',
      'validate_transition', 'validate_all_transitions',
      'find_task_pr', 'get_pr_reviews', 'add_task_comment', 'get_sub_issues',
    ];

    for (const name of taskToolNames) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers all 4 epic tools', () => {
    const server = createServer();

    const epicToolNames = [
      'search_epics', 'get_epic_tasks', 'get_epic_timeline', 'validate_epic_integrity',
    ];

    for (const name of epicToolNames) {
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

  it('registers all 2 project tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'init_project')).toBe(true);
    expect(hasRegisteredTool(server, 'get_project_status')).toBe(true);
  });

  it('registers all 2 audit tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'query_audit_trail')).toBe(true);
    expect(hasRegisteredTool(server, 'get_audit_summary')).toBe(true);
  });

  it('registers all 2 analytics tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'get_analytics')).toBe(true);
    expect(hasRegisteredTool(server, 'get_task_cycle_time')).toBe(true);
  });

  it('registers all 4 agent tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'register_agent')).toBe(true);
    expect(hasRegisteredTool(server, 'list_agents')).toBe(true);
    expect(hasRegisteredTool(server, 'lock_task')).toBe(true);
    expect(hasRegisteredTool(server, 'release_task')).toBe(true);
  });

  it('registers compliance tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'compute_compliance_score')).toBe(true);
  });

  it('registers all 4 skill data tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'get_standup_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_board_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_compliance_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_health_data')).toBe(true);
  });

  it('registers all 2 distribution tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'get_next_task')).toBe(true);
    expect(hasRegisteredTool(server, 'complete_and_handoff')).toBe(true);
  });

  it('registers coordination tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'get_coordination_state')).toBe(true);
  });

  it('registers gate tools', () => {
    const server = createServer();
    expect(hasRegisteredTool(server, 'check_merge_readiness')).toBe(true);
  });

  it('registers 51 tools total', () => {
    const server = createServer();
    expect(getRegisteredToolNames(server)).toHaveLength(51);
  });

  it('registers resources', () => {
    const server = createServer();
    expect(hasRegisteredResource(server, 'ido4://methodology/principles')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/workflow')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/statuses')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://audit/recent')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://project/status')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://events/recent')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://agents/coordination')).toBe(true);
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
    expect(hasRegisteredPrompt(server, 'compliance')).toBe(true);
    expect(hasRegisteredPrompt(server, 'health')).toBe(true);
    expect(hasRegisteredPrompt(server, 'retro')).toBe(true);
  });
});
