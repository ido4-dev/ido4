/**
 * Zod schemas for dependency-related MCP tool inputs.
 */

import { z } from 'zod';

export const DependencySchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
};
