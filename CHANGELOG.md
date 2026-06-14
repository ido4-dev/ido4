# Changelog

All notable changes to ido4 are documented here.

All packages (`@ido4/spec-format`, `@ido4/core`, `@ido4/mcp`) are released together at the same version.

## [0.11.0] — 2026-06-15

Minor — the airtight fix for AI-audit trustworthiness. New `persist_audit_findings` MCP tool so the PM agent has **no write path at all**; finding category + severity are derived deterministically server-side, making a confident mislabel structurally impossible.

**Why.** Across five ido4dev synthetic iterations the LLM PM agent overrode every soft constraint (prose discipline → a mandatory hard-stop ritual → a deterministic classifier it was told to call) — most starkly in synthetic-004, where it ran the classifier, got the correct "clean" verdict on a healthy task, and then hand-edited the state file anyway to fabricate a critical mislabel. The lesson: the guarantee must be tool-level — remove the agent's ability to write findings by any means.

- **`@ido4/core`** — `finding-classifier.ts` (`classifyObservation` + `classifySpecOrphanRate`): the "what is a ghost closure / rubber stamp / bypass pattern / …" thresholds as pure domain logic. A PR-backed closure can never classify as `ghost_closure`; a clean reviewed closure classifies as nothing. 13 tests.
- **`@ido4/mcp`** — `persist_audit_findings` tool: the agent supplies observations (facts + a note per audited unit); the tool classifies, composes deterministic ids, embeds the facts as evidence, and read-then-mutates the project-scoped governance state (preserving other fields, dedup by id, FIFO cap 20). The agent never sends a category/severity. Profile-independent (all modes). Tool counts: Hydro 64, Scrum 62, Shape Up 60, bootstrap 30.

**Consumer note (ido4dev):** the project-manager agent loses Write/Edit/Bash; it persists findings only through this tool. Any integration that had the agent writing `open_findings[]` directly should move to `persist_audit_findings`.

**Tests:** 1,863 passing (1250 core + 466 + 106 + 41; +13 over 0.10.1).

## [0.10.1] — 2026-06-14

Patch release — audit-trustworthiness + daily-ceremony fixes from the ido4dev synthetic-002/003 runs. No breaking changes (one additive response field).

**A5 — sprint-data path returned empty (two bugs, High).** The daily ceremonies (`get_standup_data` / `get_board_data` / `get_sprint_status`) returned the active sprint with `tasks: []` (or hard-errored "no active container") despite successful assignments — broken on day one of any sprint.
- `container-service.ts` `listContainers`: a container was `'active'` only once a task *completed*, so a freshly-loaded sprint (work in flight, nothing Done yet) was `'not_started'` and invisible to `resolveActiveContainer`. Now a container with assigned, not-all-done tasks is `'active'`.
- `task-service.ts` `listTasks` (the bigger one — another Hydro hardcode): it read the container from a hardcoded `fieldValues.Wave` and filtered on `containers['wave']`, so a Scrum task (field `Sprint`) or Shape Up (field `Cycle`) was invisible → empty boards for every non-Hydro project. `TaskService` now takes the profile and maps each container's `taskField` generically (legacy `wave` alias retained).

**A3 — ceremonies no longer dismiss governance findings as "phantom."** The retro/review/standup prompts reconciled PM findings against `query_audit_trail` and called a real deterred-bypass finding a phantom (deterred attempts never reach the audit log). All audit-trail steps across the 3 methodology prompt sets now carry a caveat: PM-persisted `open_findings` + deterred bypass attempts are governance-layer memory absent from the audit trail by design.

**A4 — oversize-pull advisory (additive).** Assigning an XL (oversized) task to a sprint/wave/cycle returns a non-blocking `ContainerAssignResult.warnings[]` entry. Dependency-readiness warnings tracked as a refinement.

**Tests:** 1,850 passing (1237 core + 466 + 106 + 41; +6 over 0.10.0).

## [0.10.0] — 2026-06-14

Governance-quality release driven by the ido4dev synthetic Scrum-org simulation (`ido4dev/reports/synthetic-001`). Two methodology-correctness fixes, one institutional-memory addition. **Behavior change: the default closing transition now requires an approving PR review (P2).**

**P1 — Profile-driven container naming (methodology equality).** `InputSanitizer.validateContainerFormat` hardcoded the Hydro `wave-NNN` pattern for ALL container names, so a Scrum project's `Sprint 1` was rejected and forced into `wave-001-...` (caught live by the synthetic). It now reads the active profile's execution-container `namePattern` / `singular` / `nameExample` (all already declared per profile — Scrum `^Sprint \d+$` / "Sprint 14", Shape Up cycle, Hydro wave); falls back to the wave pattern only for legacy no-profile callers. `ContainerService` threads the rule into both call sites. +3 tests. Pulls forward the minimal slice of methodology-runner Phase 3.

**P2 — Definition-of-Done gate on closing transitions** (behavior change). A story could reach Done via `approve_task` with its linked PR open, unmerged, and unreviewed (a rubber-stamp closure the synthetic value-judge caught). The default closing pipeline ran only `ApprovalRequirementValidation`, which is purely advisory. `PRReviewValidation:1` (requires the linked PR to exist + have ≥1 approving review) existed but was wired only into the tech-debt override. Added it to all three default closing pipelines (Scrum `approve`, Hydro `approve`, Shape Up `ship`). Relaxed overrides unchanged (spike, kill; tech-debt stays at :2). GitHub blocks self-approval, so this genuinely requires another actor's review. +3 tests. **Consumers:** tasks now cannot close without an approving review on their PR — teams that close without PR review must add a profile override.

**P7 — (no engine change; see ido4dev hooks)** Deterred BRE-bypass attempts are now recorded at the PreToolUse gate in the ido4dev plugin (`state.bypass_attempts[]`), closing the gap where a blocked `skipValidation` attempt left no trace for the audit. Noted here because it completes the bypass-visibility story alongside the engine's existing `executed` flag.

**Multi-agent identity (P5 — confirmed already supported).** No code change. The feasibility pass confirmed `createMcpActor()` already resolves distinct `actor.id` from `IDO4_AGENT_ID`, and the audit store filters/groups by `actor.id` — so "one engineer, N agents" is representable today by launching each agent session with a distinct `IDO4_AGENT_ID`. Documented for the record.

**Tests:** 1,847 passing (1234 core + 466 + 106 + 41; +6 over 0.9.2).

## [0.9.2] — 2026-06-12

Patch release: error-UX hardening in `@ido4/core`. No behavior or schema changes — additive remediation strings only.

**Remediation strings added to user-reachable error paths that lacked them** (ido4dev Phase 5 WS5 error-UX audit; 7 sites):

- `infrastructure/github/core/error-mapper.ts` — the three generic fall-throughs (unclassified GraphQL errors, unclassified HTTP status errors, unknown error shape) now carry guidance: 5xx → retry shortly; 4xx/unclassified → verify `GITHUB_TOKEN` validity and repo + project scopes; unknown → network/token checks.
- `infrastructure/github/repositories/issue-repository.ts` — "Status option/Field not found in config" now explains the board-vs-profile mismatch (a renamed/deleted Project column) and recommends restore-or-reinitialize.
- `infrastructure/github/repositories/repository-repository.ts` — "Repository has no default branch" now says: push an initial commit, then retry.
- `domains/agents/agent-service.ts` — "Agent not registered" now points at `register_agent` / `list_agents`.

Audit inventory for the record: 72 `Ido4Error`-family throw sites in core; 51 already carried remediation; 14 deliberately left (self-explanatory NotFound sites with structured context; `RateLimitError` auto-injects remediation; sanitizer messages already instructive). All 54 MCP tool handlers verified wrapped in `handleErrors`. Full report: `ido4dev/reports/error-ux-audit-2026-06-12.md`.

**Tests:** 1,840 passing (unchanged — additive strings only).

## [0.9.1] — 2026-04-28

Patch release fixing prefix derivation in `@ido4/spec-format`.

**Bug fix — `derivePrefix` produced regex-violating output for em-dash titles** (`packages/spec-format/src/spec-parse-utils.ts`)

- The shared `derivePrefix(groupName)` helper used `split(/\s+/)`, letting em-dashes and other non-letter characters leak into derived prefixes (e.g., "Warehouse Foundation — Views and Pricing Tables" produced `"WF—VAPT"`). The output also had no length cap, so multi-word titles could exceed the downstream task-ref pattern `[A-Z]{2,5}`. Downstream tools (ido4specs) generating new capability refs from the prefix would emit headings that fail technical-spec parser validation.
- **Layer 1 fix:** non-letter characters are now treated as separators before splitting, multi-word output is capped at 5 characters, and an all-symbol input falls back to `'GRP'`.
- **Layer 2 fix (strategic-spec-parser only):** a post-process pass overrides each group's `prefix` with the prefix portion of the first capability ref present (e.g., `### WHF-01:` → `WHF`). Authors already encode their intent in capability IDs; that's now the source of truth. Title-derivation remains as the fallback for groups with no capabilities yet.
- This closes the prefix-mismatch issue documented as "decision needed" in `architecture/capability-hierarchy.md`. The doc is updated with the resolution.

**Tests:** 1,840 passing (was 1,804; +36 new — 33 in the new `tests/spec-parse-utils.test.ts` covering separators, length cap, edge cases, and a contract battery against `[A-Z]{2,5}`; 3 in `strategic-spec-parser.test.ts` for em-dash titles, cap-ref override, and empty-group fallback).

**Behavior change:** `StrategicGroup.prefix` for groups with capabilities now reflects the cap-ref prefix, not the title initials. Most consumers will see the same value (cap-ref prefix typically tracks the title), but groups whose authors picked a non-initial prefix (e.g., `NCO` for "Notification Core") will now correctly emit that prefix instead of `NC`.

## [0.9.0] — 2026-04-27

ido4dev Phase 5 engine substrate — bundled WS1 + WS3 + WS4 release covering the engine fixes, Tier B audit surface, and sandbox UX hardening that gate v1.0 of the `ido4dev` plugin. Behavior change disclosure: audit log shape extended (see WS1 / F4 below).

**WS1 — Engine fixes** (commit `9ad6af0`)

- **F5 — `complete_task` no-throw on never-valid actions.** `task-workflow-service.ts` short-circuits failed-validation paths before computing toStatus; failure responses return `toStatus = fromStatus`. Previously, a `complete_task` against an action that didn't resolve a status key threw `Unknown status key`.
- **F6 — explicit `executed: boolean` on every transition response.** Added to `ToolResponse` envelope as a sibling of `success`, and to `TaskTransitionEvent` for audit-log persistence. Hooks and audit consumers checking for committed transitions now test `executed === true`, not `success === true`.
- **F4 — audit log persists all attempted transitions** (behavior change). Removed the `workflowResult.executed` gate at `task-service.ts:267`; every non-dryRun transition attempt is now persisted to `.ido4/audit-log.jsonl` with the new `executed` flag. `AuditQuery` + `query_audit_trail` schema gain optional `executed?: boolean` filter; consumers filter `executed === true` for committed-only views, default returns attempts AND committed. Closes the institutional-memory gap where bypassed transitions disappeared from the trail.
- **F7 — `get_methodology_profile` MCP tool.** Returns the resolved `MethodologyProfile`. Mirrors the `ido4://methodology/profile` resource for tool-only consumers (Claude Code subagents can't read MCP resources). PM agent's profile-specific reasoning now grounds in a runtime fetch.

**WS3 — Tier B engine surface** (commit `d96a572`)

- **`pull.body` plumbed through `find_task_pr`.** GraphQL queries already selected the field; both repository implementations now include it in the `PullRequestInfo` return shape.
- **`get_task_comments(issueNumber)` MCP tool.** Wraps existing `IIssueRepository.getIssueComments`. Each comment is classified as `'ai-agent'` when the body contains the `<!-- ido4:context ` marker, otherwise `'human'`.
- **Spec-to-task lineage.** New `withLineageMarker` / `parseIdo4LineageMarker` utility prepends `<!-- ido4-lineage: ref=... -->` to every body created by `IngestionService.ingestSpec()` (capability issues use `ref=capability:Foo`, tasks use the spec's ref like `T-001`). New `get_task_lineage(issueNumber)` MCP tool reads the marker back. Lineage is informational, not authoritative.

**WS4 — Sandbox UX hardening** (commit `99a414c`)

- **Pre-flight before any mutation.** `preflightCreate(repository)` validates repo format + GitHub auth + repo accessibility + default branch in a single GraphQL query. Empty-repo case (the OBS-06 trigger) now fails clean with remediation; zero orphan issues / zero local config artifacts on rejection.
- **Best-effort rollback on mid-flight failure.** `createSandbox` accumulates a `CreateMutationLog` as each phase succeeds. On failure, walks reverse: PRs closed → branches deleted → issues closed → Project V2 deleted (gated by sandbox-title safety check) → local config removed. Honest scoping: not a saga; "if we created it, we try to clean it up."
- **Orphan sandbox cleanup** (OBS-09). New `listOrphanSandboxes()` / `deleteOrphanSandbox(projectId)` methods + `list_orphan_sandboxes` / `delete_orphan_sandbox` MCP tools. Reads viewer's projectsV2 paginated, identifies orphans whose linked repo no longer exists, deletes per orphan with title-based safety guard.

**Tool counts:** Hydro 61 → 63, Scrum 59 → 61, Shape Up 57 → 59 (+2 Tier B tools each: `get_task_comments`, `get_task_lineage`). Bootstrap mode unchanged at 29 tools.

**Tests:** 1,804 passing across 4 packages (was 1,788; +16 new — 9 lineage-marker unit tests + ingestion lineage assertion + 2 PR body assertions + 4 task-tool tests for the new comment + lineage tools).

## [0.7.2] — 2026-04-12

Infrastructure hardening release. No functional code changes to the parser or MCP server.

- **release.sh: `--yes` flag** for non-interactive agent/CI use. Warnings are auto-confirmed; errors still abort.
- **release.sh: local-vs-remote sync check** — detects when local main is behind origin (e.g., auto-update PR merged remotely) and aborts with clear remediation before pushing.
- **release.sh: portable website sync path** — replaced hardcoded absolute path with derived sibling path + `IDO4_WEBSITE_DIR` env var override.
- **actions/checkout@v4 → @v5** across all workflows (ci.yml, publish.yml, docs.yml) ahead of the Node.js 20 deprecation (2026-06-02).
- **Cross-repo architecture documentation** updated to reference the new `ido4-suite` meta-repo.

## [0.7.1] — 2026-04-10

Task ref parser accepts optional letter suffix for sub-task traceability. Fixes a silent-drop bug in the ido4dev decomposition pipeline where technical specs with suffixed refs (e.g., `NCO-01A`, `NCO-01B`) produced empty ingestion dry-runs.

- **Parser regex extended**: The `TASK_HEADING` regex in `@ido4/core` spec-parser and the `CAPABILITY_HEADING` regex in `@ido4/spec-format` strategic-spec-parser now accept an optional `[A-Z]` suffix after the digit portion. Preserves traceability when the technical-spec-writer decomposes a strategic capability into multiple sub-tasks sharing its ref prefix.
- **Sandbox template resolver updated**: `resolveTaskRefs()` in sandbox-service.ts matches the new format, keeping sandbox comment templates in sync with the parser.
- **Fully backward-compatible**: All existing specs without suffixes continue to match unchanged. No breaking changes.
- **Root cause**: `agents/technical-spec-writer.md` in the ido4dev plugin instructs the writer to decompose strategic `NCO-01` into tasks `NCO-01A`, `NCO-01B`. The parser's old regex `[A-Z]{2,5}-\d{2,3}` rejected the suffix, so the `### NCO-01A:` heading wasn't recognized as a task — it was silently absorbed as body text, producing a technically-parseable spec with zero tasks. Dry-run ingestion showed "0 issues would be created" with no error, making the bug invisible without a structural spec-reviewer catching it upstream.
- **3 new tests**: spec-parser.test.ts (+2, suffixed-only and mixed specs), strategic-spec-parser.test.ts (+1, suffixed capability ref). 1,762 total across all packages.

## [0.7.0] — 2026-04-06

Parser trust boundary fix. The strategic spec parser now correctly captures all content that ido4shape produces — closing a gap where every strategic spec since project inception had empty `project.description` in parser output.

- **Plain-text description support**: Parser now accumulates plain-text paragraphs as project description (alongside blockquotes). Fixes the mismatch where ido4shape's docs teach plain-text format but the parser only captured blockquote lines.
- **All markdown list markers**: `BULLET_ITEM` expanded from dash-only (`-`) to all standard markers (`-`, `*`, `+`, `1.`). Prevents silent data loss when the synthesizer produces numbered lists for stakeholders, constraints, non-goals, open questions, or success conditions.
- **28 new parser tests**: Plain-text description (10), description edge cases (8), numbered/alternative list markers (10). 69 total parser tests, 1,759 total across all packages.
- **CI fix**: `publish.yml` now runs `build:bundle` before npm publish, so the bundled validator is included in the npm package — enabling the automated ido4shape update pipeline.

## [0.6.0] — 2026-03-27

New package: `@ido4/spec-format`. The strategic spec parser — the format contract between ido4shape (producer) and ido4 MCP (consumer) — extracted into its own zero-dependency package with a CLI entry point.

- **`@ido4/spec-format` package**: Strategic spec parser, types, and shared utilities extracted from `@ido4/core`. Zero npm dependencies. 13 kB published size. Enables ido4shape to run deterministic structural validation in Cowork without the full MCP server.
- **CLI entry point** (`ido4-spec-format <file.md>`): Outputs rich JSON — full parsed structure, computed metrics, dependency graph, separated errors/warnings. Designed for intelligent agent consumption.
- **`@ido4/core` backward compatible**: Re-exports everything from `@ido4/spec-format`. Existing consumers (including `@ido4/mcp`) require no changes.
- **Sequential build order**: Root build script now builds spec-format → core → mcp to handle workspace dependency resolution correctly.
- **CI/CD updated**: `publish.yml` publishes `@ido4/spec-format` before `@ido4/core`. Release script manages all three packages.

1,731 tests across 3 packages (41 + 1,232 + 458). Build clean.

## [0.5.0] — 2026-03-22

Sandbox system redesign. The sandbox now uses ido4's own ingestion pipeline — the same code path that governs real projects creates the demo project. A companion demo codebase (ido4-demo) provides real TypeScript code for agents to analyze and build against.

- **Pipeline-based sandbox creation**: `SandboxService` calls `IngestionService.ingestSpec()` to create governed issues from a technical spec, replacing 2,000+ lines of hardcoded scenario definitions.
- **Algorithmic ScenarioBuilder**: Pure function that computes container assignments, state distribution, violations, audit events, context comments, narrative, and memory seed from the dependency graph. Zero hardcoded task refs — adapts automatically to any technical spec.
- **Demo codebase** ([ido4-demo](https://github.com/ido4-dev/ido4-demo)): TypeScript notification platform API, ~40% complete, 132 tests. Strategic spec (16 capabilities) + technical spec (17 tasks) validated against ido4's parsers. Public, v0.1.0 tagged.
- **`/ido4dev:onboard` skill**: Zero-friction first touch — auto-clones demo repo, creates sandbox with `projectRoot` parameter, runs guided governance discovery.
- **`/ido4dev:guided-demo` skill**: Four-act governance walkthrough — project overview, violation discovery, live enforcement, full pipeline demonstration. Methodology-agnostic.
- **`/ido4dev:sandbox-explore` skill**: Interactive exploration with 13 structured paths across governance discovery, enforcement, multi-agent coordination, and methodology-specific analysis.
- **`projectRoot` parameter**: Added to `create_sandbox`, `destroy_sandbox`, `reset_sandbox` tools. Enables onboarding skill to point sandbox at the cloned demo repo directory.
- **`groupRef` on `IngestSpecResult`**: Tasks now carry their capability group reference from the ingestion pipeline — builder reads it directly without re-parsing.
- **BREAKING**: `SandboxCreateResult.created.parentIssues` renamed to `capabilities`. New fields: `containerAssignments`, `stateTransitions`, `violations`.
- **Deprecated**: `/ido4dev:sandbox-hydro`, `/ido4dev:sandbox-scrum`, `/ido4dev:sandbox-shape-up` — replaced by methodology-agnostic `/ido4dev:guided-demo`.

1,731 tests. Build clean. Demo codebase: 132 tests.

## [0.4.0] — 2026-03-19

Capability-based architecture. Capabilities (from ido4shape strategic specs) are now the structural unit — they become epic/bet GitHub issues with tasks as sub-issues. Groups provide decomposition context but don't become GitHub issues.

- **Capability-based ingestion**: Technical spec format changed from `## Group:` to `## Capability:`. Capabilities map to the methodology's grouping container (epic in Hydro/Scrum, bet in Shape Up). Tasks are sub-issues of capabilities.
- **Scrum Epic container**: Scrum profile now has Epic as a grouping container, adding 7 tools (list, status, assign + 4 legacy epic tools). No epic-sprint integrity — epics span sprints, matching real-world Scrum.
- **Agent instructions aligned**: Code analyzer uses group context (priority, description) for decomposition ordering. Technical spec writer embeds group knowledge into capability descriptions. All agents, skills, and validators reference `## Capability:` format.
- **Semantic clarity**: Mapper uses `capability:` refs. Tool descriptions explain group→capability semantic transformation. Methodology mapping table updated across all documentation.
- **Shared parser utilities**: Extracted `parseMetadataLine` and `derivePrefix` into shared module — used by both technical and strategic spec parsers.

1,768 tests. Build clean.

## [0.3.0] — 2026-03-19

Decomposition pipeline. ido4 MCP can now consume strategic specs from ido4shape and produce technical specs for the ingestion pipeline.

- **Strategic spec parser**: Parses ido4shape output (format: strategic-spec v1.0) into structured AST. Extracts project context, stakeholders, cross-cutting concerns, groups with priority, capabilities with strategic risk and functional dependencies. Validates format, refs, cycles, and allowed values.
- **`parse_strategic_spec` MCP tool**: Gives agents structured input from the parser — project overview, dependency graph, validation errors.
- **Code analysis agent**: Explores the codebase per strategic capability. Produces a technical canvas — intermediate artifact mapping capabilities to code modules, patterns, architecture, and complexity assessments.
- **Technical spec writer agent**: Reads the technical canvas, decomposes capabilities into right-sized implementation tasks with code-grounded metadata (effort, risk, type, AI suitability, dependencies). Follows the Goldilocks principle for task sizing.
- **`/ido4dev:decompose` skill**: Orchestrates the full pipeline — parse → analyze codebase → write technical tasks → validate → optionally ingest. Produces reviewable canvas and ingestion-ready technical spec.
- **Dogfooding test fixture**: Synthetic strategic spec (Development Context Pipeline) targeting the ido4 codebase for end-to-end validation.

1,767 tests. Build clean.

## [0.2.0] — 2026-03-18

Methodology-agnostic engine. ido4 is no longer Hydro-specific — it runs any methodology from a profile definition.

- **Methodology runner**: `MethodologyProfile` type system with 3 built-in profiles (Hydro, Scrum, Shape Up). Profile is data, engine is code. Zero methodology knowledge in the engine.
- **Container abstraction**: Wave/Epic replaced with generic containers. N container types per profile (Hydro=2, Scrum=1, Shape Up=3). Integrity rules as discriminated unions.
- **Dynamic MCP layer**: Tools, resources, and prompts generated from profile at startup. Hydro gets 55 tools, Shape Up 51, Scrum 46.
- **Ingestion pipeline**: Spec parser, mapper, and GitHub issue creation from spec artifacts.
- **Execution intelligence**: Task execution aggregator with dependency signals, sibling analysis, downstream impact, risk flags, and critical path detection.
- **Per-methodology prompts**: Standup, board, compliance, and health prompts tailored to each methodology's language and concepts.
- **New BRE steps**: Circuit breaker (time-aware enforcement), context completeness, spec completeness. 32 steps total.
- **Methodology-specific sandbox scenarios**: Scrum sprint and Shape Up cycle alongside Hydro governance showcase.
- **Two-artifact architecture**: Assets transferred from ido4shape for strategic→technical spec pipeline.

1,726 tests. Build clean.

## [0.1.1] — 2026-03-07

- **npx fix**: Added `mcp` bin alias so `npx @ido4/mcp` resolves correctly.

`@ido4/mcp` only — `@ido4/core` stayed at 0.1.0.

## [0.1.0] — 2026-03-07

Initial public release. Phases 0–6 of the governance platform.

- **@ido4/core**: Domain layer with TaskService, BRE validation pipeline (27 steps), WaveService, EpicService, DependencyService, AuditService, AnalyticsService, ComplianceService, WorkDistributionService, MergeReadinessService. ServiceContainer with 9 layers.
- **@ido4/mcp**: MCP server with 51 tools, 9 resources, 7 prompts. STDIO transport for Claude Code integration.
- **Plugin**: 8 skills (/standup, /board, /compliance, /health, /plan-wave, /retro, /sandbox, /pilot-test), project-manager agent, automation hooks.
- **Governed sandbox**: Full project simulation with realistic data, no GitHub side effects.
- **CI/CD**: GitHub Actions for build+test on push, auto-publish to npm on version tags.

1,114 tests (843 core + 271 MCP).
