/**
 * Work distribution tools — intelligent task recommendation and handoff coordination.
 *
 * - get_next_task: Recommends the highest-leverage task for an agent
 * - complete_and_handoff: Completes a task and coordinates downstream handoffs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetNextTaskSchema, CompleteAndHandoffSchema } from '../schemas/distribution-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';
import { createMcpActor } from '../helpers/actor.js';

export function registerDistributionTools(server: McpServer): void {
  server.tool(
    'get_next_task',
    'Recommends the highest-leverage task for an agent to work on next. Scores candidates by cascade value (what does it unblock?), epic momentum (finish what\'s started), capability match (agent role vs task type), and dependency freshness (recently-unblocked momentum). Returns top recommendation with reasoning and 2-3 alternatives. Read-only — does not start or lock the task.',
    GetNextTaskSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const agentId = args.agentId ?? process.env.IDO4_AGENT_ID ?? 'mcp-session';
      const result = await container.workDistributionService.getNextTask(agentId, args.waveName);
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'complete_and_handoff',
    'Completes a task (approve transition through full BRE validation), releases the agent\'s lock, identifies newly-unblocked downstream tasks with agent recommendations, and suggests the completing agent\'s next task. Use this instead of separate approve_task + release_task + get_next_task calls.',
    CompleteAndHandoffSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const agentId = args.agentId ?? process.env.IDO4_AGENT_ID ?? 'mcp-session';
      const actor = createMcpActor(agentId);
      const result = await container.workDistributionService.completeAndHandoff(
        args.issueNumber, agentId, actor,
      );
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
