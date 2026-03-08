/**
 * Zod schemas for container-related MCP tool inputs.
 */

import { z } from 'zod';

export const ContainerNameSchema = {
  waveName: z.string().describe('Name of the wave'),
};

export const CreateContainerSchema = {
  name: z.string().describe('Wave name (e.g., "Wave 1")'),
  description: z.string().optional().describe('Wave description'),
};

export const AssignTaskToContainerSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
  waveName: z.string().describe('Wave to assign the task to'),
};
