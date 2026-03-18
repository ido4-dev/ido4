import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

// Hoist all mocks
const {
  mockInitializeProject,
  mockDetectRepository,
  MockProjectInitService,
  mockResetContainer,
  mockGetContainer,
} = vi.hoisted(() => {
  const mockInitializeProject = vi.fn();
  const mockDetectRepository = vi.fn();
  return {
    mockInitializeProject,
    mockDetectRepository,
    MockProjectInitService: vi.fn().mockImplementation(() => ({
      initializeProject: mockInitializeProject,
      detectRepository: mockDetectRepository,
    })),
    mockResetContainer: vi.fn(),
    mockGetContainer: vi.fn(),
  };
});

vi.mock('@ido4/core', async (importOriginal) => {
  const original = await importOriginal() as Record<string, unknown>;
  return {
    ...original,
    ProjectInitService: MockProjectInitService,
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

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: mockResetContainer,
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HYDRO_PROFILE } from '@ido4/core';
import { registerProjectTools } from '../../src/tools/project-tools.js';

const INIT_RESULT = {
  success: true,
  project: { id: 'PVT_test', number: 1, title: 'Test', url: 'https://example.com', repository: 'user/repo' },
  fieldsCreated: ['Status (configured)', 'Wave', 'Epic', 'Dependencies', 'AI Context'],
  configPath: '/tmp/.ido4/project-info.json',
};

describe('Project Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerProjectTools(server, HYDRO_PROFILE);
  });

  it('init_project calls ProjectInitService.initializeProject', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

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

  it('init_project passes Hydro profile to ProjectInitService by default', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

    const result = await callTool(server, 'init_project', { mode: 'create', repository: 'user/repo' }) as {
      content: Array<{ text: string }>;
    };

    // Verify profile passed to constructor
    expect(MockProjectInitService).toHaveBeenCalledWith(
      expect.anything(), // graphqlClient
      expect.anything(), // logger
      expect.objectContaining({ id: 'hydro' }),
    );

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.methodology.id).toBe('hydro');
    expect(parsed.methodology.name).toContain('Hydro');
  });

  it('init_project passes Scrum profile when methodology=scrum', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

    const result = await callTool(server, 'init_project', {
      mode: 'create',
      repository: 'user/repo',
      methodology: 'scrum',
    }) as { content: Array<{ text: string }> };

    expect(MockProjectInitService).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ id: 'scrum' }),
    );

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.methodology.id).toBe('scrum');
    expect(parsed.methodology.name).toBe('Scrum');
    expect(parsed.methodology.containers).toContain('Sprint');
  });

  it('init_project passes Shape Up profile when methodology=shape-up', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

    const result = await callTool(server, 'init_project', {
      mode: 'create',
      repository: 'user/repo',
      methodology: 'shape-up',
    }) as { content: Array<{ text: string }> };

    expect(MockProjectInitService).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ id: 'shape-up' }),
    );

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.methodology.id).toBe('shape-up');
    expect(parsed.methodology.containers).toContain('Cycle');
  });

  it('init_project includes nextSteps in response', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

    const result = await callTool(server, 'init_project', { mode: 'create', repository: 'user/repo' }) as {
      content: Array<{ text: string }>;
    };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.nextSteps).toBeDefined();
    expect(parsed.nextSteps.length).toBeGreaterThan(0);
    expect(parsed.nextSteps.some((s: string) => s.includes('create_sandbox'))).toBe(true);
  });

  it('init_project includes methodology states in response', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

    const result = await callTool(server, 'init_project', {
      mode: 'create',
      repository: 'user/repo',
      methodology: 'scrum',
    }) as { content: Array<{ text: string }> };

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.methodology.states).toBeDefined();
    // Scrum states use display names (e.g., "Product Backlog" not "Backlog")
    expect(parsed.methodology.states.some((s: string) => s.includes('Backlog'))).toBe(true);
    expect(parsed.methodology.states).toContain('Done');
  });

  it('init_project resets container after success', async () => {
    mockInitializeProject.mockResolvedValue(INIT_RESULT);

    await callTool(server, 'init_project', { mode: 'create', repository: 'user/repo' });
    expect(mockResetContainer).toHaveBeenCalled();
  });

  it('init_project passes connect mode args', async () => {
    mockInitializeProject.mockResolvedValue({
      ...INIT_RESULT,
      project: { ...INIT_RESULT.project, id: 'PVT_existing', number: 5, title: 'Existing' },
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
      ...INIT_RESULT,
      project: { ...INIT_RESULT.project, title: 'Custom Name' },
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
        profile: HYDRO_PROFILE,
        workflowConfig: {
          isBlockedStatus: (s: string) => s === 'Blocked',
          isActiveStatus: (s: string) => s === 'In Progress' || s === 'In Review',
          isTerminalStatus: (s: string) => s === 'Done',
        },
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
            { number: 1, status: 'Done', containers: { wave: 'wave-001' }, closed: false },
            { number: 2, status: 'In Progress', containers: { wave: 'wave-001' }, closed: false },
            { number: 3, status: 'Blocked', containers: { wave: 'wave-001' }, closed: false },
            { number: 4, status: 'Backlog', containers: { wave: 'wave-002' }, closed: false },
            { number: 5, status: 'Backlog', containers: {}, closed: false },
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
