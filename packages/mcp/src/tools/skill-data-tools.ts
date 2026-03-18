/**
 * Composite skill data tools — each aggregates all data a skill needs
 * into a single tool call, replacing 5-12 individual calls.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  GetStandupDataSchema,
  GetBoardDataSchema,
  GetComplianceDataSchema,
  GetHealthDataSchema,
  GetTaskExecutionDataSchema,
} from '../schemas/skill-data-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';
import { aggregateStandupData } from '../aggregators/standup-aggregator.js';
import { aggregateBoardData } from '../aggregators/board-aggregator.js';
import { aggregateComplianceData } from '../aggregators/compliance-aggregator.js';
import { aggregateHealthData } from '../aggregators/health-aggregator.js';
import { aggregateTaskExecutionData } from '../aggregators/task-execution-aggregator.js';

export function registerSkillDataTools(server: McpServer): void {
  server.tool(
    'get_standup_data',
    'Gather all data needed for a governance standup briefing in one call. Returns wave status, task list, PR review statuses for In Review tasks, dependency analysis for blocked tasks, audit trail (last 24h), analytics, agent list, and compliance score. Replaces 10-12 individual tool calls.',
    GetStandupDataSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await aggregateStandupData(container, {
        containerName: args.waveName,
        auditHoursBack: args.auditHoursBack,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'get_board_data',
    'Gather all data needed for an intelligent kanban board in one call. Returns wave status, task list with PR and lock annotations for active tasks, analytics, and agent list. Replaces 5-6 individual tool calls.',
    GetBoardDataSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await aggregateBoardData(container, {
        containerName: args.waveName,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'get_compliance_data',
    'Gather all data needed for a comprehensive compliance assessment in one call. Returns compliance score, audit trail, analytics, wave list, task list, dependency analysis for blocked tasks, and epic integrity checks. Replaces 7+ individual tool calls.',
    GetComplianceDataSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await aggregateComplianceData(container, {
        since: args.since,
        until: args.until,
        actorId: args.actorId,
        containerName: args.waveName,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'get_health_data',
    'Gather all data needed for a quick governance health check in one call. Returns wave status, compliance score, analytics, and agent list. Parallel-only (no per-task iterations) for speed. Replaces 5 individual tool calls.',
    GetHealthDataSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await aggregateHealthData(container, {
        containerName: args.waveName,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'get_task_execution_data',
    'Gather all context needed to execute a task: full spec with comments, upstream dependency details (bodies + context comments), epic siblings with completion context, downstream dependents, and epic progress. Use before starting work on a task.',
    GetTaskExecutionDataSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await aggregateTaskExecutionData(container, {
        issueNumber: args.issueNumber,
        includeComments: args.includeComments,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
