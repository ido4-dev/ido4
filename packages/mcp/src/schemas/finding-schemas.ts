import { z } from 'zod';

// persist_audit_findings — the agent supplies OBSERVATIONS (facts + a note);
// the tool classifies + persists. The agent never sends a category/severity —
// those are derived deterministically server-side, so a mislabel is impossible.
const observation = z.object({
  kind: z.enum(['closure', 'bypass', 'epic']).describe('Observation type'),
  // closure facts. Numeric facts are .nullable() because an agent naturally
  // passes null for an absent value (e.g. pr_number when there is no PR); the
  // classifier treats null as "absent" (numOr → default), so accept it directly
  // rather than forcing a retry on a schema rejection.
  issue: z.number().int().nullable().optional().describe('Issue number (closure)'),
  actor_id: z.string().optional().describe('Acting AI agent id (e.g. agent-alpha)'),
  terminal: z.boolean().optional().describe('closure: did the task reach a terminal state?'),
  pr_found: z.boolean().optional().describe('closure: did find_task_pr return a PR?'),
  pr_number: z.number().int().nullable().optional(),
  approving_reviews: z.number().int().nullable().optional().describe('closure: count of APPROVED PR reviews'),
  pr_body_len: z.number().int().nullable().optional().describe('closure: PR body length (for shallow_pr)'),
  pr_ref_count: z.number().int().nullable().optional().describe('closure: acceptance-criteria/spec/issue refs in PR body'),
  comment_count: z.number().int().nullable().optional().describe('closure: get_task_comments count'),
  lineage_ref: z.string().nullable().optional().describe('closure: get_task_lineage ref, or null'),
  ai_suitability: z.string().nullable().optional(),
  ai_did_work_then_marked_human_only: z.boolean().optional().describe('closure: aiSuitability flipped to human-only after AI did work'),
  // bypass facts — OPTIONAL and advisory only. The bypass_pattern finding is
  // derived AUTHORITATIVELY from the deterministic gate record (state.bypass_attempts),
  // not from these counts, so you cannot under- or over-count a bypass. You do not
  // need to submit kind:'bypass' observations; the tool reconciles them from the record.
  attempts: z.number().int().nullable().optional().describe('bypass: skipValidation attempts by this actor (advisory; the record is authoritative)'),
  executed: z.number().int().nullable().optional().describe('bypass: how many executed (advisory)'),
  // epic facts
  epic: z.string().optional(),
  distinct_ai_actors: z.number().int().nullable().optional().describe('epic: distinct AI actors that touched the epic'),
  // narrative + scope
  note: z.string().optional().describe('Human-readable narrative for this observation (becomes the finding title/summary)'),
  scope: z.string().optional().describe('Scope for finding-id composition (e.g. sprint name); defaults to issue/scope'),
});

export const PersistAuditFindingsSchema = {
  observations: z.array(observation).describe(
    'Audited units (facts + a note each). The tool classifies them deterministically and persists qualifying findings — you do NOT choose categories or severities. Clean observations yield no finding (silence is correct).',
  ),
};
