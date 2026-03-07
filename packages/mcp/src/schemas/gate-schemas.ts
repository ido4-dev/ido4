import { z } from 'zod';

export const CheckMergeReadinessSchema = {
  issueNumber: z.number().describe('The task number to check merge readiness for.'),
  overrideReason: z.string().optional().describe('If provided, overrides failed gates (logged as governance_override audit event). Use for emergency hotfixes or explicit tech debt decisions.'),
  minReviews: z.number().optional().describe('Minimum number of approving PR reviews required. Defaults to 1.'),
  minComplianceScore: z.number().optional().describe('Minimum project compliance score (0-100). Defaults to 70.'),
};
