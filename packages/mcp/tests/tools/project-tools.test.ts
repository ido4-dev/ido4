import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

// Mock ProjectInitService
const mockInitializeProject = vi.fn();
const mockDetectRepository = vi.fn();

vi.mock('@ido4/core', async (importOriginal) => {
  const original = await importOriginal() as Record<string, unknown>;
  return {
    ...original,
    ProjectInitService: vi.fn().mockImplementation(() => ({
      initializeProject: mockInitializeProject,
      detectRepository: mockDetectRepository,
    })),
    ConsoleLogger: vi.fn().mockImplementation(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    CredentialManager: vi.fn(),
    GitHubGraphQLClient: vi.fn(),
  };
});

// Mock container-init (for resetContainer and getContainer)
const { mockResetContainer, mockGetContainer } = vi.hoisted(() => ({
  mockResetContainer: vi.fn(),
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: mockResetContainer,
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectTools } from '../../src/tools/project-tools.js';

describe('Project Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerProjectTools(server);
  });

  it('init_project calls ProjectInitService.initializeProject', async () => {
    mockInitializeProject.mockResolvedValue({
      success: true,
      project: { id: 'PVT_test', number: 1, title: 'Test', url: 'https://example.com', repository: 'user/repo' },
      fieldsCreated: ['Wave', 'Epic'],
      configPath: '/tmp/.ido4/project-info.json',
    });

    const result = await callTool(server, 'init_project', { mode: 'create', repository: 'user/repo' }) as {
      content: Array<{ text: string }>;
    };

    expect(mockInitializeProject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'create',
        repository: 'user/repo',
      }),
    );

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.project.id).toBe('PVT_test');
  });

  it('init_project resets container after success', async () => {
    mockInitializeProject.mockResolvedValue({
      success: true,
      project: { id: 'PVT_test', number: 1, title: 'Test', url: 'https://example.com', repository: 'user/repo' },
      fieldsCreated: [],
      configPath: '/tmp/.ido4/project-info.json',
    });

    await callTool(server, 'init_project', { mode: 'create', repository: 'user/repo' });
    expect(mockResetContainer).toHaveBeenCalled();
  });

  it('init_project passes connect mode args', async () => {
    mockInitializeProject.mockResolvedValue({
      success: true,
      project: { id: 'PVT_existing', number: 5, title: 'Existing', url: 'https://example.com', repository: 'user/repo' },
      fieldsCreated: [],
      configPath: '/tmp/.ido4/project-info.json',
    });

    await callTool(server, 'init_project', {
      mode: 'connect',
      repository: 'user/repo',
      projectId: 'PVT_existing',
    });

    expect(mockInitializeProject).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'connect',
        projectId: 'PVT_existing',
      }),
    );
  });

  it('init_project handles errors', async () => {
    const { ConfigurationError } = await import('@ido4/core');
    mockInitializeProject.mockRejectedValue(
      new ConfigurationError({ message: 'Token not found' }),
    );

    const result = await callTool(server, 'init_project', { mode: 'create' }) as {
      isError: boolean;
      content: Array<{ text: string }>;
    };

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe('CONFIGURATION_ERROR');
  });

  it('init_project passes optional projectName', async () => {
    mockInitializeProject.mockResolvedValue({
      success: true,
      project: { id: 'PVT_test', number: 1, title: 'Custom Name', url: 'https://example.com', repository: 'user/repo' },
      fieldsCreated: [],
      configPath: '/tmp/.ido4/project-info.json',
    });

    await callTool(server, 'init_project', {
      mode: 'create',
      repository: 'user/repo',
      projectName: 'Custom Name',
    });

    expect(mockInitializeProject).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'Custom Name',
      }),
    );
  });

  describe('get_project_status', () => {
    const mockContainerService = { listContainers: vi.fn() };
    const mockTaskService = {
      listTasks: vi.fn(),
    };

    beforeEach(() => {
      mockGetContainer.mockResolvedValue({
        containerService: mockContainerService,
        taskService: mockTaskService,
      });
    });

    it('returns project dashboard with wave summaries and metrics', async () => {
      mockContainerService.listContainers.mockResolvedValue([
        { name: 'wave-001', taskCount: 5, completedCount: 3, completionPercentage: 60, status: 'active' },
        { name: 'wave-002', taskCount: 3, completedCount: 0, completionPercentage: 0, status: 'not_started' },
      ]);
      mockTaskService.listTasks.mockResolvedValue({
        success: true,
        data: {
          tasks: [
            { number: 1, status: 'Done', wave: 'wave-001', closed: false },
            { number: 2, status: 'In Progress', wave: 'wave-001', closed: false },
            { number: 3, status: 'Blocked', wave: 'wave-001', closed: false },
            { number: 4, status: 'Backlog', wave: 'wave-002', closed: false },
            { number: 5, status: 'Backlog', closed: false },
          ],
          total: 5,
          filters: {},
        },
        suggestions: [],
        warnings: [],
      });

      const result = await callTool(server, 'get_project_status', {}) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data.waves).toHaveLength(2);
      expect(parsed.data.activeWave).toBe('wave-001');
      expect(parsed.data.projectMetrics.totalTasks).toBe(5);
      expect(parsed.data.projectMetrics.completedTasks).toBe(1);
      expect(parsed.data.projectMetrics.blockedCount).toBe(1);
      expect(parsed.data.projectMetrics.unassignedTasks).toBe(1);
      expect(parsed.data.projectMetrics.activeWaveCount).toBe(1);
      expect(parsed.data.projectMetrics.statusDistribution['In Progress']).toBe(1);
      expect(parsed.data.projectMetrics.statusDistribution['Blocked']).toBe(1);
    });

    it('handles empty project', async () => {
      mockContainerService.listContainers.mockResolvedValue([]);
      mockTaskService.listTasks.mockResolvedValue({
        success: true,
        data: { tasks: [], total: 0, filters: {} },
        suggestions: [],
        warnings: [],
      });

      const result = await callTool(server, 'get_project_status', {}) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.data.activeWave).toBeNull();
      expect(parsed.data.projectMetrics.totalTasks).toBe(0);
      expect(parsed.data.projectMetrics.completionPercentage).toBe(0);
    });
  });
});
