# Changelog

All notable changes to ido4 are documented here.

All packages (`@ido4/spec-format`, `@ido4/core`, `@ido4/mcp`) are released together at the same version.

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
