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
};

const mockTransitionValidator = {
  validateTransition: vi.fn(),
  validateAllTransitions: vi.fn(),
};

const mockContainer = {
  taskService: mockTaskService,
  taskTransitionValidator: mockTransitionValidator,
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
