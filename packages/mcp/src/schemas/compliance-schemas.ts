import { z } from 'zod';

export const ComputeComplianceScoreSchema = {
  since: z.string().optional().describe('ISO-8601 start of compliance period (default: all time)'),
  until: z.string().optional().describe('ISO-8601 end of compliance period (default: now)'),
  waveName: z.string().optional().describe('Scope compliance score to a specific wave'),
  actorId: z.string().optional().describe('Scope compliance score to a specific actor/agent'),
};
