/**
 * Task tool registrations — dynamic transition tools from profile + static query/validation tools.
 *
 * Dynamic transition tools are generated from profile.transitions.
 * Static tools (get_task, list_tasks, create_task, etc.) are unchanged.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';
import { formatIdo4ContextComment } from '@ido4/core';
import { z } from 'zod';
import {
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

export function registerTaskTools(server: McpServer, profile: MethodologyProfile): void {
  // --- Dynamic transition tools ---
  registerDynamicTransitionTools(server, profile);

  // --- Read tools ---

  server.tool(
    'get_task',
    `Get full ${profile.workItems.primary.singular.toLowerCase()} details including status, containers, dependencies, and all metadata`,
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
    `Get a specific field value from a ${profile.workItems.primary.singular.toLowerCase()}`,
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
    `List all ${profile.workItems.primary.plural.toLowerCase()} in the project board with optional filtering by status, wave, or assignee`,
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
    `Create a new ${profile.workItems.primary.singular.toLowerCase()} (GitHub issue) and add it to the project board with initial field values`,
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
    `Validate whether a specific transition is possible for a ${profile.workItems.primary.singular.toLowerCase()} without executing it`,
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
    `Check all possible transitions for a ${profile.workItems.primary.singular.toLowerCase()} — shows which workflow actions are currently valid`,
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
    `Find the pull request linked to a ${profile.workItems.primary.singular.toLowerCase()}. Checks closing references and title/body mentions. Returns PR number, title, state, and merge status.`,
    FindTaskPrSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const pr = await container.issueRepository.findPullRequestForIssue(args.issueNumber);
      return toCallToolResult({ success: true, data: { issueNumber: args.issueNumber, pullRequest: pr } });
    }),
  );

  server.tool(
    'get_pr_reviews',
    `Get all reviews for a pull request: reviewer, state (APPROVED/CHANGES_REQUESTED/etc), and feedback. Needed to verify review requirements before approving a ${profile.workItems.primary.singular.toLowerCase()}.`,
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
    `Add a governed comment to a ${profile.workItems.primary.singular.toLowerCase()} issue. Creates an audit-trailed record of decisions, status updates, or inter-agent communication.`,
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

/**
 * Generate transition tools dynamically from profile.transitions.
 *
 * Deduplicates actions (e.g., 'return' appears multiple times with different from states).
 * Schema variants:
 * - block transition: requires 'reason' parameter
 * - return transition: requires 'targetStatus' + 'reason' parameters
 * - all others: standard schema (issueNumber, message, skipValidation, dryRun)
 */
function registerDynamicTransitionTools(server: McpServer, profile: MethodologyProfile): void {
  const itemLabel = profile.workItems.primary.singular.toLowerCase();
  const blockAction = profile.behaviors.blockTransition;
  const returnAction = profile.behaviors.returnTransition;

  // Collect unique actions with their metadata
  const actionMap = new Map<string, { fromStates: string[]; toState: string; label: string }>();

  for (const transition of profile.transitions) {
    const existing = actionMap.get(transition.action);
    if (existing) {
      // Merge from states (e.g., 'return' can come from multiple states)
      for (const from of transition.from) {
        if (!existing.fromStates.includes(from)) {
          existing.fromStates.push(from);
        }
      }
    } else {
      actionMap.set(transition.action, {
        fromStates: [...transition.from],
        toState: transition.to,
        label: transition.label,
      });
    }
  }

  // Resolve state keys to names for descriptions
  const stateNameMap = new Map(profile.states.map((s) => [s.key, s.name]));
  const resolveStateName = (key: string): string => stateNameMap.get(key) ?? key;

  for (const [action, meta] of actionMap) {
    const fromStateNames = meta.fromStates.map(resolveStateName).join(', ');
    const toolName = `${action}_task`;
    const description = `${meta.label}. Valid from: ${fromStateNames}`;

    if (action === blockAction) {
      // Block schema: requires reason
      server.tool(
        toolName,
        description,
        {
          issueNumber: z.number().int().positive().describe(`GitHub issue number of the ${itemLabel}`),
          reason: z.string().describe(`Why the ${itemLabel} is blocked`),
          message: z.string().optional().describe('Comment to add to the issue'),
          context: z.string().optional().describe('Structured development context (approach, decisions, interfaces created). Written as an ido4 context comment on the issue.'),
          skipValidation: z.boolean().optional().describe('Skip BRE validation (not recommended)'),
          dryRun: z.boolean().optional().describe('Validate without executing the transition'),
        },
        async (args) => handleErrors(async () => {
          const container = await getContainer();
          // Write structured context comment if provided
          if (args.context) {
            const contextComment = formatIdo4ContextComment({
              transition: action,
              agent: createMcpActor().id,
              content: args.context,
            });
            await container.issueRepository.addComment(args.issueNumber, contextComment);
          }
          const result = await container.taskService.executeTransition(action, {
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
    } else if (action === returnAction) {
      // Return schema: requires targetStatus + reason
      server.tool(
        toolName,
        description,
        {
          issueNumber: z.number().int().positive().describe(`GitHub issue number of the ${itemLabel}`),
          targetStatus: z.string().describe('Target status to return to'),
          reason: z.string().describe(`Why the ${itemLabel} is being returned`),
          message: z.string().optional().describe('Comment to add to the issue'),
          context: z.string().optional().describe('Structured development context (approach, decisions, interfaces created). Written as an ido4 context comment on the issue.'),
          skipValidation: z.boolean().optional().describe('Skip BRE validation (not recommended)'),
          dryRun: z.boolean().optional().describe('Validate without executing the transition'),
        },
        async (args) => handleErrors(async () => {
          const container = await getContainer();
          // Write structured context comment if provided
          if (args.context) {
            const contextComment = formatIdo4ContextComment({
              transition: action,
              agent: createMcpActor().id,
              content: args.context,
            });
            await container.issueRepository.addComment(args.issueNumber, contextComment);
          }
          const result = await container.taskService.executeTransition(action, {
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
    } else {
      // Standard schema
      server.tool(
        toolName,
        description,
        {
          issueNumber: z.number().int().positive().describe(`GitHub issue number of the ${itemLabel}`),
          message: z.string().optional().describe('Comment to add to the issue'),
          context: z.string().optional().describe('Structured development context (approach, decisions, interfaces created). Written as an ido4 context comment on the issue.'),
          skipValidation: z.boolean().optional().describe('Skip BRE validation (not recommended)'),
          dryRun: z.boolean().optional().describe('Validate without executing the transition'),
        },
        async (args) => handleErrors(async () => {
          const container = await getContainer();
          // Write structured context comment if provided
          if (args.context) {
            const contextComment = formatIdo4ContextComment({
              transition: action,
              agent: createMcpActor().id,
              content: args.context,
            });
            await container.issueRepository.addComment(args.issueNumber, contextComment);
          }
          const result = await container.taskService.executeTransition(action, {
            issueNumber: args.issueNumber,
            actor: createMcpActor(),
            message: args.message,
            skipValidation: args.skipValidation,
            dryRun: args.dryRun,
          });
          return toCallToolResult(result);
        }),
      );
    }
  }
}
