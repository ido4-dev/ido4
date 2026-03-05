/**
 * Task tool registrations — 18 MCP tools for task transitions, queries, list, create,
 * PR/review awareness, governed communication, and task decomposition.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  TaskTransitionSchema,
  BlockTaskSchema,
  ReturnTaskSchema,
  GetTaskSchema,
  ValidateTransitionSchema,
  ValidateAllTransitionsSchema,
  ListTasksSchema,
  CreateTaskSchema,
  FindTaskPrSchema,
  GetPrReviewsSchema,
  AddTaskCommentSchema,
  GetSubIssuesSchema,
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

  // --- List / Create tools ---

  server.tool(
    'list_tasks',
    'List all tasks in the project board with optional filtering by status, wave, or assignee',
    ListTasksSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.listTasks({
        status: args.status,
        wave: args.wave,
        assignee: args.assignee,
      });
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'create_task',
    'Create a new task (GitHub issue) and add it to the project board with initial field values',
    CreateTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.taskService.createTask({
        title: args.title,
        body: args.body,
        initialStatus: args.initialStatus,
        wave: args.wave,
        epic: args.epic,
        aiContext: args.aiContext,
        dependencies: args.dependencies,
        effort: args.effort,
        riskLevel: args.riskLevel,
        aiSuitability: args.aiSuitability,
        taskType: args.taskType,
        actor: createMcpActor(),
        dryRun: args.dryRun,
      });
      return toCallToolResult(result);
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

  // --- PR & Review Awareness ---

  server.tool(
    'find_task_pr',
    'Find the pull request linked to a task. Checks closing references and title/body mentions. Returns PR number, title, state, and merge status.',
    FindTaskPrSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const pr = await container.issueRepository.findPullRequestForIssue(args.issueNumber);
      return toCallToolResult({ success: true, data: { issueNumber: args.issueNumber, pullRequest: pr } });
    }),
  );

  server.tool(
    'get_pr_reviews',
    'Get all reviews for a pull request: reviewer, state (APPROVED/CHANGES_REQUESTED/etc), and feedback. Needed to verify review requirements before approving a task.',
    GetPrReviewsSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const reviews = await container.repositoryRepository.getPullRequestReviews(args.prNumber);
      return toCallToolResult({ success: true, data: { prNumber: args.prNumber, reviews, total: reviews.length } });
    }),
  );

  // --- Governed Communication ---

  server.tool(
    'add_task_comment',
    'Add a governed comment to a task issue. Creates an audit-trailed record of decisions, status updates, or inter-agent communication.',
    AddTaskCommentSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      await container.issueRepository.addComment(args.issueNumber, args.comment);
      return toCallToolResult({ success: true, data: { issueNumber: args.issueNumber, commented: true } });
    }),
  );

  // --- Task Decomposition ---

  server.tool(
    'get_sub_issues',
    'Get all sub-issues of a parent issue (GitHub sub-issues). Shows decomposition structure with state and completion progress.',
    GetSubIssuesSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const subIssues = await container.issueRepository.getSubIssues(args.issueNumber);
      return toCallToolResult({
        success: true,
        data: {
          parentIssueNumber: args.issueNumber,
          subIssues,
          total: subIssues.length,
          completed: subIssues.filter((s) => s.state === 'CLOSED').length,
        },
      });
    }),
  );
}
