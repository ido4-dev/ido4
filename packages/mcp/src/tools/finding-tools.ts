/**
 * persist_audit_findings — the deterministic, agent-unforgeable write path for
 * PM audit findings (airtight A2).
 *
 * The agent supplies OBSERVATIONS (facts + a note); this tool classifies them
 * with the @ido4/core classifier and writes the qualifying findings to the
 * project-scoped governance state. The agent has no Write/Edit/Bash — calling
 * this tool is the ONLY way it can persist a finding, and the category/severity
 * are computed here, so a confident mislabel (the 5-iteration failure) is
 * structurally impossible.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { classifyObservation, classifySpecOrphanRate, bypassObservationsFromRecord } from '@ido4/core';
import { PersistAuditFindingsSchema } from '../schemas/finding-schemas.js';
import { handleErrors, toCallToolResult } from '../helpers/index.js';

const FINDINGS_CAP = 20;

const numOr = (v: unknown, d: number): number => (typeof v === 'number' && !Number.isNaN(v) ? v : d);

// The governance state lives in the ido4dev plugin's data dir, keyed by project
// cwd (Claude Code-style slug). Resolve CLAUDE_PLUGIN_DATA from env, else derive
// it from this module's location (the server runs from
// ${CLAUDE_PLUGIN_DATA}/node_modules/@ido4/mcp/dist).
function resolveStateFile(): string {
  let dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) {
    // CJS build: __dirname = …/node_modules/@ido4/mcp/dist/tools → up 5 = ${CLAUDE_PLUGIN_DATA}
    dataDir = resolve(__dirname, '..', '..', '..', '..', '..');
  }
  const slug = process.cwd().replace(/[^a-zA-Z0-9._-]/g, '-');
  return join(dataDir, 'hooks', 'state', `${slug}.json`);
}

export function registerFindingTools(server: McpServer): void {
  server.tool(
    'persist_audit_findings',
    'Persist PM audit findings from gathered observations. You supply facts + a note per audited unit (closures, epics); this tool DERIVES category + severity deterministically and writes qualifying findings to governance state. BRE-bypass findings are reconciled AUTHORITATIVELY from the gate record (you cannot under-count them). The result includes a coverage summary (closures/bypass-attempts/epics/actors examined) so a clean "0 findings" is self-evidently scoped, not ambiguous. You never choose categories — clean observations produce no finding. This is the only way to persist findings.',
    PersistAuditFindingsSchema,
    async (args) => handleErrors(async () => {
      const nowIso = new Date().toISOString();
      const observations = args.observations ?? [];

      // Read project state FIRST — it carries the deterministic gate record
      // (bypass_attempts) that the bypass finding is derived from, so the audit
      // never depends on the agent counting bypasses correctly.
      const stateFile = resolveStateFile();
      let state: Record<string, unknown> = {};
      if (existsSync(stateFile)) {
        try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { state = {}; }
      }
      const bypassRecord = Array.isArray(state.bypass_attempts) ? state.bypass_attempts : [];

      // Classify → build deterministic findings.
      type Finding = Record<string, unknown> & { id: string; category: string; severity: string };
      const built: Finding[] = [];
      const make = (category: string, severity: string, obs: Record<string, unknown>) => {
        const actorId = (obs.actor_id as string) || 'unknown';
        const scope = (obs.scope as string) || (obs.epic as string) || (obs.issue != null ? `issue-${obs.issue}` : 'session');
        const note = obs.note as string | undefined;
        built.push({
          id: `audit:${category}:${actorId}:${scope}`,
          source: 'pm-agent',
          category, severity,
          title: note ? note.slice(0, 120) : `${category} — ${actorId}`,
          summary: note || `${category} on ${scope} by ${actorId}`,
          actor_type: (obs.actor_type as string) || 'ai-agent',
          actor_id: actorId,
          first_seen: nowIso, last_seen: nowIso,
          resolved: false, resolved_at: null,
          evidence: { facts: obs },
        });
      };
      // Agent-gathered observations (closures, epics) — these carry facts the
      // engine state doesn't hold (PR review counts, comment counts, lineage).
      for (const obs of observations) {
        if ((obs as Record<string, unknown>).kind === 'bypass') continue; // derived from the record below — not the agent's count
        for (const c of classifyObservation(obs as never)) make(c.category, c.severity, obs as Record<string, unknown>);
      }
      // Bypass findings are derived AUTHORITATIVELY from the gate record, not the
      // agent's submitted count (synthetic-005: agent undercounted 2 vs 3).
      const recordBypass = bypassObservationsFromRecord(bypassRecord as never);
      for (const obs of recordBypass) {
        for (const c of classifyObservation(obs as never)) make(c.category, c.severity, obs as unknown as Record<string, unknown>);
      }
      const orphan = classifySpecOrphanRate(observations as never);
      if (orphan) make(orphan.category, orphan.severity, { actor_id: 'ai-agents', scope: 'sprint', note: `Spec-orphan rate ${(orphan.rate * 100).toFixed(0)}% across AI closures` });

      // Coverage summary — makes "0 findings" self-evidently SCOPED rather than
      // ambiguous (a clean audit and an audit that never looked must be
      // distinguishable; synthetic-005 value-judge crux). Bypass numbers come
      // from the authoritative record, not from what the agent chose to submit.
      const closuresExamined = observations.filter((o) => (o as Record<string, unknown>).kind === 'closure').length;
      const epicsExamined = observations.filter((o) => (o as Record<string, unknown>).kind === 'epic').length;
      const actors = new Set<string>();
      for (const o of observations) { const a = (o as Record<string, unknown>).actor_id; if (typeof a === 'string' && a) actors.add(a); }
      for (const e of bypassRecord as Array<Record<string, unknown>>) { const a = e?.actor_id; if (typeof a === 'string' && a) actors.add(a); }
      const bySeverity = { error: 0, warning: 0, info: 0 } as Record<string, number>;
      for (const f of built) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      const coverage = {
        closures_examined: closuresExamined,
        epics_examined: epicsExamined,
        bypass_attempts_recorded: (bypassRecord as unknown[]).length,
        bypass_actors_recorded: recordBypass.length,
        distinct_actors_examined: actors.size,
        findings: built.length,
        findings_by_severity: bySeverity,
      };

      // Read-then-mutate the project state, preserving every runner-written field.
      const existing = Array.isArray(state.open_findings) ? (state.open_findings as Finding[]) : [];
      const byId = new Map(existing.map((f) => [f.id, f]));
      let persisted = 0, updated = 0;
      for (const f of built) {
        const prev = byId.get(f.id);
        if (prev) {
          // Refresh evidence + timestamp. Do NOT silently resurrect a finding the
          // PM already resolved unless the evidence actually grew (e.g. more bypass
          // attempts since resolution) — record-derived findings would otherwise
          // re-open every audit and become stale noise.
          const prevAttempts = numOr((prev.evidence as Record<string, Record<string, unknown>> | undefined)?.facts?.attempts, 0);
          const newAttempts = numOr((f.evidence as Record<string, Record<string, unknown>> | undefined)?.facts?.attempts, 0);
          prev.last_seen = f.last_seen as string;
          prev.evidence = f.evidence;
          if (prev.resolved !== true || newAttempts > prevAttempts) { prev.resolved = false; prev.resolved_at = null; }
          updated++;
        } else { byId.set(f.id, f); persisted++; }
      }
      let merged = [...byId.values()];
      if (merged.length > FINDINGS_CAP) merged = merged.slice(merged.length - FINDINGS_CAP);
      state.open_findings = merged;
      state.updated_at = nowIso;

      // Atomic write.
      mkdirSync(dirname(stateFile), { recursive: true });
      const tmp = `${stateFile}.tmp`;
      try { writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n'); renameSync(tmp, stateFile); }
      catch (e) { try { unlinkSync(tmp); } catch { /* ignore */ } throw e; }

      const coverageLine = `Examined ${coverage.closures_examined} closure(s), ${coverage.bypass_attempts_recorded} bypass attempt(s) across ${coverage.bypass_actors_recorded} actor(s), ${coverage.epics_examined} epic(s).`;
      return toCallToolResult({
        success: true,
        data: {
          observations: observations.length,
          persisted, updated,
          categories: built.map((f) => f.category),
          coverage,
          message: built.length === 0
            ? `No findings — clean work (silence is correct). ${coverageLine}`
            : `${built.length} finding(s) persisted. ${coverageLine}`,
        },
      });
    }),
  );
}
