/**
 * Zod schemas for project initialization MCP tool inputs.
 */

import { z } from 'zod';

export const InitProjectSchema = {
  mode: z.enum(['create', 'connect']).describe('create = new GitHub Project, connect = use existing project'),
  repository: z.string().optional().describe('GitHub repository (owner/repo). Auto-detected from git remote if omitted'),
  projectName: z.string().optional().describe('Name for the new project (create mode only)'),
  projectId: z.string().optional().describe('Existing project ID starting with PVT_ (connect mode only)'),
  methodology: z.enum(['hydro', 'scrum', 'shape-up']).optional().describe('Methodology profile to use (default: hydro). Available: hydro (wave-based), scrum (sprint-based), shape-up (cycle-based)'),
};
