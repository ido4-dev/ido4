import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool, hasRegisteredTool } from '../helpers/test-utils.js';

const mockContainerService = {
  listContainers: vi.fn(),
  getContainerStatus: vi.fn(),
  createContainer: vi.fn(),
  assignTaskToContainer: vi.fn(),
  validateContainerCompletion: vi.fn(),
};

const mockContainer = { containerService: mockContainerService };

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HYDRO_PROFILE, SHAPE_UP_PROFILE, SCRUM_PROFILE } from '@ido4/core';
import { registerContainerTools } from '../../src/tools/container-tools.js';

describe('Container Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerContainerTools(server, HYDRO_PROFILE);
  });

  it('list_waves returns wave summaries', async () => {
    const waves = [{ name: 'Wave 1', taskCount: 5, completedCount: 2, completionPercentage: 40 }];
    mockContainerService.listContainers.mockResolvedValue(waves);

    const result = await callTool(server, 'list_waves') as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('Wave 1');
  });

  it('get_wave_status passes waveName', async () => {
    const status = { name: 'Wave 1', tasks: [], metrics: {} };
    mockContainerService.getContainerStatus.mockResolvedValue(status);

    await callTool(server, 'get_wave_status', { waveName: 'Wave 1' });
    expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('Wave 1');
  });

  it('create_wave passes name and description', async () => {
    mockContainerService.createContainer.mockResolvedValue({ name: 'Wave 2', created: true });

    const result = await callTool(server, 'create_wave', {
      name: 'Wave 2',
      description: 'Second wave',
    }) as { content: Array<{ text: string }> };

    expect(mockContainerService.createContainer).toHaveBeenCalledWith('Wave 2', 'Second wave');
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.name).toBe('Wave 2');
  });

  it('assign_task_to_wave passes issueNumber and waveName', async () => {
    mockContainerService.assignTaskToContainer.mockResolvedValue({
      issueNumber: 42,
      container: 'Wave 1',
      integrity: { maintained: true, violations: [] },
    });

    await callTool(server, 'assign_task_to_wave', { issueNumber: 42, waveName: 'Wave 1' });
    expect(mockContainerService.assignTaskToContainer).toHaveBeenCalledWith(42, 'Wave 1');
  });

  it('validate_wave_completion passes waveName', async () => {
    mockContainerService.validateContainerCompletion.mockResolvedValue({
      container: 'Wave 1',
      canComplete: false,
      reasons: ['2 tasks not done'],
      tasks: [],
    });

    const result = await callTool(server, 'validate_wave_completion', { waveName: 'Wave 1' }) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.canComplete).toBe(false);
  });

  describe('Hydro generates epic container tools', () => {
    it('registers list_epics for epic container', () => {
      expect(hasRegisteredTool(server, 'list_epics')).toBe(true);
    });

    it('registers get_epic_status for epic container', () => {
      expect(hasRegisteredTool(server, 'get_epic_status')).toBe(true);
    });

    it('registers assign_task_to_epic for epic container', () => {
      expect(hasRegisteredTool(server, 'assign_task_to_epic')).toBe(true);
    });

    it('does not register create_epic (no namePattern)', () => {
      expect(hasRegisteredTool(server, 'create_epic')).toBe(false);
    });

    it('does not register validate_epic_completion (completionRule is none)', () => {
      expect(hasRegisteredTool(server, 'validate_epic_completion')).toBe(false);
    });

    it('generates 8 container tools total for Hydro', () => {
      // wave: list, get_status, assign, create, validate_completion = 5
      // epic: list, get_status, assign = 3
      const toolNames = [
        'list_waves', 'get_wave_status', 'assign_task_to_wave', 'create_wave', 'validate_wave_completion',
        'list_epics', 'get_epic_status', 'assign_task_to_epic',
      ];
      for (const name of toolNames) {
        expect(hasRegisteredTool(server, name), `Missing tool: ${name}`).toBe(true);
      }
    });
  });

  describe('Shape Up container tools', () => {
    let shapeUpServer: McpServer;

    beforeEach(() => {
      shapeUpServer = new McpServer({ name: 'test', version: '0.1.0' });
      registerContainerTools(shapeUpServer, SHAPE_UP_PROFILE);
    });

    it('registers cycle tools', () => {
      expect(hasRegisteredTool(shapeUpServer, 'list_cycles')).toBe(true);
      expect(hasRegisteredTool(shapeUpServer, 'get_cycle_status')).toBe(true);
      expect(hasRegisteredTool(shapeUpServer, 'assign_task_to_cycle')).toBe(true);
      expect(hasRegisteredTool(shapeUpServer, 'create_cycle')).toBe(true);
      expect(hasRegisteredTool(shapeUpServer, 'validate_cycle_completion')).toBe(true);
    });

    it('registers bet tools', () => {
      expect(hasRegisteredTool(shapeUpServer, 'list_bets')).toBe(true);
      expect(hasRegisteredTool(shapeUpServer, 'get_bet_status')).toBe(true);
      expect(hasRegisteredTool(shapeUpServer, 'assign_task_to_bet')).toBe(true);
    });

    it('does not register scope tools (not managed)', () => {
      expect(hasRegisteredTool(shapeUpServer, 'list_scopes')).toBe(false);
    });
  });

  describe('Scrum container tools', () => {
    let scrumServer: McpServer;

    beforeEach(() => {
      scrumServer = new McpServer({ name: 'test', version: '0.1.0' });
      registerContainerTools(scrumServer, SCRUM_PROFILE);
    });

    it('registers sprint tools', () => {
      expect(hasRegisteredTool(scrumServer, 'list_sprints')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'get_sprint_status')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'assign_task_to_sprint')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'create_sprint')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'validate_sprint_completion')).toBe(true);
    });

    it('registers epic tools (list, status, assign — no create, no completion)', () => {
      expect(hasRegisteredTool(scrumServer, 'list_epics')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'get_epic_status')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'assign_task_to_epic')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'create_epic')).toBe(false);
      expect(hasRegisteredTool(scrumServer, 'validate_epic_completion')).toBe(false);
    });

    it('does not register wave tools', () => {
      expect(hasRegisteredTool(scrumServer, 'list_waves')).toBe(false);
    });
  });
});
