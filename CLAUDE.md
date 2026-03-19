# CLAUDE.md — ido4 MCP

## Overview

ido4 MCP is a **Development Governance Platform** — an MCP server that provides deterministic methodology enforcement for AI-augmented development teams.

It exposes methodology-agnostic project governance as MCP tools that Claude Code (and other MCP-compatible AI environments) can use natively. Three built-in methodologies: Hydro (wave-based), Scrum (sprint-based), Shape Up (cycle-based). The engine is methodology-agnostic — profiles are data, the engine is code.

## Project Structure

This is an npm workspaces monorepo with three packages:

```
ido4-MCP/
├── packages/
│   ├── core/       # @ido4/core — Domain logic, zero CLI dependencies
│   ├── mcp/        # @ido4/mcp — MCP server (STDIO transport)
│   └── plugin/     # Claude Code plugin (skills, hooks, agents)
├── package.json    # Workspace root
└── tsconfig.json   # Shared TypeScript config
```

### @ido4/core
The domain layer. Contains: task workflow services, BRE (Business Rule Engine) validation pipeline (32 steps), container management, integrity enforcement, dependency analysis, compliance scoring, analytics, work distribution, merge readiness, ingestion pipeline, strategic spec parser. Profile-driven state machine. **Zero dependencies on CLI frameworks, terminal formatting, or MCP SDK.**

### @ido4/mcp
The MCP server. Wraps @ido4/core domain services as MCP tools, resources, and prompts — dynamically generated from the active methodology profile. Uses STDIO transport for Claude Code integration. Hydro: 58 tools, Scrum: 56 tools, Shape Up: 54 tools.

### plugin/
Claude Code plugin bundle. Contains 18 skills (governance, planning, retrospectives, sandbox demos, spec validation, decomposition), 4 agents (PM, code-analyzer, technical-spec-writer, spec-reviewer), and automation hooks.

## Two-Artifact Architecture (Strategic Spec → Technical Spec) — IMPLEMENTED (v0.3.0+)

ido4 MCP participates in a two-artifact pipeline with ido4shape:

```
ido4shape (conversation) → strategic spec → ido4 MCP decomposition → technical spec → ingestion → GitHub issues
```

- **ido4shape** produces strategic specs — multi-stakeholder understanding (the WHAT) with minimal metadata (priority, strategic risk, depends_on) and rich prose (cross-cutting concerns, stakeholder attribution, constraints)
- **ido4 MCP** consumes the strategic spec, explores the codebase, and produces a technical spec (the HOW) with implementation tasks (effort, risk, type, ai, depends_on)
- The **ingestion pipeline** (spec-parser.ts → spec-mapper.ts → GitHub issues) creates capability issues (mapped to epic/bet) with tasks as sub-issues

**Decomposition pipeline (built):**
- Strategic spec parser: `packages/core/src/domains/ingestion/strategic-spec-parser.ts`
- `parse_strategic_spec` MCP tool
- Code analysis agent: `packages/plugin/agents/code-analyzer.md`
- Technical spec writer: `packages/plugin/agents/technical-spec-writer.md`
- Orchestration skill: `/ido4:decompose`
- Work plan: `strategic-spec-mcp-plan.md`

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
- **BRE**: Business Rule Engine — composable validation pipeline with 32 steps, configurable per methodology profile.
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
npm run test         # Run all tests (1,768 tests)
npm run clean        # Remove all dist/ directories
```

## Local Development with Plugin

To run Claude Code with the full ido4 plugin (skills, agents, hooks, MCP server):

```bash
claude --plugin-dir ./packages/plugin
```

Prerequisites:
- `GITHUB_TOKEN` env var set (or `export GITHUB_TOKEN=$(gh auth token)`)
- Build completed: `npm run build`

Skills are namespaced: `/ido4:standup`, `/ido4:board`, `/ido4:decompose`, etc.

## Releasing

Both `@ido4/core` and `@ido4/mcp` are published to npm at the same version. CI auto-publishes on version tags.

```bash
./scripts/release.sh 0.5.0    # Bumps both packages, commits, tags, pushes
```

CI Workflows (`.github/workflows/`):
- `ci.yml` — Build + test on every push to `main` and on PRs
- `publish.yml` — Publishes to npm on `v*` tags

## Distribution

- **npm**: `@ido4/core`, `@ido4/mcp` (v0.4.0) — https://www.npmjs.com/org/ido4
- **GitHub**: https://github.com/ido4-dev/ido4
- **Docs (GitBook)**: https://hydro-dev.gitbook.io/ido4 — auto-syncs from `docs/` directory
- **Website**: ido4.dev (separate repo)

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
