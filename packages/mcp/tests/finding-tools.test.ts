/**
 * persist_audit_findings — the airtight, derive-only audit write path.
 *
 * Regression cover for synthetic-005:
 *  - A2 (false positive): a clean reviewed closure must produce NO finding.
 *  - OBS-01/02 (false negative): the bypass_pattern finding is derived from the
 *    deterministic gate record (state.bypass_attempts), so an agent that
 *    under-counts (submits attempts:2 while the record holds 3) cannot suppress it.
 *  - Coverage instrument: the result carries a coverage summary so "0 findings"
 *    is self-evidently scoped, not ambiguous.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HYDRO_PROFILE } from '@ido4/core';
import { createServer } from '../src/server.js';
import { callTool } from './helpers/test-utils.js';

const slug = process.cwd().replace(/[^a-zA-Z0-9._-]/g, '-');
let dataDir: string;
let stateFile: string;
const prevEnv = process.env.CLAUDE_PLUGIN_DATA;

function seedState(state: Record<string, unknown>): void {
  mkdirSync(join(dataDir, 'hooks', 'state'), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
function readState(): Record<string, unknown> {
  return JSON.parse(readFileSync(stateFile, 'utf8'));
}
async function persist(observations: unknown[]): Promise<{ data: Record<string, unknown> }> {
  const res = (await callTool(createServer(HYDRO_PROFILE), 'persist_audit_findings', { observations })) as {
    content: Array<{ text: string }>;
  };
  return JSON.parse(res.content[0].text);
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'ido4-findings-'));
  stateFile = join(dataDir, 'hooks', 'state', `${slug}.json`);
  process.env.CLAUDE_PLUGIN_DATA = dataDir;
});
afterEach(() => {
  if (prevEnv === undefined) delete process.env.CLAUDE_PLUGIN_DATA;
  else process.env.CLAUDE_PLUGIN_DATA = prevEnv;
  rmSync(dataDir, { recursive: true, force: true });
});

describe('persist_audit_findings — airtight derive', () => {
  it('A2: a clean reviewed closure produces NO finding (silence), with a coverage summary', async () => {
    seedState({ bypass_attempts: [] });
    const out = await persist([
      { kind: 'closure', issue: 5, actor_id: 'agent-alpha', terminal: true, pr_found: true, approving_reviews: 1, pr_body_len: 400, pr_ref_count: 3, comment_count: 2, lineage_ref: 'ND-01' },
    ]);
    expect(out.data.persisted).toBe(0);
    expect(out.data.categories).toEqual([]);
    expect(out.data.coverage).toMatchObject({ closures_examined: 1, bypass_attempts_recorded: 0, findings: 0 });
    expect(String(out.data.message)).toContain('clean');
    expect(readState().open_findings).toEqual([]);
  });

  it('OBS-01/02: bypass_pattern is derived from the gate record even when the agent under-counts', async () => {
    // The record holds 3 alpha attempts (1 plan + 2 start) — the count the
    // synthetic agent undercounted as 2 — plus 2 for beta.
    seedState({
      bypass_attempts: [
        { actor_id: 'agent-alpha', tool: 'plan_task' },
        { actor_id: 'agent-alpha', tool: 'start_task' },
        { actor_id: 'agent-alpha', tool: 'start_task' },
        { actor_id: 'agent-beta', tool: 'review_task' },
        { actor_id: 'agent-beta', tool: 'review_task' },
      ],
    });
    const out = await persist([
      // Agent submits a clean closure AND an undercounted bypass observation.
      { kind: 'closure', issue: 5, actor_id: 'agent-alpha', terminal: true, pr_found: true, approving_reviews: 1, pr_body_len: 400, pr_ref_count: 3, comment_count: 2, lineage_ref: 'ND-01' },
      { kind: 'bypass', actor_id: 'agent-alpha', attempts: 2 },
    ]);
    // alpha crosses threshold from the RECORD (3), beta does not (2). No false closure finding.
    expect(out.data.categories).toEqual(['bypass_pattern']);
    const findings = readState().open_findings as Array<Record<string, unknown>>;
    expect(findings).toHaveLength(1);
    expect(findings[0].category).toBe('bypass_pattern');
    expect(findings[0].actor_id).toBe('agent-alpha');
    expect((findings[0].evidence as Record<string, Record<string, unknown>>).facts.attempts).toBe(3);
    expect(out.data.coverage).toMatchObject({ bypass_attempts_recorded: 5, bypass_actors_recorded: 2 });
  });

  it('accepts null for absent numeric facts (no-PR closure passes pr_number:null without a schema retry) — synthetic-006 OBS-05', async () => {
    seedState({ bypass_attempts: [] });
    const out = await persist([
      { kind: 'closure', issue: 6, actor_id: 'agent-beta', terminal: true, pr_found: false, pr_number: null, approving_reviews: null, comment_count: null, lineage_ref: null },
    ]);
    // null = absent → ghost_closure (no PR) + silent_closure (no comments), no crash.
    expect(out.data.categories).toContain('ghost_closure');
    expect(out.data.coverage.closures_examined).toBe(1);
  });

  it('preserves runner-written state fields (read-then-mutate, never overwrite)', async () => {
    seedState({ bypass_attempts: [], last_compliance: { grade: 'B', score: 82 }, compliance_history: ['A', 'A', 'B'] });
    await persist([{ kind: 'closure', issue: 9, actor_id: 'agent-x', terminal: true, pr_found: false, comment_count: 2 }]);
    const s = readState();
    expect(s.last_compliance).toEqual({ grade: 'B', score: 82 });
    expect(s.compliance_history).toEqual(['A', 'A', 'B']);
    expect((s.open_findings as unknown[]).length).toBe(1); // ghost_closure on the no-PR terminal close
  });

  it('get_governance_memory surfaces the bypass record (grouped by actor) + open findings — the layer the audit trail lacks', async () => {
    seedState({
      bypass_attempts: [
        { actor_id: 'agent-alpha', tool: 'plan_task' },
        { actor_id: 'agent-beta', tool: 'review_task' },
        { actor_id: 'agent-beta', tool: 'review_task' },
      ],
      open_findings: [
        { id: 'audit:rubber_stamp:agent-x:issue-9', category: 'rubber_stamp', resolved: false },
        { id: 'audit:ghost_closure:agent-y:issue-8', category: 'ghost_closure', resolved: true },
      ],
      last_compliance: { grade: 'B', score: 82 },
      compliance_history: ['A', 'A', 'B'],
    });
    const res = (await callTool(createServer(HYDRO_PROFILE), 'get_governance_memory', {})) as { content: Array<{ text: string }> };
    const out = JSON.parse(res.content[0].text);
    expect(out.data.bypass_attempts.total).toBe(3);
    expect(out.data.bypass_attempts.by_actor).toEqual([
      { actor_id: 'agent-beta', attempts: 2 },
      { actor_id: 'agent-alpha', attempts: 1 },
    ]);
    expect(out.data.open_findings).toHaveLength(1); // resolved one excluded
    expect(out.data.open_findings[0].category).toBe('rubber_stamp');
    expect(out.data.last_compliance).toEqual({ grade: 'B', score: 82 });
    expect(out.data.note).toContain('never "zero"');
  });

  it('get_governance_memory on a clean project reports a TRUE zero', async () => {
    seedState({ bypass_attempts: [] });
    const res = (await callTool(createServer(HYDRO_PROFILE), 'get_governance_memory', {})) as { content: Array<{ text: string }> };
    const out = JSON.parse(res.content[0].text);
    expect(out.data.bypass_attempts.total).toBe(0);
    expect(out.data.note).toContain('provably');
  });

  it('does not resurrect a resolved finding unless the recorded attempts grew', async () => {
    const record3 = [1, 2, 3].map(() => ({ actor_id: 'agent-alpha', tool: 'start_task' }));
    seedState({
      bypass_attempts: record3,
      open_findings: [{
        id: 'audit:bypass_pattern:agent-alpha:session', category: 'bypass_pattern', severity: 'error',
        actor_id: 'agent-alpha', resolved: true, resolved_at: '2026-06-16T00:00:00Z',
        evidence: { facts: { attempts: 3 } },
      }],
    });
    // Re-audit with the SAME recorded count → stays resolved (no stale re-open).
    let out = await persist([]);
    expect((readState().open_findings as Array<Record<string, unknown>>)[0].resolved).toBe(true);
    expect(out.data.updated).toBe(1);

    // A new attempt lands in the record → the finding re-opens.
    seedState({
      bypass_attempts: [...record3, { actor_id: 'agent-alpha', tool: 'plan_task' }],
      open_findings: readState().open_findings,
    });
    out = await persist([]);
    expect((readState().open_findings as Array<Record<string, unknown>>)[0].resolved).toBe(false);
  });
});
