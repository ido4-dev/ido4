/**
 * Zod schemas for sandbox MCP tool inputs.
 */

import { z } from 'zod';

export const CreateSandboxSchema = {
  repository: z.string().describe('GitHub repository in owner/repo format (e.g., "myorg/sandbox-project")'),
  scenarioId: z.string().optional().describe('Scenario to use. Available: "hydro-governance" (Hydro), "scrum-sprint" (Scrum), "shape-up-cycle" (Shape Up). Defaults to "hydro-governance".'),
};

export const ResetSandboxSchema = {
  scenarioId: z.string().optional().describe('Scenario to use for the new sandbox. Available: "hydro-governance" (Hydro), "scrum-sprint" (Scrum), "shape-up-cycle" (Shape Up). Defaults to "hydro-governance".'),
};

export const DestroySandboxSchema = {};
