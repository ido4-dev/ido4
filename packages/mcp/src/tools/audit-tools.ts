/**
 * Audit tool registrations — 2 MCP tools for governance audit trail queries.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { QueryAuditTrailSchema, GetAuditSummarySchema } from '../schemas/audit-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerAuditTools(server: McpServer): void {
  server.tool(
    'query_audit_trail',
    'Query the governance audit trail. Returns persisted events filtered by time range, actor, transition type, issue number, or session. Use for compliance reporting, standup summaries, and governance investigation.',
    QueryAuditTrailSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.auditService.queryEvents({
        since: args.since,
        until: args.until,
        actorId: args.actorId,
        actorType: args.actorType,
        transition: args.transition,
        issueNumber: args.issueNumber,
        sessionId: args.sessionId,
        eventType: args.eventType,
        executed: args.executed,
        limit: args.limit,
        offset: args.offset,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'get_audit_summary',
    'Get a summary of governance activity over a time period. Returns event counts grouped by type, actor, and transition, plus recent activity. Use for standups and compliance overviews.',
    GetAuditSummarySchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.auditService.getSummary({
        since: args.since,
        until: args.until,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
