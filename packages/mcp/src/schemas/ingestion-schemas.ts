/**
 * Zod schemas for ingestion MCP tool inputs.
 */

import { z } from 'zod';

export const IngestSpecSchema = {
  specContent: z.string().describe(
    'The full markdown content of the technical spec artifact. Format: # Project → ## Capability: Name → ### PREFIX-NN: Task Title. See the @ido4/tech-spec-format package documentation for the complete format reference.',
  ),
  dryRun: z.boolean().optional().default(false).describe(
    'Preview mode — parse and validate without creating GitHub issues. Shows what would be created, including topological order and value mappings.',
  ),
};

export const ParseStrategicSpecSchema = {
  specContent: z.string().describe(
    'The full markdown content of a strategic spec (produced by ido4shape). Format: # Project with format: strategic-spec marker → ## Cross-Cutting Concerns → ## Group: Name → ### PREFIX-NN: Capability Name. Returns structured AST with project context, cross-cutting concerns, groups, capabilities, dependencies, and validation errors.',
  ),
};
