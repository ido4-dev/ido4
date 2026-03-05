import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

const mockTaskService = {
  startTask: vi.fn(),
  reviewTask: vi.fn(),
  approveTask: vi.fn(),
  blockTask: vi.fn(),
  unblockTask: vi.fn(),
  returnTask: vi.fn(),
  refineTask: vi.fn(),
  readyTask: vi.fn(),
  getTask: vi.fn(),
  getTaskField: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
};

const mockTransitionValidator = {
  validateTransition: vi.fn(),
  validateAllTransitions: vi.fn(),
};

const mockIssueRepository = {
  findPullRequestForIssue: vi.fn(),
  addComment: vi.fn(),
  getSubIssues: vi.fn(),
};

const mockRepositoryRepository = {
  getPullRequestReviews: vi.fn(),
};

const mockContainer = {
  taskService: mockTaskService,
  taskTransitionValidator: mockTransitionValidator,
  issueRepository: mockIssueRepository,
  repositoryRepository: mockRepositoryRepository,
};

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTaskTools } from '../../src/tools/task-tools.js';

describe('Task Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);

    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerTaskTools(server);
  });

  describe('transition tools', () => {
    const toolResponse = {
      success: true,
      data: { issueNumber: 42, fromStatus: 'Ready for Dev', toStatus: 'In Progress' },
      suggestions: [],
      warnings: [],
    };

    const transitionTools = [
      { name: 'start_task', method: 'startTask' },
      { name: 'review_task', method: 'reviewTask' },
      { name: 'approve_task', method: 'approveTask' },
      { name: 'unblock_task', method: 'unblockTask' },
      { name: 'refine_task', method: 'refineTask' },
      { name: 'ready_task', method: 'readyTask' },
    ] as const;

    it.each(transitionTools)('$name calls $method with correct args', async ({ name, method }) => {
      mockTaskService[method].mockResolvedValue(toolResponse);

      await callTool(server, name, {
        issueNumber: 42,
        message: 'test message',
        dryRun: true,
      });

      expect(mockTaskService[method]).toHaveBeenCalledTimes(1);
      const call = mockTaskService[method].mock.calls[0]![0];
      expect(call.issueNumber).toBe(42);
      expect(call.message).toBe('test message');
      expect(call.dryRun).toBe(true);
      expect(call.actor).toEqual({ type: 'ai-agent', id: 'mcp-session', name: 'Claude Code' });
    });

    it('block_task passes reason', async () => {
      mockTaskService.blockTask.mockResolvedValue(toolResponse);

      await callTool(server, 'block_task', {
        issueNumber: 42,
        reason: 'Waiting for API access',
      });

      const call = mockTaskService.blockTask.mock.calls[0]![0];
      expect(call.reason).toBe('Waiting for API access');
    });

    it('return_task passes targetStatus and reason', async () => {
      mockTaskService.returnTask.mockResolvedValue(toolResponse);

      await callTool(server, 'return_task', {
        issueNumber: 42,
        targetStatus: 'In Refinement',
        reason: 'Needs more detail',
      });

      const call = mockTaskService.returnTask.mock.calls[0]![0];
      expect(call.targetStatus).toBe('In Refinement');
      expect(call.reason).toBe('Needs more detail');
    });

    it('serializes response as JSON text content', async () => {
      mockTaskService.startTask.mockResolvedValue(toolResponse);

      const result = await callTool(server, 'start_task', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
      expect(parsed.data.issueNumber).toBe(42);
    });
  });

  describe('read tools', () => {
    it('get_task returns task data wrapped in success envelope', async () => {
      const taskData = { number: 42, title: 'Test task', status: 'In Progress' };
      mockTaskService.getTask.mockResolvedValue(taskData);

      const result = await callTool(server, 'get_task', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
      expect(parsed.data.number).toBe(42);
    });

    it('get_task_field passes field parameter', async () => {
      mockTaskService.getTaskField.mockResolvedValue('In Progress');

      await callTool(server, 'get_task_field', {
        issueNumber: 42,
        field: 'status',
      });

      expect(mockTaskService.getTaskField).toHaveBeenCalledWith({
        issueNumber: 42,
        field: 'status',
      });
    });
  });

  describe('validation tools', () => {
    it('validate_transition calls validator', async () => {
      const validationResult = { canProceed: true, details: [] };
      mockTransitionValidator.validateTransition.mockResolvedValue(validationResult);

      const result = await callTool(server, 'validate_transition', {
        issueNumber: 42,
        transition: 'start',
      }) as { content: Array<{ text: string }> };

      expect(mockTransitionValidator.validateTransition).toHaveBeenCalledWith(42, 'start');
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.data.canProceed).toBe(true);
    });

    it('validate_all_transitions calls validator', async () => {
      const allResult = { issueNumber: 42, transitions: {} };
      mockTransitionValidator.validateAllTransitions.mockResolvedValue(allResult);

      const result = await callTool(server, 'validate_all_transitions', {
        issueNumber: 42,
      }) as { content: Array<{ text: string }> };

      expect(mockTransitionValidator.validateAllTransitions).toHaveBeenCalledWith(42);
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.data.issueNumber).toBe(42);
    });
  });

  describe('list and create tools', () => {
    it('list_tasks passes filters to service', async () => {
      mockTaskService.listTasks.mockResolvedValue({
        success: true,
        data: { tasks: [], total: 0, filters: { status: 'In Progress' } },
        suggestions: [],
        warnings: [],
      });

      const result = await callTool(server, 'list_tasks', {
        status: 'In Progress',
        wave: 'wave-001',
      }) as { content: Array<{ text: string }> };

      expect(mockTaskService.listTasks).toHaveBeenCalledWith({
        status: 'In Progress',
        wave: 'wave-001',
        assignee: undefined,
      });

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
    });

    it('list_tasks works with no filters', async () => {
      mockTaskService.listTasks.mockResolvedValue({
        success: true,
        data: { tasks: [], total: 0, filters: {} },
        suggestions: [],
        warnings: [],
      });

      await callTool(server, 'list_tasks', {});
      expect(mockTaskService.listTasks).toHaveBeenCalledWith({
        status: undefined,
        wave: undefined,
        assignee: undefined,
      });
    });

    it('create_task passes all args to service', async () => {
      mockTaskService.createTask.mockResolvedValue({
        success: true,
        data: {
          issueNumber: 99,
          issueId: 'I_99',
          itemId: 'PVTI_99',
          url: 'https://github.com/owner/repo/issues/99',
          title: 'New task',
          status: 'BACKLOG',
          fieldsSet: ['status'],
        },
        suggestions: [],
        warnings: [],
      });

      const result = await callTool(server, 'create_task', {
        title: 'New task',
        body: 'Task body',
        wave: 'wave-001',
        epic: 'Auth',
      }) as { content: Array<{ text: string }> };

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New task',
          body: 'Task body',
          wave: 'wave-001',
          epic: 'Auth',
        }),
      );

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
      expect(parsed.data.issueNumber).toBe(99);
    });

    it('create_task includes actor', async () => {
      mockTaskService.createTask.mockResolvedValue({
        success: true,
        data: { issueNumber: 1, issueId: '', itemId: '', url: '', title: '', status: '', fieldsSet: [] },
        suggestions: [],
        warnings: [],
      });

      await callTool(server, 'create_task', { title: 'Test' });

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: expect.objectContaining({ type: 'ai-agent' }),
        }),
      );
    });

    it('create_task passes dryRun flag', async () => {
      mockTaskService.createTask.mockResolvedValue({
        success: true,
        data: { issueNumber: 0, issueId: '', itemId: '', url: '', title: 'Dry', status: 'Backlog', fieldsSet: [] },
        suggestions: [],
        warnings: [{ code: 'DRY_RUN', message: 'Dry run', severity: 'info' }],
      });

      await callTool(server, 'create_task', { title: 'Dry', dryRun: true });

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true }),
      );
    });
  });

  describe('PR and review tools', () => {
    it('find_task_pr calls issueRepository.findPullRequestForIssue', async () => {
      const prInfo = {
        number: 15,
        title: 'feat: implement login page',
        url: 'https://github.com/owner/repo/pull/15',
        state: 'OPEN',
        merged: false,
        headRefName: 'feature/login',
      };
      mockIssueRepository.findPullRequestForIssue.mockResolvedValue(prInfo);

      const result = await callTool(server, 'find_task_pr', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockIssueRepository.findPullRequestForIssue).toHaveBeenCalledWith(42);
      expect(parsed.success).toBe(true);
      expect(parsed.data.issueNumber).toBe(42);
      expect(parsed.data.pullRequest.number).toBe(15);
      expect(parsed.data.pullRequest.merged).toBe(false);
    });

    it('find_task_pr returns null when no PR exists', async () => {
      mockIssueRepository.findPullRequestForIssue.mockResolvedValue(null);

      const result = await callTool(server, 'find_task_pr', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data.pullRequest).toBeNull();
    });

    it('get_pr_reviews calls repositoryRepository.getPullRequestReviews', async () => {
      const reviews = [
        { id: 'R_1', author: 'alice', state: 'APPROVED', body: 'Looks good!', submittedAt: '2025-01-15T10:00:00Z' },
        { id: 'R_2', author: 'bob', state: 'CHANGES_REQUESTED', body: 'Fix linting', submittedAt: '2025-01-15T11:00:00Z' },
      ];
      mockRepositoryRepository.getPullRequestReviews.mockResolvedValue(reviews);

      const result = await callTool(server, 'get_pr_reviews', { prNumber: 15 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockRepositoryRepository.getPullRequestReviews).toHaveBeenCalledWith(15);
      expect(parsed.success).toBe(true);
      expect(parsed.data.prNumber).toBe(15);
      expect(parsed.data.reviews).toHaveLength(2);
      expect(parsed.data.total).toBe(2);
    });
  });

  describe('governed communication', () => {
    it('add_task_comment calls issueRepository.addComment', async () => {
      mockIssueRepository.addComment.mockResolvedValue(undefined);

      const result = await callTool(server, 'add_task_comment', {
        issueNumber: 42,
        comment: 'Starting implementation — wave-001 context.',
      }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockIssueRepository.addComment).toHaveBeenCalledWith(42, 'Starting implementation — wave-001 context.');
      expect(parsed.success).toBe(true);
      expect(parsed.data.issueNumber).toBe(42);
      expect(parsed.data.commented).toBe(true);
    });
  });

  describe('task decomposition', () => {
    it('get_sub_issues calls issueRepository.getSubIssues', async () => {
      const subIssues = [
        { number: 50, title: 'Sub-task A', state: 'CLOSED', url: 'https://github.com/owner/repo/issues/50' },
        { number: 51, title: 'Sub-task B', state: 'OPEN', url: 'https://github.com/owner/repo/issues/51' },
        { number: 52, title: 'Sub-task C', state: 'CLOSED', url: 'https://github.com/owner/repo/issues/52' },
      ];
      mockIssueRepository.getSubIssues.mockResolvedValue(subIssues);

      const result = await callTool(server, 'get_sub_issues', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockIssueRepository.getSubIssues).toHaveBeenCalledWith(42);
      expect(parsed.success).toBe(true);
      expect(parsed.data.parentIssueNumber).toBe(42);
      expect(parsed.data.subIssues).toHaveLength(3);
      expect(parsed.data.total).toBe(3);
      expect(parsed.data.completed).toBe(2);
    });

    it('get_sub_issues returns empty when no sub-issues exist', async () => {
      mockIssueRepository.getSubIssues.mockResolvedValue([]);

      const result = await callTool(server, 'get_sub_issues', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.data.subIssues).toHaveLength(0);
      expect(parsed.data.total).toBe(0);
      expect(parsed.data.completed).toBe(0);
    });
  });

  describe('error handling', () => {
    it('returns isError on service failure', async () => {
      const { ValidationError } = await import('@ido4/core');
      mockTaskService.startTask.mockRejectedValue(
        new ValidationError({ message: 'Invalid transition' }),
      );

      const result = await callTool(server, 'start_task', { issueNumber: 42 }) as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.code).toBe('VALIDATION_ERROR');
    });
  });
});
