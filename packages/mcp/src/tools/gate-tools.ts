/**
 * Quality gate tools — governance enforcement at merge time.
 *
 * - check_merge_readiness: Run all governance checks for a task and return structured pass/fail
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CheckMergeReadinessSchema } from '../schemas/gate-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';
import { createMcpActor } from '../helpers/actor.js';

export function registerGateTools(server: McpServer): void {
  server.tool(
    'check_merge_readiness',
    'Run all governance checks for a task before merge: workflow compliance, PR review requirements, dependency completion, epic integrity, security gates, and compliance threshold. Returns structured pass/fail with remediation guidance. Supports override with audited reason for emergency situations.',
    CheckMergeReadinessSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const actor = createMcpActor();
      const result = await container.mergeReadinessService.checkMergeReadiness(
        args.issueNumber,
        {
          overrideReason: args.overrideReason,
          actor,
          config: {
            minReviews: args.minReviews,
            minComplianceScore: args.minComplianceScore,
          },
        },
      );
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
