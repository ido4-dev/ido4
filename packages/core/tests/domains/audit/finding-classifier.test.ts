import { describe, it, expect } from 'vitest';
import { classifyObservation, classifySpecOrphanRate, bypassObservationsFromRecord } from '../../../src/domains/audit/finding-classifier.js';

const cats = (o: any) => classifyObservation(o).map((c) => c.category).sort();

describe('finding-classifier — closures', () => {
  it('clean reviewed closure → no finding (the silence that prose never achieved)', () => {
    expect(cats({ kind: 'closure', terminal: true, pr_found: true, approving_reviews: 1, pr_body_len: 400, pr_ref_count: 3, comment_count: 2, lineage_ref: 'ND-01' })).toEqual([]);
  });
  it('a PR present can NEVER classify as ghost_closure (the exact 5x mislabel)', () => {
    expect(cats({ kind: 'closure', terminal: true, pr_found: true, approving_reviews: 1, pr_body_len: 400, pr_ref_count: 3, comment_count: 2 })).not.toContain('ghost_closure');
  });
  it('closed, no PR → ghost_closure', () => {
    expect(cats({ kind: 'closure', terminal: true, pr_found: false, comment_count: 2 })).toEqual(['ghost_closure']);
  });
  it('closed, PR, no approving review → rubber_stamp', () => {
    expect(cats({ kind: 'closure', terminal: true, pr_found: true, approving_reviews: 0, pr_body_len: 400, pr_ref_count: 3, comment_count: 2 })).toEqual(['rubber_stamp']);
  });
  it('thin PR co-occurs with rubber_stamp', () => {
    expect(cats({ kind: 'closure', terminal: true, pr_found: true, approving_reviews: 0, pr_body_len: 40, pr_ref_count: 0, comment_count: 1 })).toEqual(['rubber_stamp', 'shallow_pr']);
  });
  it('no comments → silent_closure', () => {
    expect(cats({ kind: 'closure', terminal: true, pr_found: true, approving_reviews: 1, pr_body_len: 400, pr_ref_count: 3, comment_count: 0 })).toEqual(['silent_closure']);
  });
  it('non-terminal → no closure-quality finding', () => {
    expect(cats({ kind: 'closure', terminal: false, pr_found: false })).toEqual([]);
  });
  it('aiSuitability flipped to human-only after AI work → suitability_drift', () => {
    expect(cats({ kind: 'closure', terminal: false, ai_did_work_then_marked_human_only: true })).toEqual(['suitability_drift']);
  });
  it('severity derived: ghost=error, shallow=warning', () => {
    expect(classifyObservation({ kind: 'closure', terminal: true, pr_found: false, comment_count: 1 } as any)).toEqual([{ category: 'ghost_closure', severity: 'error' }]);
  });
});

describe('finding-classifier — bypass / epic / spec_orphan', () => {
  it('bypass >=3 → bypass_pattern; <3 → silence', () => {
    expect(cats({ kind: 'bypass', attempts: 3 })).toEqual(['bypass_pattern']);
    expect(cats({ kind: 'bypass', attempts: 2 })).toEqual([]);
  });
  it('epic >1 actor → actor_fragmentation', () => {
    expect(cats({ kind: 'epic', distinct_ai_actors: 2 })).toEqual(['actor_fragmentation']);
    expect(cats({ kind: 'epic', distinct_ai_actors: 1 })).toEqual([]);
  });
  it('spec_orphan is rate-based, not per-closure', () => {
    const allOrphan = [0, 1, 2, 3].map(() => ({ kind: 'closure' as const, terminal: true, lineage_ref: null }));
    expect(classifySpecOrphanRate(allOrphan)?.category).toBe('spec_orphan');
    const oneOrphan = [{ kind: 'closure' as const, terminal: true, lineage_ref: null }, ...[1, 2, 3].map((i) => ({ kind: 'closure' as const, terminal: true, lineage_ref: `T-${i}` }))];
    expect(classifySpecOrphanRate(oneOrphan)).toBeNull();
  });
  it('unknown kind / null → no finding', () => {
    expect(cats({ kind: 'weird' })).toEqual([]);
    expect(cats(null)).toEqual([]);
  });
});

describe('bypassObservationsFromRecord — authoritative bypass derivation (synthetic-005)', () => {
  it('groups the gate record by actor and counts attempts', () => {
    const record = [
      { actor_id: 'agent-alpha', tool: 'plan_task' },
      { actor_id: 'agent-alpha', tool: 'start_task' },
      { actor_id: 'agent-alpha', tool: 'start_task' },
      { actor_id: 'agent-beta', tool: 'review_task' },
      { actor_id: 'agent-beta', tool: 'review_task' },
    ];
    const obs = bypassObservationsFromRecord(record);
    expect(obs).toHaveLength(2);
    const alpha = obs.find((o) => o.actor_id === 'agent-alpha')!;
    expect(alpha.attempts).toBe(3); // 1 plan + 2 start — the count the agent undercounted as 2
    expect(classifyObservation(alpha).map((c) => c.category)).toEqual(['bypass_pattern']);
    const beta = obs.find((o) => o.actor_id === 'agent-beta')!;
    expect(beta.attempts).toBe(2);
    expect(classifyObservation(beta)).toEqual([]); // below threshold — silence
  });
  it('sorts heaviest bypasser first', () => {
    const obs = bypassObservationsFromRecord([
      { actor_id: 'a' }, { actor_id: 'b' }, { actor_id: 'b' }, { actor_id: 'b' },
    ]);
    expect(obs[0].actor_id).toBe('b');
    expect(obs[0].attempts).toBe(3);
  });
  it('missing actor_id falls back to "unknown"; empty/undefined record → no observations', () => {
    expect(bypassObservationsFromRecord([{ tool: 'plan_task' }])[0].actor_id).toBe('unknown');
    expect(bypassObservationsFromRecord([])).toEqual([]);
    expect(bypassObservationsFromRecord(undefined)).toEqual([]);
  });
});
