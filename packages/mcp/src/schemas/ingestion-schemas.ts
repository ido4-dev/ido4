/**
 * Zod schemas for ingestion MCP tool inputs.
 */

import { z } from 'zod';

export const IngestSpecSchema = {
  specContent: z.string().describe(
    'The full markdown content of the spec artifact. Format: # Project → ## Group: Name → ### PREFIX-NN: Task Title. See spec-artifact-format.md for the complete format reference.',
  ),
  dryRun: z.boolean().optional().default(false).describe(
    'Preview mode — parse and validate without creating GitHub issues. Shows what would be created, including topological order and value mappings.',
  ),
};
