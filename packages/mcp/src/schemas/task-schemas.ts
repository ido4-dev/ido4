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
