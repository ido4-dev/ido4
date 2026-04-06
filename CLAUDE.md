# CLAUDE.md — ido4 MCP

## Overview

ido4 MCP is the **platform that makes AI-hybrid software development work at scale.** It gives every AI coding session full project understanding — what to build, what was built before, what depends on your output, and how to verify you built the right thing. Deterministic governance ensures quality without slowing agents down.

It runs as an MCP server inside Claude Code (and any MCP-compatible AI environment), providing context assembly, task intelligence, institutional memory, and methodology enforcement. Three built-in methodologies: Hydro (wave-based), Scrum (sprint-based), Shape Up (cycle-based). The engine is methodology-agnostic — profiles are data, the engine is code.

## Project Structure

This is an npm workspaces monorepo with three packages:

```
ido4-MCP/
├── packages/
│   ├── spec-format/ # @ido4/spec-format — Strategic spec parser, zero deps, CLI
│   ├── core/        # @ido4/core — Domain logic, depends on @ido4/spec-format
│   └── mcp/         # @ido4/mcp — MCP server (STDIO transport)
├── package.json     # Workspace root
└── tsconfig.json    # Shared TypeScript config
```

### @ido4/spec-format
The strategic spec format contract. Contains the parser that validates and parses strategic spec artifacts produced by ido4shape. Published as a standalone package with a CLI entry point (`ido4-spec-format`) so ido4shape can run deterministic structural validation in Cowork. **Zero npm dependencies.**

### @ido4/core
The domain layer. Context assembly, task intelligence, work distribution, institutional memory (audit trail, analytics, compliance scoring), BRE (Business Rule Engine) validation pipeline, container management, integrity enforcement, dependency analysis, merge readiness, ingestion pipeline. Profile-driven state machine. **Depends on @ido4/spec-format for strategic spec parsing. Zero dependencies on CLI frameworks, terminal formatting, or MCP SDK.**

### @ido4/mcp
The MCP server. Wraps @ido4/core domain services as MCP tools, resources, and prompts — dynamically generated from the active methodology profile. Composite aggregators assemble full project context in single calls. Uses STDIO transport for Claude Code integration. Tool count varies by methodology (driven by profile transitions and containers).

### ido4dev Plugin (separate repo)
The Claude Code plugin lives at [ido4-dev/ido4dev](https://github.com/ido4-dev/ido4dev). Distributed via the [ido4-plugins marketplace](https://github.com/ido4-dev/ido4-plugins). Install: `/plugin install ido4dev@ido4-plugins`.

## Two-Artifact Architecture (Strategic Spec → Technical Spec) — IMPLEMENTED (v0.3.0+)

ido4 MCP participates in a two-artifact pipeline with ido4shape:

```
ido4shape (conversation) → strategic spec → ido4 MCP decomposition → technical spec → ingestion → GitHub issues
```

- **ido4shape** produces strategic specs — multi-stakeholder understanding (the WHAT) with minimal metadata (priority, strategic risk, depends_on) and rich prose (cross-cutting concerns, stakeholder attribution, constraints)
- **ido4 MCP** consumes the strategic spec, explores the codebase, and produces a technical spec (the HOW) with implementation tasks (effort, risk, type, ai, depends_on)
- The **ingestion pipeline** (spec-parser.ts → spec-mapper.ts → GitHub issues) creates capability issues (mapped to epic/bet) with tasks as sub-issues

**Decomposition pipeline (built):**
- Strategic spec parser: `packages/spec-format/src/strategic-spec-parser.ts` (extracted to `@ido4/spec-format`)
- `parse_strategic_spec` MCP tool
- Code analysis agent: [ido4dev repo](https://github.com/ido4-dev/ido4dev) `agents/code-analyzer.md`
- Technical spec writer: [ido4dev repo](https://github.com/ido4-dev/ido4dev) `agents/technical-spec-writer.md`
- Orchestration skill: `/ido4dev:decompose`
- Architecture: `architecture/decomposition-pipeline.md`

**Capability-based hierarchy (v0.4.0):**
Strategic capabilities become the methodology's grouping container (epic in Hydro/Scrum, bet in Shape Up). Tasks are sub-issues of capabilities. Groups from ido4shape provide decomposition context but don't become GitHub issues.

## Architecture Principles

1. **Interface-based DI**: All services depend on interfaces, never concrete classes
2. **ServiceContainer**: Single initialization point — creates all services once per session
3. **No `any` types**: Use specific interfaces. No `@ts-ignore`.
4. **Structured errors**: Every error has a code, context, remediation, and retryable flag
5. **Deterministic validation**: The BRE pipeline runs real code, not LLM reasoning
6. **Retry and resilience**: GraphQL client has exponential backoff, rate limit tracking, pagination
7. **Profile-driven**: Methodology profiles define states, transitions, containers, integrity rules, pipelines. The engine reads profiles, not methodology-specific code.

## Key Domain Concepts

- **Container**: A methodology-specific grouping unit. Hydro: Wave (execution) + Epic (grouping). Scrum: Sprint (execution) + Epic (grouping). Shape Up: Cycle (execution) + Bet (grouping) + Scope (optional).
- **Capability**: A functional requirement from the strategic spec that becomes an epic/bet — the parent issue for implementation tasks.
- **BRE**: Business Rule Engine — composable validation pipeline, configurable per methodology profile.
- **Transition**: A workflow state change (start, review, approve, block, unblock, return, and methodology-specific actions like refine, ready, shape, bet, ship, kill).

## Governance Principles

These are enforced by the BRE. Which principles apply depends on the methodology:

**Hydro:**
1. **Epic Integrity**: All tasks within an epic MUST be assigned to the same wave
2. **Active Wave Singularity**: Only one wave can be active at a time
3. **Dependency Coherence**: A task's wave must be >= dependency tasks' waves
4. **Self-Contained Execution**: Each wave contains all dependencies needed for its completion
5. **Atomic Completion**: A wave is complete only when ALL its tasks are in terminal state

**Scrum:** Sprint singularity + dependency coherence + atomic completion. Epics span sprints (no epic-sprint integrity).

**Shape Up:** Cycle singularity + bet-cycle integrity + circuit breaker (time-based kill). Fixed time, variable scope.

## Development Commands

```bash
npm install          # Install all workspace dependencies
npm run build        # Build all packages
npm run test         # Run all tests
npm run clean        # Remove all dist/ directories
```

## Using the Plugin

**For users** — install from the marketplace (no clone, no build):

```bash
/plugin marketplace add ido4-dev/ido4-plugins
/plugin install ido4dev@ido4-plugins
```

**For local development** — point Claude Code at the ido4dev repo clone:

```bash
claude --plugin-dir ../ido4dev
```

Prerequisites:
- `GITHUB_TOKEN` env var set (or `export GITHUB_TOKEN=$(gh auth token)`)
- Build completed: `npm run build`

Skills are namespaced: `/ido4dev:standup`, `/ido4dev:board`, `/ido4dev:decompose`, etc.

## Releasing

All three packages (`@ido4/spec-format`, `@ido4/core`, `@ido4/mcp`) are published to npm at the same version. CI auto-publishes on version tags.

```bash
./scripts/release.sh 0.5.0    # Bumps all three packages, commits, tags, pushes
```

CI Workflows (`.github/workflows/`):
- `ci.yml` — Build + test on every push to `main` and on PRs. Also builds and smoke-tests the spec-format bundle.
- `publish.yml` — Publishes to npm on `v*` tags. After publishing, dispatches `spec-format-published` event to ido4shape so its CI can auto-update the bundled validator.
- `docs.yml` — Builds and deploys docs to Firebase on push to `main` when `docs/` changes

## Downstream: ido4shape Validator Bundle

ido4shape ships a bundled copy of the `@ido4/spec-format` CLI for deterministic spec validation without npm install. The bundle is built by `npm run build:bundle -w @ido4/spec-format`, producing `packages/spec-format/dist/spec-validator.bundle.js` — a single-file esbuild bundle (~8KB, zero npm deps).

**After releasing:** The publish workflow dispatches a `spec-format-published` event to ido4shape. ido4shape's `update-validator.yml` workflow automatically creates a PR with the new bundle. Patch/minor updates auto-merge after CI passes. Major version updates require review (output format may have changed).

**No manual downstream steps needed after tagging a release.** Requires `IDO4SHAPE_DISPATCH_TOKEN` secret (PAT with `repo` scope) in this repo for cross-repo dispatch. ido4shape requires a `PAT` secret for PR creation that triggers CI.

Full architecture: `architecture/bundled-validator-architecture.md`

## Distribution

- **npm**: `@ido4/spec-format`, `@ido4/core`, `@ido4/mcp` — https://www.npmjs.com/org/ido4
- **GitHub**: https://github.com/ido4-dev/ido4
- **Docs (Starlight)**: https://docs.ido4.dev — built with Astro Starlight, hosted on Firebase
- **Website**: ido4.dev (separate repo)

## Documentation Sync

After any change that affects architecture, services, tools, profiles, validation steps, or the plugin — verify and update all affected documentation. Code and docs must stay synchronized.

### Documentation Map

| Code Area | Affected Docs | Affected Diagrams |
|---|---|---|
| `packages/core/src/domains/tasks/` (BRE, validation steps) | `architecture/validation-extensibility.md`, `docs/src/content/docs/concepts/business-rule-engine.md` | `diagrams/04-bre-pipeline.html` |
| `packages/core/src/domains/audit/`, `analytics/`, `compliance/` | `architecture/event-sourced-governance.md`, `docs/src/content/docs/concepts/audit-compliance.md`, `docs/src/content/docs/enterprise/compliance.md` | `diagrams/03-event-sourcing.html` |
| `packages/core/src/domains/agents/`, `distribution/`, `gate/` | `architecture/multi-agent-coordination.md`, `docs/src/content/docs/concepts/multi-agent.md` | `diagrams/07-multi-agent.html` |
| `packages/core/src/container/service-container.ts` | `architecture/technical-stack.md` | `diagrams/08-service-container.html` |
| `packages/core/src/profiles/` | `architecture/methodology-runner.md`, `docs/src/content/docs/enterprise/methodology.md` | `diagrams/05-profile-generation.html` |
| `packages/spec-format/src/` (strategic spec parser, format contract) | `architecture/decomposition-pipeline.md`, `architecture/two-artifact-pipeline.md`, `architecture/spec-artifact-format.md` | `diagrams/06-decomposition-pipeline.html` |
| `packages/core/src/domains/ingestion/` (technical spec parser, ingestion) | `architecture/decomposition-pipeline.md`, `architecture/two-artifact-pipeline.md` | `diagrams/06-decomposition-pipeline.html` |
| `packages/mcp/src/` (tools, resources, prompts) | `architecture/vision-and-roadmap.md` (tool counts) | `diagrams/01-system-overview.html`, `diagrams/02-request-flow.html` |
| [ido4dev plugin](https://github.com/ido4-dev/ido4dev) (skills, agents, hooks) | `docs/src/content/docs/skills/overview.md`, `docs/src/content/docs/skills/pm-agent.md` | `diagrams/09-plugin-layer.html` |
| Any architectural change | `architecture/vision-and-roadmap.md`, `CLAUDE.md` | `diagrams/00-system-block.html` |
| Agent workflow changes | `architecture/context-delivery.md`, `architecture/llm-strategy.md` | `diagrams/10-agent-workflow.html` |

### Sync Rules

1. **New validation step added?** Update `docs/src/content/docs/concepts/business-rule-engine.md`, `diagrams/04-bre-pipeline.html`, `diagrams/01-system-overview.html`
2. **New tool registered?** Update `architecture/vision-and-roadmap.md`, `README.md`, website `SocialProofSection.tsx`
3. **New skill/agent/hook added?** Update `docs/src/content/docs/skills/overview.md`, `diagrams/09-plugin-layer.html`
4. **New domain service?** Update `diagrams/08-service-container.html`, `architecture/technical-stack.md`
5. **Profile changed?** Update `diagrams/05-profile-generation.html`, `architecture/methodology-runner.md`
6. **Website repo** (`/Users/bogdanionutcoman/dev-projects/ido4-website/`) must be updated when public-facing numbers or identity framing changes

### After completing work, ask:
- "Did I change any architecture, services, tools, or validation steps?"
- If yes: check the documentation map above and update affected docs
- If adding a new feature: update `architecture/vision-and-roadmap.md` current state table

## Ideas Backlog

The `ideas/` directory is a parking lot for future ideas, explorations, and strategic directions. Each idea is a separate markdown file with frontmatter (date, status, category). Statuses: `idea` (raw), `exploring` (being discussed), `ready` (understood, waiting for prioritization), `parked` (good idea, wrong time), `rejected` (decided against).

**When to capture ideas:**
- The user explicitly says "park that", "capture this", "good idea for later"
- During brainstorming, offer to capture at the end by reviewing what surfaced
- **During implementation work:** if you discover a capability gap, a natural extension point, or a "this would be better if..." moment — ask the user: "I noticed [X] could be improved by [Y]. Worth parking as an idea?" Don't auto-save, but do proactively surface it.
- When the user mentions future plans, integrations, or "someday we should..." — offer to capture

**When NOT to capture:** bugs (those are issues), tasks for the current session, things already documented elsewhere.

## Workflow

### Plan First
- Enter plan mode for any non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing a broken approach
- Write the plan before writing code

### Verify Before Done
- Never mark a task complete without proving it works
- Run tests, check build, demonstrate correctness
- Ask yourself: "Would a staff engineer approve this?"

### Self-Improvement Loop
- After ANY correction from the user, update `memory/lessons.md` with the pattern
- Write rules that prevent the same mistake twice
- Review lessons at session start

### Autonomous Bug Fixing
- When given a bug report: just fix it — don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Go fix failing CI tests without being told how

## Rules

1. Every service method must have a corresponding interface definition
2. Every write operation must support `dryRun` parameter
3. Every tool response follows the `{success, data, suggestions, warnings}` shape
4. Every state transition creates an audit entry
5. Tests must test real behavior, not just existence (`expect(true).toBe(true)` is forbidden)
6. No hardcoded analytics values — use real data or mark explicitly as TODO with a tracking issue
7. Simplicity first — make every change as simple as possible, minimal code impact
8. No laziness — find root causes, no temporary fixes, senior developer standards
9. **Same value ≠ same concept.** Before abstracting, map every usage site to the concept it represents. If two sites use the same string but mean different things, they need different abstractions. Applies to refactoring, config extraction, DRY consolidation — any shared representation over concrete values.
10. **"Behavior-preserving" requires behavior verification.** When a change claims zero behavioral impact, generate actual output and diff against the original. Tests passing is necessary but not sufficient. Make output diffing a mandatory step for behavior-preserving refactors.
11. **Mechanical-looking tasks are the most dangerous.** When a task feels like find-and-replace, slow down and ask: "Is there a semantic distinction here that the mechanical approach would destroy?" Treat apparent simplicity as a risk indicator, not a green light.
