import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool, hasRegisteredTool } from '../helpers/test-utils.js';

const mockTaskService = {
  executeTransition: vi.fn(),
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
  getIssueComments: vi.fn(),
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
import { HYDRO_PROFILE, SHAPE_UP_PROFILE, SCRUM_PROFILE } from '@ido4/core';
import { registerTaskTools } from '../../src/tools/task-tools.js';

describe('Task Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);

    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerTaskTools(server, HYDRO_PROFILE);
  });

  describe('dynamic transition tools', () => {
    const toolResponse = {
      success: true,
      data: { issueNumber: 42, fromStatus: 'Ready for Dev', toStatus: 'In Progress' },
      suggestions: [],
      warnings: [],
    };

    const standardTransitions = [
      'start_task', 'review_task', 'approve_task',
      'unblock_task', 'refine_task', 'ready_task', 'complete_task',
    ];

    it.each(standardTransitions)('%s calls executeTransition with correct action', async (toolName) => {
      mockTaskService.executeTransition.mockResolvedValue(toolResponse);

      await callTool(server, toolName, {
        issueNumber: 42,
        message: 'test message',
        dryRun: true,
      });

      expect(mockTaskService.executeTransition).toHaveBeenCalledTimes(1);
      const [action, request] = mockTaskService.executeTransition.mock.calls[0]!;
      const expectedAction = toolName.replace('_task', '');
      expect(action).toBe(expectedAction);
      expect(request.issueNumber).toBe(42);
      expect(request.message).toBe('test message');
      expect(request.dryRun).toBe(true);
      expect(request.actor).toEqual({ type: 'ai-agent', id: 'mcp-session', name: 'Claude Code' });
    });

    it('block_task passes reason via executeTransition', async () => {
      mockTaskService.executeTransition.mockResolvedValue(toolResponse);

      await callTool(server, 'block_task', {
        issueNumber: 42,
        reason: 'Waiting for API access',
      });

      const [action, request] = mockTaskService.executeTransition.mock.calls[0]!;
      expect(action).toBe('block');
      expect(request.reason).toBe('Waiting for API access');
    });

    it('return_task passes targetStatus and reason via executeTransition', async () => {
      mockTaskService.executeTransition.mockResolvedValue(toolResponse);

      await callTool(server, 'return_task', {
        issueNumber: 42,
        targetStatus: 'In Refinement',
        reason: 'Needs more detail',
      });

      const [action, request] = mockTaskService.executeTransition.mock.calls[0]!;
      expect(action).toBe('return');
      expect(request.targetStatus).toBe('In Refinement');
      expect(request.reason).toBe('Needs more detail');
    });

    it('serializes response as JSON text content', async () => {
      mockTaskService.executeTransition.mockResolvedValue(toolResponse);

      const result = await callTool(server, 'start_task', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
      expect(parsed.data.issueNumber).toBe(42);
    });

    it('Hydro generates 9 transition tools', () => {
      const expected = [
        'refine_task', 'ready_task', 'start_task', 'review_task',
        'approve_task', 'complete_task', 'block_task', 'unblock_task', 'return_task',
      ];
      for (const name of expected) {
        expect(hasRegisteredTool(server, name), `Missing: ${name}`).toBe(true);
      }
    });
  });

  describe('profile-specific transition tools', () => {
    it('Shape Up generates shape_task, bet_task, ship_task, kill_task', () => {
      const shapeUpServer = new McpServer({ name: 'test', version: '0.1.0' });
      registerTaskTools(shapeUpServer, SHAPE_UP_PROFILE);

      const expected = ['shape_task', 'bet_task', 'start_task', 'review_task', 'ship_task', 'block_task', 'unblock_task', 'kill_task', 'return_task'];
      for (const name of expected) {
        expect(hasRegisteredTool(shapeUpServer, name), `Missing: ${name}`).toBe(true);
      }
      // Should NOT have approve_task or refine_task
      expect(hasRegisteredTool(shapeUpServer, 'approve_task')).toBe(false);
      expect(hasRegisteredTool(shapeUpServer, 'refine_task')).toBe(false);
    });

    it('Scrum generates plan_task, no refine_task', () => {
      const scrumServer = new McpServer({ name: 'test', version: '0.1.0' });
      registerTaskTools(scrumServer, SCRUM_PROFILE);

      expect(hasRegisteredTool(scrumServer, 'plan_task')).toBe(true);
      expect(hasRegisteredTool(scrumServer, 'refine_task')).toBe(false);
      expect(hasRegisteredTool(scrumServer, 'complete_task')).toBe(false);
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

    it('get_task_comments classifies governed comments as ai-agent and others as human', async () => {
      mockIssueRepository.getIssueComments.mockResolvedValue([
        {
          id: 'C_1',
          body: '<!-- ido4:context transition=start agent=mcp-session timestamp=2026-04-26T10:00:00Z -->\nApproach: extend the type.\n<!-- /ido4:context -->',
          author: 'b-coman',
          createdAt: '2026-04-26T10:00:00Z',
          updatedAt: '2026-04-26T10:00:00Z',
        },
        {
          id: 'C_2',
          body: 'Looks good to me, ship it.',
          author: 'reviewer-jane',
          createdAt: '2026-04-26T11:30:00Z',
          updatedAt: '2026-04-26T11:30:00Z',
        },
      ]);

      const result = await callTool(server, 'get_task_comments', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockIssueRepository.getIssueComments).toHaveBeenCalledWith(42);
      expect(parsed.success).toBe(true);
      expect(parsed.data.issueNumber).toBe(42);
      expect(parsed.data.total).toBe(2);
      expect(parsed.data.comments).toHaveLength(2);
      expect(parsed.data.comments[0].actorType).toBe('ai-agent');
      expect(parsed.data.comments[0].author).toBe('b-coman');
      expect(parsed.data.comments[1].actorType).toBe('human');
      expect(parsed.data.comments[1].author).toBe('reviewer-jane');
    });

    it('get_task_comments returns empty list when no comments exist', async () => {
      mockIssueRepository.getIssueComments.mockResolvedValue([]);

      const result = await callTool(server, 'get_task_comments', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data.total).toBe(0);
      expect(parsed.data.comments).toHaveLength(0);
    });
  });

  describe('spec lineage', () => {
    it('get_task_lineage recovers ref from issue body when marker present', async () => {
      mockTaskService.getTask.mockResolvedValue({
        id: 'I_42',
        number: 42,
        title: 'Wire login',
        body: '<!-- ido4-lineage: ref=AUTH-01 -->\n\nReal task body.',
        status: 'In Progress',
        containers: {},
      });

      const result = await callTool(server, 'get_task_lineage', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(mockTaskService.getTask).toHaveBeenCalledWith({ issueNumber: 42 });
      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ issueNumber: 42, ref: 'AUTH-01' });
    });

    it('get_task_lineage returns null ref when marker absent', async () => {
      mockTaskService.getTask.mockResolvedValue({
        id: 'I_42',
        number: 42,
        title: 'Manually-created issue',
        body: 'No lineage marker here.',
        status: 'Backlog',
        containers: {},
      });

      const result = await callTool(server, 'get_task_lineage', { issueNumber: 42 }) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ issueNumber: 42, ref: null });
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
      mockTaskService.executeTransition.mockRejectedValue(
        new ValidationError({ message: 'Invalid transition' }),
      );

      const result = await callTool(server, 'start_task', { issueNumber: 42 }) as { isError: boolean; content: Array<{ text: string }> };
      expect(result.isError).toBe(true);

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('get_methodology_profile (Phase 5 F7)', () => {
    // Phase 5 F7: subagents (Claude Code plugin agents) cannot read MCP
    // resources, only tools. The ido4://methodology/profile resource is
    // unreachable from the PM agent. This tool mirrors the resource and
    // grounds the agent's methodology-specific reasoning in the actual
    // loaded profile rather than pattern-matched training data.

    it('is registered for Hydro profile', () => {
      expect(hasRegisteredTool(server, 'get_methodology_profile')).toBe(true);
    });

    it('returns the resolved Hydro profile via container.profile', async () => {
      // Add profile to mock container so the tool can return it
      const containerWithProfile = { ...mockContainer, profile: HYDRO_PROFILE };
      mockGetContainer.mockResolvedValue(containerWithProfile);

      const result = await callTool(server, 'get_methodology_profile', {}) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe('hydro');
      // Verify load-bearing fields the PM agent reasons against:
      expect(Array.isArray(parsed.data.principles)).toBe(true);
      expect(parsed.data.principles.length).toBe(5); // Hydro: 5 principles
      expect(Array.isArray(parsed.data.states)).toBe(true);
      expect(Array.isArray(parsed.data.transitions)).toBe(true);
      expect(parsed.data.semantics).toBeDefined();
      expect(Array.isArray(parsed.data.containers)).toBe(true);
      expect(parsed.data.compliance).toBeDefined();
      expect(parsed.data.compliance.weights).toBeDefined();
    });

    it('returns the resolved Scrum profile when registered with SCRUM_PROFILE', async () => {
      const scrumServer = new McpServer({ name: 'test', version: '0.1.0' });
      registerTaskTools(scrumServer, SCRUM_PROFILE);

      const containerWithProfile = { ...mockContainer, profile: SCRUM_PROFILE };
      mockGetContainer.mockResolvedValue(containerWithProfile);

      const result = await callTool(scrumServer, 'get_methodology_profile', {}) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe('scrum');
      // Sharp regression test: Scrum has only ONE entry in principles[]
      // (Sprint Singularity); DoR/DoD/sprint-goal live in integrityRules[].
      expect(parsed.data.principles.length).toBe(1);
    });

    it('returns the resolved Shape Up profile when registered with SHAPE_UP_PROFILE', async () => {
      const shapeUpServer = new McpServer({ name: 'test', version: '0.1.0' });
      registerTaskTools(shapeUpServer, SHAPE_UP_PROFILE);

      const containerWithProfile = { ...mockContainer, profile: SHAPE_UP_PROFILE };
      mockGetContainer.mockResolvedValue(containerWithProfile);

      const result = await callTool(shapeUpServer, 'get_methodology_profile', {}) as { content: Array<{ text: string }> };
      const parsed = JSON.parse(result.content[0]!.text);

      expect(parsed.success).toBe(true);
      expect(parsed.data.id).toBe('shape-up');
      expect(parsed.data.principles.length).toBe(4); // Shape Up: 4 principles
    });
  });
});
