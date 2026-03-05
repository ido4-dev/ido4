/**
 * Zod schemas for task-related MCP tool inputs.
 */

import { z } from 'zod';

export const TaskTransitionSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
  message: z.string().optional().describe('Comment to add to the issue'),
  skipValidation: z.boolean().optional().describe('Skip BRE validation (not recommended)'),
  dryRun: z.boolean().optional().describe('Validate without executing the transition'),
};

export const BlockTaskSchema = {
  ...TaskTransitionSchema,
  reason: z.string().describe('Why the task is blocked'),
};

export const ReturnTaskSchema = {
  ...TaskTransitionSchema,
  targetStatus: z.string().describe('Target status to return to'),
  reason: z.string().describe('Why the task is being returned'),
};

export const GetTaskSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
  field: z.string().optional().describe('Specific field to retrieve'),
};

export const ValidateTransitionSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
  transition: z.string().describe('Transition type to validate (start, review, approve, block, unblock, return, refine, ready)'),
};

export const ValidateAllTransitionsSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
};

export const ListTasksSchema = {
  status: z.string().optional().describe('Filter by status (e.g., "In Progress", "Blocked", "Ready for Dev")'),
  wave: z.string().optional().describe('Filter by wave name'),
  assignee: z.string().optional().describe('Filter by assignee GitHub login'),
};

export const CreateTaskSchema = {
  title: z.string().describe('Issue title'),
  body: z.string().optional().describe('Issue body / description (supports Markdown)'),
  initialStatus: z.string().optional().describe('Initial status key (defaults to BACKLOG). Keys: BACKLOG, IN_REFINEMENT, READY_FOR_DEV'),
  wave: z.string().optional().describe('Wave name to assign'),
  epic: z.string().optional().describe('Epic name'),
  aiContext: z.string().optional().describe('Context for AI agents working on this task'),
  dependencies: z.string().optional().describe('Dependency references (e.g., "#12, #15")'),
  effort: z.string().optional().describe('Effort estimate key: XS, S, M, L, XL'),
  riskLevel: z.string().optional().describe('Risk level key: LOW, MEDIUM, HIGH, CRITICAL'),
  aiSuitability: z.string().optional().describe('AI suitability key: AI_ONLY, AI_REVIEWED, HYBRID, HUMAN_ONLY'),
  taskType: z.string().optional().describe('Task type key: FEATURE, BUG, ENHANCEMENT, DOCUMENTATION, TESTING'),
  dryRun: z.boolean().optional().describe('Validate without creating the issue'),
};

export const FindTaskPrSchema = {
  issueNumber: z.number().int().positive().describe('Task issue number to find linked PR for'),
};

export const GetPrReviewsSchema = {
  prNumber: z.number().int().positive().describe('Pull request number'),
};

export const AddTaskCommentSchema = {
  issueNumber: z.number().int().positive().describe('Task issue number'),
  comment: z.string().describe('Comment text (supports Markdown)'),
};

export const GetSubIssuesSchema = {
  issueNumber: z.number().int().positive().describe('Parent issue number'),
};
