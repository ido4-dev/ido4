/**
 * Analytics tool registrations — MCP tools for governance metrics.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetAnalyticsSchema, GetTaskCycleTimeSchema } from '../schemas/analytics-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerAnalyticsTools(server: McpServer): void {
  server.tool(
    'get_analytics',
    'Get governance analytics — velocity, cycle time, lead time, throughput, and blocking time. Pass a waveName for wave-level metrics, or omit for project-level metrics.',
    GetAnalyticsSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();

      if (args.waveName) {
        const result = await container.analyticsService.getContainerAnalytics(args.waveName);
        return toCallToolResult({ success: true, data: result });
      }

      const result = await container.analyticsService.getProjectAnalytics({
        since: args.since,
        until: args.until,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'get_task_cycle_time',
    'Get cycle time, lead time, and blocking time for a specific task. Shows the complete timeline from start to completion.',
    GetTaskCycleTimeSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.analyticsService.getTaskCycleTime(args.issueNumber);
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
