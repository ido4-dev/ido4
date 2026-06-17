/**
 * Audit-finding classifier — the deterministic half of the PM audit.
 *
 * §3.1: the LLM gathers facts; THIS code classifies. The agent never authors a
 * category, so a category-vs-evidence mislabel is structurally impossible. These
 * are the "When to Persist" thresholds as code, not prose the LLM applies.
 *
 * Pure functions, no I/O, no LLM — domain logic (what *is* a ghost closure?),
 * which is why it lives in @ido4/core. Exposed to agents via the
 * `persist_audit_findings` MCP tool so the agent has no write path at all.
 */

export type FindingCategory =
  | 'ghost_closure' | 'rubber_stamp' | 'shallow_pr' | 'silent_closure'
  | 'spec_orphan' | 'bypass_pattern' | 'suitability_drift' | 'actor_fragmentation';

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface ClosureObservation {
  kind: 'closure';
  issue?: number;
  actor_id?: string;
  terminal?: boolean;
  pr_found?: boolean;
  pr_number?: number;
  approving_reviews?: number;
  pr_body_len?: number;
  pr_ref_count?: number;
  comment_count?: number;
  lineage_ref?: string | null;
  ai_suitability?: string;
  ai_did_work_then_marked_human_only?: boolean;
  note?: string;
  scope?: string;
  epic?: string;
}
export interface BypassObservation { kind: 'bypass'; actor_id?: string; attempts?: number; executed?: number; note?: string; scope?: string; }
export interface EpicObservation { kind: 'epic'; epic?: string; distinct_ai_actors?: number; note?: string; actor_id?: string; scope?: string; }
export type Observation = ClosureObservation | BypassObservation | EpicObservation;

export interface Classification { category: FindingCategory; severity: FindingSeverity; }

const numOr = (v: unknown, d: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : d);

/** Classify ONE observation → applicable findings (empty = clean; silence is the default). */
export function classifyObservation(obs: Observation): Classification[] {
  if (!obs || typeof obs !== 'object') return [];
  switch (obs.kind) {
    case 'closure': return classifyClosure(obs);
    case 'bypass': return numOr(obs.attempts, 0) >= 3 ? [{ category: 'bypass_pattern', severity: 'error' }] : [];
    case 'epic': return numOr(obs.distinct_ai_actors, 0) > 1 ? [{ category: 'actor_fragmentation', severity: 'info' }] : [];
    default: return [];
  }
}

function classifyClosure(o: ClosureObservation): Classification[] {
  const out: Classification[] = [];
  if (o.ai_did_work_then_marked_human_only === true) out.push({ category: 'suitability_drift', severity: 'error' });
  if (o.terminal !== true) return out;

  if (o.pr_found !== true) {
    out.push({ category: 'ghost_closure', severity: 'error' });
  } else {
    if (numOr(o.approving_reviews, 0) === 0) out.push({ category: 'rubber_stamp', severity: 'error' });
    if (numOr(o.pr_body_len, 0) < 200 || numOr(o.pr_ref_count, 0) === 0) out.push({ category: 'shallow_pr', severity: 'warning' });
  }
  if (numOr(o.comment_count, 0) === 0) out.push({ category: 'silent_closure', severity: 'warning' });
  return out;
}

/**
 * Authoritative per-actor bypass observations derived from the deterministic
 * gate record (state.bypass_attempts written by the PreToolUse G1 rule), NOT
 * from agent-submitted counts. The audit classifies THESE, so an agent that
 * under-gathers cannot suppress a bypass_pattern finding.
 *
 * synthetic-005 OBS-01/OBS-02: the agent reported attempts:2 for agent-alpha
 * while the gate record held 3 (a plan_task bypass it didn't reconcile),
 * silently dropping a threshold-crossing finding. Deriving from the record
 * removes the agent's count from the trust path entirely.
 */
export interface GateBypassEntry { actor_id?: string; [k: string]: unknown }
export function bypassObservationsFromRecord(record: GateBypassEntry[] | undefined): BypassObservation[] {
  const counts = new Map<string, number>();
  for (const e of Array.isArray(record) ? record : []) {
    const actor = e && typeof e.actor_id === 'string' && e.actor_id ? e.actor_id : 'unknown';
    counts.set(actor, (counts.get(actor) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([actor_id, attempts]) => ({
      kind: 'bypass' as const,
      actor_id,
      attempts,
      note: `${attempts} BRE-bypass attempt${attempts === 1 ? '' : 's'} recorded for ${actor_id} (derived from the gate record)`,
    }));
}

/** spec_orphan is rate-based (a single off-spec closure is normal). One finding or null. */
export function classifySpecOrphanRate(
  observations: Observation[],
  opts: { minClosures?: number; threshold?: number } = {},
): { category: 'spec_orphan'; severity: 'info'; rate: number } | null {
  const minClosures = opts.minClosures ?? 3;
  const threshold = opts.threshold ?? 0.30;
  const terminal = observations.filter((c): c is ClosureObservation => c.kind === 'closure' && c.terminal === true);
  if (terminal.length < minClosures) return null;
  const orphans = terminal.filter((c) => c.lineage_ref === null || c.lineage_ref === undefined).length;
  const rate = orphans / terminal.length;
  return rate > threshold ? { category: 'spec_orphan', severity: 'info', rate } : null;
}

export const VALID_FINDING_CATEGORIES: FindingCategory[] = [
  'ghost_closure', 'rubber_stamp', 'shallow_pr', 'silent_closure',
  'spec_orphan', 'bypass_pattern', 'suitability_drift', 'actor_fragmentation',
];
