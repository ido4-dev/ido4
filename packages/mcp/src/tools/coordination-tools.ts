/**
 * Coordination tools — multi-agent awareness and coordination state.
 *
 * - get_coordination_state: Full coordination picture for an agent
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetCoordinationStateSchema } from '../schemas/coordination-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';
import { aggregateCoordinationData } from '../aggregators/coordination-aggregator.js';

export function registerCoordinationTools(server: McpServer): void {
  server.tool(
    'get_coordination_state',
    'Returns the full multi-agent coordination picture: who is working on what, recent governance events, handoff recommendations, and your next task suggestion. Use this to stay aware of what other agents are doing and coordinate effectively. Accepts an optional "since" cursor for efficient polling.',
    GetCoordinationStateSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await aggregateCoordinationData(container, {
        agentId: args.agentId,
        since: args.since,
        limit: args.limit,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
