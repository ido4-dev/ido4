/**
 * Zod schemas for wave-related MCP tool inputs.
 */

import { z } from 'zod';

export const WaveNameSchema = {
  waveName: z.string().describe('Name of the wave'),
};

export const CreateWaveSchema = {
  name: z.string().describe('Wave name (e.g., "Wave 1")'),
  description: z.string().optional().describe('Wave description'),
};

export const AssignTaskToWaveSchema = {
  issueNumber: z.number().int().positive().describe('GitHub issue number'),
  waveName: z.string().describe('Wave to assign the task to'),
};
