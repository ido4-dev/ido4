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
import { classifyObservation, classifySpecOrphanRate } from '@ido4/core';
import { PersistAuditFindingsSchema } from '../schemas/finding-schemas.js';
import { handleErrors, toCallToolResult } from '../helpers/index.js';

const FINDINGS_CAP = 20;

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
    'Persist PM audit findings from gathered observations. You supply facts + a note per audited unit; this tool DERIVES category + severity deterministically and writes qualifying findings to governance state. You never choose categories — clean observations produce no finding. This is the only way to persist findings.',
    PersistAuditFindingsSchema,
    async (args) => handleErrors(async () => {
      const nowIso = new Date().toISOString();
      const observations = args.observations ?? [];

      // Classify → build deterministic findings.
      type Finding = Record<string, unknown> & { id: string; category: string };
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
      for (const obs of observations) {
        for (const c of classifyObservation(obs as never)) make(c.category, c.severity, obs as Record<string, unknown>);
      }
      const orphan = classifySpecOrphanRate(observations as never);
      if (orphan) make(orphan.category, orphan.severity, { actor_id: 'ai-agents', scope: 'sprint', note: `Spec-orphan rate ${(orphan.rate * 100).toFixed(0)}% across AI closures` });

      // Read-then-mutate the project state, preserving every runner-written field.
      const stateFile = resolveStateFile();
      let state: Record<string, unknown> = {};
      if (existsSync(stateFile)) {
        try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { state = {}; }
      }
      const existing = Array.isArray(state.open_findings) ? (state.open_findings as Finding[]) : [];
      const byId = new Map(existing.map((f) => [f.id, f]));
      let persisted = 0, updated = 0;
      for (const f of built) {
        const prev = byId.get(f.id);
        if (prev) { prev.last_seen = f.last_seen as string; prev.evidence = f.evidence; prev.resolved = false; prev.resolved_at = null; updated++; }
        else { byId.set(f.id, f); persisted++; }
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

      return toCallToolResult({
        success: true,
        data: {
          observations: observations.length,
          persisted, updated,
          categories: built.map((f) => f.category),
          message: built.length === 0 ? 'No findings — clean work (silence is correct).' : undefined,
        },
      });
    }),
  );
}
