/**
 * Ingestion tool registration — ingest_spec MCP tool.
 *
 * Creates IngestionService on-demand from the shared container (like SandboxService pattern
 * but uses getContainer() since the project must already be initialized).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IngestSpecSchema, ParseStrategicSpecSchema } from '../schemas/ingestion-schemas.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';
import { IngestionService, parseStrategicSpec } from '@ido4/core';

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

  server.tool(
    'parse_strategic_spec',
    'Parse a strategic spec (from ido4shape) into a structured AST. Returns project context, cross-cutting concerns, groups (organizational context from ido4shape — priority and description for decomposition ordering, NOT GitHub issues), and capabilities within groups (functional requirements that become epic/bet GitHub issues). Use before decomposition to get structured input for the code analysis agent.',
    ParseStrategicSpecSchema,
    async (args) => handleErrors(async () => {
      const result = parseStrategicSpec(args.specContent);
      const errors = result.errors.filter(e => e.severity === 'error');
      const warnings = result.errors.filter(e => e.severity === 'warning');
      return toCallToolResult({
        success: errors.length === 0,
        data: {
          project: result.project,
          crossCuttingConcerns: result.crossCuttingConcerns,
          groupCount: result.groups.length,
          capabilityCount: result.groups.reduce((sum, g) => sum + g.capabilities.length, 0) + result.orphanCapabilities.length,
          groups: result.groups.map(g => ({
            name: g.name,
            prefix: g.prefix,
            priority: g.priority,
            description: g.description,
            capabilityCount: g.capabilities.length,
            capabilities: g.capabilities.map(c => ({
              ref: c.ref,
              title: c.title,
              priority: c.priority,
              risk: c.risk,
              dependsOn: c.dependsOn,
              body: c.body,
              successConditions: c.successConditions,
            })),
          })),
          orphanCapabilities: result.orphanCapabilities.map(c => c.ref),
          dependencyGraph: buildDependencySummary(result),
        },
        errors: errors.map(e => e.message),
        warnings: warnings.map(e => e.message),
      });
    }),
  );
}

function buildDependencySummary(spec: ReturnType<typeof parseStrategicSpec>): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const allCaps = [...spec.groups.flatMap(g => g.capabilities), ...spec.orphanCapabilities];
  for (const cap of allCaps) {
    if (cap.dependsOn.length > 0) {
      graph[cap.ref] = cap.dependsOn;
    }
  }
  return graph;
}
