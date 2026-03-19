# Changelog

All notable changes to ido4 are documented here.

Both `@ido4/core` and `@ido4/mcp` are released together at the same version.

## [0.3.0] — 2026-03-19

Decomposition pipeline. ido4 MCP can now consume strategic specs from ido4shape and produce technical specs for the ingestion pipeline.

- **Strategic spec parser**: Parses ido4shape output (format: strategic-spec v1.0) into structured AST. Extracts project context, stakeholders, cross-cutting concerns, groups with priority, capabilities with strategic risk and functional dependencies. Validates format, refs, cycles, and allowed values.
- **`parse_strategic_spec` MCP tool**: Gives agents structured input from the parser — project overview, dependency graph, validation errors.
- **Code analysis agent**: Explores the codebase per strategic capability. Produces a technical canvas — intermediate artifact mapping capabilities to code modules, patterns, architecture, and complexity assessments.
- **Spec writing agent**: Reads the technical canvas, decomposes capabilities into right-sized implementation tasks with code-grounded metadata (effort, risk, type, AI suitability, dependencies). Follows the Goldilocks principle for task sizing.
- **`/ido4:decompose` skill**: Orchestrates the full pipeline — parse → analyze codebase → write technical tasks → validate → optionally ingest. Produces reviewable canvas and ingestion-ready technical spec.
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
