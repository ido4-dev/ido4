import { z } from 'zod';

export const GetCoordinationStateSchema = {
  agentId: z.string().optional().describe('Agent ID requesting coordination state. Defaults to IDO4_AGENT_ID env var or "mcp-session".'),
  since: z.string().optional().describe('ISO-8601 timestamp — only return events after this point. Defaults to 24h ago.'),
  limit: z.number().optional().describe('Maximum number of recent events to return. Defaults to 50.'),
};
