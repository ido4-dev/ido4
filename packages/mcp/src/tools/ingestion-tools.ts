/**
 * Ingestion tool registration — ingest_spec MCP tool.
 *
 * Creates IngestionService on-demand from the shared container (like SandboxService pattern
 * but uses getContainer() since the project must already be initialized).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IngestSpecSchema } from '../schemas/ingestion-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';
import { IngestionService } from '@ido4/core';

export function registerIngestionTools(server: McpServer): void {
  server.tool(
    'ingest_spec',
    'Ingest a spec artifact — parses structured markdown into governed GitHub issues with proper fields, containers, dependencies, and sub-issue relationships. Tasks enter at the top of the funnel (Backlog/Raw). Use dryRun=true to preview without creating issues.',
    IngestSpecSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const service = new IngestionService(
        container.taskService,
        container.issueRepository,
        container.projectRepository,
        container.profile,
        container.logger,
      );
      const result = await service.ingestSpec({
        specContent: args.specContent,
        dryRun: args.dryRun ?? false,
        profile: container.profile,
      });
      return toCallToolResult(result);
    }),
  );
}
