import { z } from 'zod';

export const GetStandupDataSchema = {
  waveName: z.string().optional().describe('Wave name (auto-detects active wave if omitted)'),
  auditHoursBack: z.number().optional().describe('Hours of audit trail history to include (default: 24)'),
};

export const GetBoardDataSchema = {
  waveName: z.string().optional().describe('Wave name (auto-detects active wave if omitted)'),
};

export const GetComplianceDataSchema = {
  waveName: z.string().optional().describe('Scope compliance to a specific wave'),
  since: z.string().optional().describe('ISO-8601 start of compliance period'),
  until: z.string().optional().describe('ISO-8601 end of compliance period'),
  actorId: z.string().optional().describe('Scope compliance to a specific actor/agent'),
};

export const GetHealthDataSchema = {
  waveName: z.string().optional().describe('Wave name (auto-detects active wave if omitted)'),
};

export const GetTaskExecutionDataSchema = {
  issueNumber: z.number().int().positive().describe('Issue number of the task to get execution context for'),
  includeComments: z.boolean().optional().describe('Include GitHub issue comments (default: true)'),
};
