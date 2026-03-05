import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

const mockWaveService = {
  listWaves: vi.fn(),
  getWaveStatus: vi.fn(),
  createWave: vi.fn(),
  assignTaskToWave: vi.fn(),
  validateWaveCompletion: vi.fn(),
};

const mockContainer = { waveService: mockWaveService };

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWaveTools } from '../../src/tools/wave-tools.js';

describe('Wave Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerWaveTools(server);
  });

  it('list_waves returns wave summaries', async () => {
    const waves = [{ name: 'Wave 1', taskCount: 5, completedCount: 2, completionPercentage: 40 }];
    mockWaveService.listWaves.mockResolvedValue(waves);

    const result = await callTool(server, 'list_waves') as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe('Wave 1');
  });

  it('get_wave_status passes waveName', async () => {
    const status = { name: 'Wave 1', tasks: [], metrics: {} };
    mockWaveService.getWaveStatus.mockResolvedValue(status);

    await callTool(server, 'get_wave_status', { waveName: 'Wave 1' });
    expect(mockWaveService.getWaveStatus).toHaveBeenCalledWith('Wave 1');
  });

  it('create_wave passes name and description', async () => {
    mockWaveService.createWave.mockResolvedValue({ name: 'Wave 2', created: true });

    const result = await callTool(server, 'create_wave', {
      name: 'Wave 2',
      description: 'Second wave',
    }) as { content: Array<{ text: string }> };

    expect(mockWaveService.createWave).toHaveBeenCalledWith('Wave 2', 'Second wave');
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.name).toBe('Wave 2');
  });

  it('assign_task_to_wave passes issueNumber and waveName', async () => {
    mockWaveService.assignTaskToWave.mockResolvedValue({
      issueNumber: 42,
      wave: 'Wave 1',
      epicIntegrity: { maintained: true, violations: [] },
    });

    await callTool(server, 'assign_task_to_wave', { issueNumber: 42, waveName: 'Wave 1' });
    expect(mockWaveService.assignTaskToWave).toHaveBeenCalledWith(42, 'Wave 1');
  });

  it('validate_wave_completion passes waveName', async () => {
    mockWaveService.validateWaveCompletion.mockResolvedValue({
      wave: 'Wave 1',
      canComplete: false,
      reasons: ['2 tasks not done'],
      tasks: [],
    });

    const result = await callTool(server, 'validate_wave_completion', { waveName: 'Wave 1' }) as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.canComplete).toBe(false);
  });
});
