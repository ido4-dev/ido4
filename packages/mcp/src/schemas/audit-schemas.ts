import { z } from 'zod';

export const QueryAuditTrailSchema = {
  since: z.string().optional().describe('ISO-8601 start time (e.g., "2024-01-01T00:00:00Z")'),
  until: z.string().optional().describe('ISO-8601 end time'),
  actorId: z.string().optional().describe('Filter by actor ID (e.g., "mcp-session", agent ID)'),
  transition: z.string().optional().describe('Filter by transition type (e.g., "start", "approve")'),
  issueNumber: z.number().int().positive().optional().describe('Filter by GitHub issue number'),
  sessionId: z.string().optional().describe('Filter by session ID'),
  eventType: z.string().optional().describe('Filter by event type (e.g., "task.transition")'),
  limit: z.number().int().positive().max(1000).optional().describe('Max events to return (default: 100)'),
  offset: z.number().int().min(0).optional().describe('Skip first N events for pagination'),
};

export const GetAuditSummarySchema = {
  since: z.string().optional().describe('ISO-8601 start time for summary period'),
  until: z.string().optional().describe('ISO-8601 end time for summary period'),
};
