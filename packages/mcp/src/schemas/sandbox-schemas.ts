/**
 * Zod schemas for sandbox MCP tool inputs.
 */

import { z } from 'zod';

export const CreateSandboxSchema = {
  repository: z.string().describe('GitHub repository in owner/repo format (e.g., "myorg/sandbox-project")'),
  scenarioId: z.string().optional().describe('Scenario to use. Available: "hydro-governance" (Hydro), "scrum-sprint" (Scrum), "shape-up-cycle" (Shape Up). Defaults to "hydro-governance".'),
  projectRoot: z.string().optional().describe('Absolute path where .ido4/ config and governance data will be created. Defaults to current working directory. Use this to point sandbox at a specific codebase directory (e.g., a cloned demo repo).'),
};

export const ResetSandboxSchema = {
  scenarioId: z.string().optional().describe('Scenario to use for the new sandbox. Available: "hydro-governance" (Hydro), "scrum-sprint" (Scrum), "shape-up-cycle" (Shape Up). Defaults to "hydro-governance".'),
  projectRoot: z.string().optional().describe('Absolute path where the sandbox lives. Defaults to current working directory.'),
};

export const DestroySandboxSchema = {
  projectRoot: z.string().optional().describe('Absolute path where the sandbox lives. Defaults to current working directory.'),
};
