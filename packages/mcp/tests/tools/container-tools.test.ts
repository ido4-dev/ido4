import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

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
import { registerContainerTools } from '../../src/tools/container-tools.js';

describe('Container Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerContainerTools(server);
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
});
