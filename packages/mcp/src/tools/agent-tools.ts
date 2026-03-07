/**
 * Agent tool registrations — 4 MCP tools for multi-agent governance.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RegisterAgentSchema, LockTaskSchema, ReleaseTaskSchema } from '../schemas/agent-schemas.js';
import { handleErrors, toCallToolResult, getContainer, createMcpActor } from '../helpers/index.js';

export function registerAgentTools(server: McpServer): void {
  server.tool(
    'register_agent',
    'Register an AI agent for multi-agent governance. Each agent gets a unique identity for audit trails and task locking.',
    RegisterAgentSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.agentService.registerAgent({
        agentId: args.agentId,
        name: args.name,
        role: args.role,
        capabilities: args.capabilities,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'list_agents',
    'List all registered agents and their status.',
    {},
    async () => handleErrors(async () => {
      const container = await getContainer();
      const agents = await container.agentService.listAgents();
      return toCallToolResult({ success: true, data: { agents, total: agents.length } });
    }),
  );

  server.tool(
    'lock_task',
    'Lock a task for exclusive work by an agent. Prevents other agents from working on the same task. Locks expire after 30 minutes.',
    LockTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const actor = createMcpActor(args.agentId);
      const lock = await container.agentService.lockTask(actor.id, args.issueNumber);
      return toCallToolResult({ success: true, data: lock });
    }),
  );

  server.tool(
    'release_task',
    'Release a task lock, allowing other agents to work on it.',
    ReleaseTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const actor = createMcpActor(args.agentId);
      await container.agentService.releaseTask(actor.id, args.issueNumber);
      return toCallToolResult({ success: true, data: { issueNumber: args.issueNumber, released: true } });
    }),
  );
}
