import { z } from 'zod';

export const GetAnalyticsSchema = {
  waveName: z.string().optional().describe('Wave name to get analytics for. If omitted, returns project-level analytics.'),
  since: z.string().optional().describe('ISO-8601 start time for analytics period'),
  until: z.string().optional().describe('ISO-8601 end time for analytics period'),
};

export const GetTaskCycleTimeSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number to get cycle time for'),
};
