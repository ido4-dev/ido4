import { z } from 'zod';

export const RegisterAgentSchema = {
  agentId: z.string().describe('Unique identifier for the agent'),
  name: z.string().describe('Human-readable agent name'),
  role: z.enum(['coding', 'review', 'testing', 'documentation', 'general']).describe('Agent role'),
  capabilities: z.array(z.string()).optional().describe('List of agent capabilities'),
};

export const LockTaskSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number to lock'),
  agentId: z.string().optional().describe('Agent ID (defaults to IDO4_AGENT_ID env var or mcp-session)'),
};

export const ReleaseTaskSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number to release'),
  agentId: z.string().optional().describe('Agent ID (defaults to IDO4_AGENT_ID env var or mcp-session)'),
};
