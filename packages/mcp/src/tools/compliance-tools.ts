/**
 * Compliance tool registrations — MCP tool for governance compliance scoring.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ComputeComplianceScoreSchema } from '../schemas/compliance-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerComplianceTools(server: McpServer): void {
  server.tool(
    'compute_compliance_score',
    'Compute a deterministic governance compliance score (0-100) from audit trail data. Returns a weighted score across 5 categories: BRE pass rate (40%), quality gate satisfaction (20%), process adherence (20%), epic integrity (10%), and flow efficiency (10%). Includes letter grade, per-category breakdown, and actionable recommendations. Use for compliance reports, dashboards, and governance health checks.',
    ComputeComplianceScoreSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.complianceService.computeComplianceScore({
        since: args.since,
        until: args.until,
        waveName: args.waveName,
        actorId: args.actorId,
      });
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
