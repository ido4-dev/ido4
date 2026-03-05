import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

const mockEpicService = {
  getTasksInEpic: vi.fn(),
  validateEpicIntegrity: vi.fn(),
};

const mockEpicRepository = {
  searchEpicIssues: vi.fn(),
  getIssueWithTimeline: vi.fn(),
};

const mockTaskService = {
  getTask: vi.fn(),
};

const mockContainer = {
  epicService: mockEpicService,
  epicRepository: mockEpicRepository,
  taskService: mockTaskService,
};

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEpicTools } from '../../src/tools/epic-tools.js';

describe('Epic Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);

    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerEpicTools(server);
  });

  describe('search_epics', () => {
    it('calls epicRepository.searchEpicIssues with search term', async () => {
      const epics = [
        { number: 1, title: '[Auth Epic] Login flow', url: 'https://github.com/owner/repo/issues/1' },
        { number: 5, title: '[Auth Epic] Session management', url: 'https://github.com/owner/repo/issues/5' },
      ];
      mockEpicRepository.searchEpicIssues.mockResolvedValue(epics);

      const result = await callTool(server, 'search_epics', { searchTerm: 'Auth' }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockEpicRepository.searchEpicIssues).toHaveBeenCalledWith('Auth');
      expect(parsed.success).toBe(true);
      expect(parsed.data.epics).toHaveLength(2);
      expect(parsed.data.total).toBe(2);
    });

    it('returns empty array when no epics match', async () => {
      mockEpicRepository.searchEpicIssues.mockResolvedValue([]);

      const result = await callTool(server, 'search_epics', { searchTerm: 'NonExistent' }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.data.epics).toHaveLength(0);
      expect(parsed.data.total).toBe(0);
    });
  });

  describe('get_epic_tasks', () => {
    it('calls epicService.getTasksInEpic with epic name', async () => {
      const tasks = [
        { number: 10, title: 'Login page', status: 'In Progress', wave: 'wave-001', epic: 'Auth' },
        { number: 11, title: 'Auth middleware', status: 'Ready for Dev', wave: 'wave-001', epic: 'Auth' },
      ];
      mockEpicService.getTasksInEpic.mockResolvedValue(tasks);

      const result = await callTool(server, 'get_epic_tasks', { epicName: 'Auth' }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockEpicService.getTasksInEpic).toHaveBeenCalledWith('Auth');
      expect(parsed.success).toBe(true);
      expect(parsed.data.epicName).toBe('Auth');
      expect(parsed.data.tasks).toHaveLength(2);
      expect(parsed.data.total).toBe(2);
    });

    it('returns empty when epic has no tasks', async () => {
      mockEpicService.getTasksInEpic.mockResolvedValue([]);

      const result = await callTool(server, 'get_epic_tasks', { epicName: 'Empty' }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.data.tasks).toHaveLength(0);
      expect(parsed.data.total).toBe(0);
    });
  });

  describe('get_epic_timeline', () => {
    it('calls epicRepository.getIssueWithTimeline with issue number', async () => {
      const timeline = {
        number: 1,
        title: '[Auth Epic] Login flow',
        body: 'Epic description',
        state: 'OPEN',
        url: 'https://github.com/owner/repo/issues/1',
        connectedIssues: [
          { number: 10, title: 'Login page', state: 'OPEN' },
        ],
        subIssues: [
          { number: 20, title: 'Sub-task A', state: 'CLOSED', url: 'https://github.com/owner/repo/issues/20' },
        ],
        subIssuesSummary: { total: 1, completed: 1 },
      };
      mockEpicRepository.getIssueWithTimeline.mockResolvedValue(timeline);

      const result = await callTool(server, 'get_epic_timeline', { issueNumber: 1 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockEpicRepository.getIssueWithTimeline).toHaveBeenCalledWith(1);
      expect(parsed.success).toBe(true);
      expect(parsed.data.number).toBe(1);
      expect(parsed.data.connectedIssues).toHaveLength(1);
      expect(parsed.data.subIssues).toHaveLength(1);
      expect(parsed.data.subIssuesSummary.completed).toBe(1);
    });
  });

  describe('validate_epic_integrity', () => {
    it('fetches task then validates integrity', async () => {
      const task = { number: 42, title: 'Login page', status: 'In Progress', epic: 'Auth', wave: 'wave-001' };
      const integrityResult = { maintained: true, violations: [] };

      mockTaskService.getTask.mockResolvedValue(task);
      mockEpicService.validateEpicIntegrity.mockResolvedValue(integrityResult);

      const result = await callTool(server, 'validate_epic_integrity', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockTaskService.getTask).toHaveBeenCalledWith({ issueNumber: 42 });
      expect(mockEpicService.validateEpicIntegrity).toHaveBeenCalledWith(task);
      expect(parsed.success).toBe(true);
      expect(parsed.data.maintained).toBe(true);
      expect(parsed.data.violations).toHaveLength(0);
    });

    it('returns violations when integrity is broken', async () => {
      const task = { number: 42, title: 'Login page', status: 'In Progress', epic: 'Auth', wave: 'wave-002' };
      const integrityResult = {
        maintained: false,
        violations: ['Task #42 is in wave-002 but other Auth tasks are in wave-001'],
      };

      mockTaskService.getTask.mockResolvedValue(task);
      mockEpicService.validateEpicIntegrity.mockResolvedValue(integrityResult);

      const result = await callTool(server, 'validate_epic_integrity', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.data.maintained).toBe(false);
      expect(parsed.data.violations).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('returns isError when epic not found', async () => {
      const { NotFoundError } = await import('@ido4/core');
      mockEpicRepository.getIssueWithTimeline.mockRejectedValue(
        new NotFoundError({ message: 'Issue #999 not found' }),
      );

      const result = await callTool(server, 'get_epic_timeline', { issueNumber: 999 }) as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.code).toBe('NOT_FOUND');
    });
  });
});
