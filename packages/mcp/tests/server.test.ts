import { describe, it, expect, vi } from 'vitest';
import { HYDRO_PROFILE, SCRUM_PROFILE, SHAPE_UP_PROFILE } from '@ido4/core';
import {
  hasRegisteredTool,
  getRegisteredToolNames,
  hasRegisteredResource,
  hasRegisteredResourceTemplate,
  hasRegisteredPrompt,
  getRegisteredResourceUris,
  getRegisteredResourceTemplateNames,
  getRegisteredPromptNames,
} from './helpers/test-utils.js';

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

vi.mock('../src/helpers/methodology-activation.js', () => ({
  setActivationCallback: vi.fn(),
  activateMethodology: vi.fn(),
  resetMethodologyActivation: vi.fn(),
}));

import { createServer } from '../src/server.js';
import { registerTaskTools, registerContainerTools, registerEpicTools } from '../src/tools/index.js';
import { registerResources } from '../src/resources/index.js';
import { registerPrompts } from '../src/prompts/index.js';

describe('createServer', () => {
  it('returns an McpServer instance', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe('function');
  });

  it('registers all 19 task tools (9 dynamic transitions + 10 static)', () => {
    const server = createServer(HYDRO_PROFILE);

    const taskToolNames = [
      // Dynamic transition tools (9 for Hydro)
      'start_task', 'review_task', 'approve_task', 'complete_task',
      'block_task', 'unblock_task', 'return_task', 'refine_task', 'ready_task',
      // Static task tools (10)
      'get_task', 'get_task_field', 'list_tasks', 'create_task',
      'validate_transition', 'validate_all_transitions',
      'find_task_pr', 'get_pr_reviews', 'add_task_comment', 'get_sub_issues',
    ];

    for (const name of taskToolNames) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers all 4 epic tools', () => {
    const server = createServer(HYDRO_PROFILE);

    const epicToolNames = [
      'search_epics', 'get_epic_tasks', 'get_epic_timeline', 'validate_epic_integrity',
    ];

    for (const name of epicToolNames) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers all 8 container tools (5 wave + 3 epic)', () => {
    const server = createServer(HYDRO_PROFILE);

    const containerToolNames = [
      // Wave container tools
      'list_waves', 'get_wave_status', 'create_wave',
      'assign_task_to_wave', 'validate_wave_completion',
      // Epic container tools (dynamic, no create/validate since no namePattern and completionRule=none)
      'list_epics', 'get_epic_status', 'assign_task_to_epic',
    ];

    for (const name of containerToolNames) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers all 2 dependency tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'analyze_dependencies')).toBe(true);
    expect(hasRegisteredTool(server, 'validate_dependencies')).toBe(true);
  });

  it('registers all 2 project tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'init_project')).toBe(true);
    expect(hasRegisteredTool(server, 'get_project_status')).toBe(true);
  });

  it('registers all 2 audit tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'query_audit_trail')).toBe(true);
    expect(hasRegisteredTool(server, 'get_audit_summary')).toBe(true);
  });

  it('registers all 2 analytics tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'get_analytics')).toBe(true);
    expect(hasRegisteredTool(server, 'get_task_cycle_time')).toBe(true);
  });

  it('registers all 4 agent tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'register_agent')).toBe(true);
    expect(hasRegisteredTool(server, 'list_agents')).toBe(true);
    expect(hasRegisteredTool(server, 'lock_task')).toBe(true);
    expect(hasRegisteredTool(server, 'release_task')).toBe(true);
  });

  it('registers compliance tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'compute_compliance_score')).toBe(true);
  });

  it('registers all 4 skill data tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'get_standup_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_board_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_compliance_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_health_data')).toBe(true);
  });

  it('registers all 2 distribution tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'get_next_task')).toBe(true);
    expect(hasRegisteredTool(server, 'complete_and_handoff')).toBe(true);
  });

  it('registers coordination tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'get_coordination_state')).toBe(true);
  });

  it('registers gate tools', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredTool(server, 'check_merge_readiness')).toBe(true);
  });

  it('registers 59 tools total', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(getRegisteredToolNames(server)).toHaveLength(59);
  });

  it('registers resources', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredResource(server, 'ido4://methodology/principles')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/workflow')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/statuses')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/profile')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://methodology/work-item-types')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://audit/recent')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://project/status')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://events/recent')).toBe(true);
    expect(hasRegisteredResource(server, 'ido4://agents/coordination')).toBe(true);
  });

  it('registers resource templates', () => {
    const server = createServer(HYDRO_PROFILE);
    // Container status templates (one per managed container)
    expect(hasRegisteredResourceTemplate(server, 'wave-status')).toBe(true);
    expect(hasRegisteredResourceTemplate(server, 'epic-status')).toBe(true);
    // Analytics template (one per execution container)
    expect(hasRegisteredResourceTemplate(server, 'analytics-wave')).toBe(true);
  });

  it('registers prompts', () => {
    const server = createServer(HYDRO_PROFILE);
    expect(hasRegisteredPrompt(server, 'standup')).toBe(true);
    expect(hasRegisteredPrompt(server, 'plan-wave')).toBe(true);
    expect(hasRegisteredPrompt(server, 'board')).toBe(true);
    expect(hasRegisteredPrompt(server, 'compliance')).toBe(true);
    expect(hasRegisteredPrompt(server, 'health')).toBe(true);
    expect(hasRegisteredPrompt(server, 'retro')).toBe(true);
    expect(hasRegisteredPrompt(server, 'review')).toBe(true);
    expect(hasRegisteredPrompt(server, 'execute-task')).toBe(true);
  });
});

describe('createServer — Scrum profile', () => {
  it('registers 57 tools total', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(getRegisteredToolNames(server)).toHaveLength(57);
  });

  it('registers 7 dynamic transition tools', () => {
    const server = createServer(SCRUM_PROFILE);
    const transitionTools = [
      'plan_task', 'start_task', 'review_task', 'approve_task',
      'block_task', 'unblock_task', 'return_task',
    ];
    for (const name of transitionTools) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers sprint container tools', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(hasRegisteredTool(server, 'list_sprints')).toBe(true);
    expect(hasRegisteredTool(server, 'get_sprint_status')).toBe(true);
    expect(hasRegisteredTool(server, 'create_sprint')).toBe(true);
    expect(hasRegisteredTool(server, 'assign_task_to_sprint')).toBe(true);
    expect(hasRegisteredTool(server, 'validate_sprint_completion')).toBe(true);
  });

  it('registers epic container tools (no create, no completion validation)', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(hasRegisteredTool(server, 'list_epics')).toBe(true);
    expect(hasRegisteredTool(server, 'get_epic_status')).toBe(true);
    expect(hasRegisteredTool(server, 'assign_task_to_epic')).toBe(true);
    // No create_epic (no namePattern) and no validate_epic_completion (completionRule: 'none')
    expect(hasRegisteredTool(server, 'create_epic')).toBe(false);
    expect(hasRegisteredTool(server, 'validate_epic_completion')).toBe(false);
  });

  it('does not register Hydro-specific tools', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(hasRegisteredTool(server, 'refine_task')).toBe(false);
    expect(hasRegisteredTool(server, 'ready_task')).toBe(false);
    expect(hasRegisteredTool(server, 'complete_task')).toBe(false);
  });

  it('registers plan-sprint prompt (not plan-wave)', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(hasRegisteredPrompt(server, 'plan-sprint')).toBe(true);
    expect(hasRegisteredPrompt(server, 'plan-wave')).toBe(false);
  });

  it('registers 8 prompts', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(getRegisteredPromptNames(server)).toHaveLength(8);
  });

  it('registers 9 static resources', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(getRegisteredResourceUris(server)).toHaveLength(9);
  });

  it('registers sprint-status template (not wave-status)', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(hasRegisteredResourceTemplate(server, 'sprint-status')).toBe(true);
    expect(hasRegisteredResourceTemplate(server, 'wave-status')).toBe(false);
  });

  it('registers analytics-sprint template', () => {
    const server = createServer(SCRUM_PROFILE);
    expect(hasRegisteredResourceTemplate(server, 'analytics-sprint')).toBe(true);
    expect(hasRegisteredResourceTemplate(server, 'analytics-wave')).toBe(false);
  });
});

describe('createServer — Shape Up profile', () => {
  it('registers 55 tools total', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(getRegisteredToolNames(server)).toHaveLength(55);
  });

  it('registers 9 dynamic transition tools', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    const transitionTools = [
      'shape_task', 'bet_task', 'start_task', 'review_task', 'ship_task',
      'block_task', 'unblock_task', 'kill_task', 'return_task',
    ];
    for (const name of transitionTools) {
      expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it('registers 8 container tools (5 cycle + 3 bet)', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    // Cycle tools (has namePattern and completionRule)
    expect(hasRegisteredTool(server, 'list_cycles')).toBe(true);
    expect(hasRegisteredTool(server, 'get_cycle_status')).toBe(true);
    expect(hasRegisteredTool(server, 'create_cycle')).toBe(true);
    expect(hasRegisteredTool(server, 'assign_task_to_cycle')).toBe(true);
    expect(hasRegisteredTool(server, 'validate_cycle_completion')).toBe(true);
    // Bet tools (no namePattern, completionRule=none)
    expect(hasRegisteredTool(server, 'list_bets')).toBe(true);
    expect(hasRegisteredTool(server, 'get_bet_status')).toBe(true);
    expect(hasRegisteredTool(server, 'assign_task_to_bet')).toBe(true);
  });

  it('does not register legacy epic tools', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(hasRegisteredTool(server, 'search_epics')).toBe(false);
    expect(hasRegisteredTool(server, 'validate_epic_integrity')).toBe(false);
  });

  it('does not register Hydro-specific transitions', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(hasRegisteredTool(server, 'refine_task')).toBe(false);
    expect(hasRegisteredTool(server, 'ready_task')).toBe(false);
    expect(hasRegisteredTool(server, 'approve_task')).toBe(false);
    expect(hasRegisteredTool(server, 'complete_task')).toBe(false);
  });

  it('registers plan-cycle prompt (not plan-wave)', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(hasRegisteredPrompt(server, 'plan-cycle')).toBe(true);
    expect(hasRegisteredPrompt(server, 'plan-wave')).toBe(false);
  });

  it('registers 8 prompts', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(getRegisteredPromptNames(server)).toHaveLength(8);
  });

  it('registers 9 static resources', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(getRegisteredResourceUris(server)).toHaveLength(9);
  });

  it('registers cycle-status and bet-status templates', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(hasRegisteredResourceTemplate(server, 'cycle-status')).toBe(true);
    expect(hasRegisteredResourceTemplate(server, 'bet-status')).toBe(true);
    expect(hasRegisteredResourceTemplate(server, 'wave-status')).toBe(false);
  });

  it('registers analytics-cycle template (not analytics-wave)', () => {
    const server = createServer(SHAPE_UP_PROFILE);
    expect(hasRegisteredResourceTemplate(server, 'analytics-cycle')).toBe(true);
    expect(hasRegisteredResourceTemplate(server, 'analytics-wave')).toBe(false);
  });
});

describe('createServer — bootstrap mode (null profile)', () => {
  it('registers only profile-independent tools', () => {
    const server = createServer(null);
    const toolNames = getRegisteredToolNames(server);
    expect(toolNames).toHaveLength(27);
  });

  it('registers project tools (init + status)', () => {
    const server = createServer(null);
    expect(hasRegisteredTool(server, 'init_project')).toBe(true);
    expect(hasRegisteredTool(server, 'get_project_status')).toBe(true);
  });

  it('registers sandbox tools', () => {
    const server = createServer(null);
    expect(hasRegisteredTool(server, 'create_sandbox')).toBe(true);
    expect(hasRegisteredTool(server, 'destroy_sandbox')).toBe(true);
    expect(hasRegisteredTool(server, 'reset_sandbox')).toBe(true);
  });

  it('registers all other profile-independent tools', () => {
    const server = createServer(null);
    // Dependency
    expect(hasRegisteredTool(server, 'analyze_dependencies')).toBe(true);
    expect(hasRegisteredTool(server, 'validate_dependencies')).toBe(true);
    // Audit
    expect(hasRegisteredTool(server, 'query_audit_trail')).toBe(true);
    expect(hasRegisteredTool(server, 'get_audit_summary')).toBe(true);
    // Analytics
    expect(hasRegisteredTool(server, 'get_analytics')).toBe(true);
    expect(hasRegisteredTool(server, 'get_task_cycle_time')).toBe(true);
    // Agent
    expect(hasRegisteredTool(server, 'register_agent')).toBe(true);
    expect(hasRegisteredTool(server, 'list_agents')).toBe(true);
    expect(hasRegisteredTool(server, 'lock_task')).toBe(true);
    expect(hasRegisteredTool(server, 'release_task')).toBe(true);
    // Compliance
    expect(hasRegisteredTool(server, 'compute_compliance_score')).toBe(true);
    // Skill data
    expect(hasRegisteredTool(server, 'get_standup_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_board_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_compliance_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_health_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_task_execution_data')).toBe(true);
    // Distribution
    expect(hasRegisteredTool(server, 'get_next_task')).toBe(true);
    expect(hasRegisteredTool(server, 'complete_and_handoff')).toBe(true);
    // Coordination
    expect(hasRegisteredTool(server, 'get_coordination_state')).toBe(true);
    // Gate
    expect(hasRegisteredTool(server, 'check_merge_readiness')).toBe(true);
  });

  it('does NOT register any task transition tools', () => {
    const server = createServer(null);
    expect(hasRegisteredTool(server, 'start_task')).toBe(false);
    expect(hasRegisteredTool(server, 'review_task')).toBe(false);
    expect(hasRegisteredTool(server, 'approve_task')).toBe(false);
    expect(hasRegisteredTool(server, 'block_task')).toBe(false);
  });

  it('does NOT register any container tools', () => {
    const server = createServer(null);
    expect(hasRegisteredTool(server, 'list_waves')).toBe(false);
    expect(hasRegisteredTool(server, 'list_sprints')).toBe(false);
    expect(hasRegisteredTool(server, 'list_cycles')).toBe(false);
  });

  it('does NOT register any epic tools', () => {
    const server = createServer(null);
    expect(hasRegisteredTool(server, 'search_epics')).toBe(false);
    expect(hasRegisteredTool(server, 'validate_epic_integrity')).toBe(false);
  });

  it('registers bootstrap resource for capability pre-registration', () => {
    const server = createServer(null);
    expect(hasRegisteredResource(server, 'ido4://server/mode')).toBe(true);
    expect(getRegisteredResourceUris(server)).toHaveLength(1);
  });

  it('registers no resource templates', () => {
    const server = createServer(null);
    expect(getRegisteredResourceTemplateNames(server)).toHaveLength(0);
  });

  it('registers bootstrap prompt for capability pre-registration', () => {
    const server = createServer(null);
    expect(hasRegisteredPrompt(server, 'setup')).toBe(true);
    expect(getRegisteredPromptNames(server)).toHaveLength(1);
  });

  it('accepts methodology activation after bootstrap', () => {
    // Verify that a bootstrap server can have methodology tools added dynamically
    const server = createServer(null);
    expect(getRegisteredToolNames(server)).toHaveLength(27);

    // Simulate what activateMethodology does — register profile-dependent tools
    registerTaskTools(server, HYDRO_PROFILE);
    registerContainerTools(server, HYDRO_PROFILE);
    registerEpicTools(server, HYDRO_PROFILE);
    registerResources(server, HYDRO_PROFILE);
    registerPrompts(server, HYDRO_PROFILE);

    // Now should have full Hydro tool set + bootstrap entries
    expect(getRegisteredToolNames(server)).toHaveLength(59);
    expect(hasRegisteredTool(server, 'list_waves')).toBe(true);
    expect(hasRegisteredTool(server, 'start_task')).toBe(true);
    expect(hasRegisteredTool(server, 'search_epics')).toBe(true);
    // 9 methodology resources + 1 bootstrap resource
    expect(getRegisteredResourceUris(server)).toHaveLength(10);
    // 8 methodology prompts + 1 bootstrap prompt
    expect(getRegisteredPromptNames(server)).toHaveLength(9);
  });
});
