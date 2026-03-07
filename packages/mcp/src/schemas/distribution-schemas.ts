import { z } from 'zod';

export const GetNextTaskSchema = {
  agentId: z.string().optional().describe('Agent ID requesting the recommendation. Defaults to IDO4_AGENT_ID env var or "mcp-session".'),
  waveName: z.string().optional().describe('Wave to search for candidates. Defaults to the active wave.'),
};

export const CompleteAndHandoffSchema = {
  issueNumber: z.number().describe('The task number to mark as complete (approve).'),
  agentId: z.string().optional().describe('Agent ID completing the task. Defaults to IDO4_AGENT_ID env var or "mcp-session".'),
};
