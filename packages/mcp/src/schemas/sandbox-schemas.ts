/**
 * Zod schemas for sandbox MCP tool inputs.
 */

import { z } from 'zod';

export const CreateSandboxSchema = {
  repository: z.string().describe('GitHub repository in owner/repo format (e.g., "myorg/sandbox-project")'),
  scenarioId: z.string().optional().describe('Scenario to use (defaults to "governance-showcase")'),
};

export const ResetSandboxSchema = {
  scenarioId: z.string().optional().describe('Scenario to use for the new sandbox (defaults to "governance-showcase")'),
};

export const DestroySandboxSchema = {};
