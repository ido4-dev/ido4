/**
 * Task tool registrations — 12 MCP tools for task state transitions and queries.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  TaskTransitionSchema,
  BlockTaskSchema,
  ReturnTaskSchema,
  GetTaskSchema,
  ValidateTransitionSchema,
  ValidateAllTransitionsSchema,
} from '../schemas/index.js';
import { handleErrors, toCallToolResult, getContainer, createMcpActor } from '../helpers/index.js';

export function registerTaskTools(server: McpServer): void {
  // --- Transition tools ---

  server.tool(
    'start_task',
    'Start working on a task — transitions from Ready for Dev to In Progress with BRE validation',
    TaskTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.startTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'review_task',
    'Submit a task for review — transitions from In Progress to In Review with BRE validation',
    TaskTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.reviewTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'approve_task',
    'Approve and complete a task — transitions from In Review to Done with BRE validation',
    TaskTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.approveTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'block_task',
    'Block a task — transitions to Blocked status with a required reason',
    BlockTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.blockTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        reason: args.reason,
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'unblock_task',
    'Unblock a task — transitions from Blocked back to Ready for Dev',
    TaskTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.unblockTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'return_task',
    'Return a task to a previous status — backward transition with reason',
    ReturnTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.returnTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        targetStatus: args.targetStatus,
        reason: args.reason,
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'refine_task',
    'Move a task into refinement — transitions from Backlog to In Refinement',
    TaskTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.refineTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'ready_task',
    'Mark a task as ready for development — transitions from In Refinement to Ready for Dev',
    TaskTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.readyTask({
        issueNumber: args.issueNumber,
        actor: createMcpActor(),
        message: args.message,
        skipValidation: args.skipValidation,
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
    }),
  );

  // --- Read tools ---

  server.tool(
    'get_task',
    'Get full task details including status, wave, epic, dependencies, and all metadata',
    GetTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const task = await container.taskService.getTask({
        issueNumber: args.issueNumber,
      });
      return toCallToolResult({ success: true, data: task });
    }),
  );

  server.tool(
    'get_task_field',
    'Get a specific field value from a task',
    GetTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const value = await container.taskService.getTaskField({
        issueNumber: args.issueNumber,
        field: args.field,
      });
      return toCallToolResult({ success: true, data: value });
    }),
  );

  // --- Validation tools ---

  server.tool(
    'validate_transition',
    'Validate whether a specific transition is possible for a task without executing it',
    ValidateTransitionSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskTransitionValidator.validateTransition(
        args.issueNumber,
        args.transition,
      );
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'validate_all_transitions',
    'Check all possible transitions for a task — shows which workflow actions are currently valid',
    ValidateAllTransitionsSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskTransitionValidator.validateAllTransitions(
        args.issueNumber,
      );
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
