# CLAUDE.md — ido4 MCP

## Overview

ido4 MCP is a **Development Governance Platform** — an MCP server that provides deterministic methodology enforcement for AI-augmented development teams.

It exposes wave-based project management, business rule validation, and intelligent suggestions as MCP tools that Claude Code (and other MCP-compatible AI environments) can use natively.

## Project Structure

This is an npm workspaces monorepo with three packages:

```
ido4-MCP/
├── packages/
│   ├── core/       # @ido4/core — Domain logic, zero CLI dependencies
│   ├── mcp/        # @ido4/mcp — MCP server (STDIO transport)
│   └── plugin/     # Claude Code plugin (skills, hooks, agent)
├── package.json    # Workspace root
└── tsconfig.json   # Shared TypeScript config
```

### @ido4/core
The domain layer. Contains: task workflow services, BRE (Business Rule Engine) validation pipeline, wave management, epic integrity enforcement, dependency analysis, GitHub GraphQL repositories. **Zero dependencies on CLI frameworks, terminal formatting, or MCP SDK.**

### @ido4/mcp
The MCP server. Wraps @ido4/core domain services as MCP tools, resources, and prompts. Uses STDIO transport for Claude Code integration.

### plugin/
Claude Code plugin bundle. Contains skills (/standup, /plan-wave, /board, /spec-validate), the project-manager agent with persistent memory, and automation hooks.

## Two-Artifact Architecture (Strategic Spec → Technical Spec)

ido4 MCP participates in a two-artifact pipeline with ido4shape:

```
ido4shape (conversation) → strategic spec → ido4 MCP decomposition → technical spec → existing ingestion → GitHub issues
```

- **ido4shape** produces strategic specs — multi-stakeholder understanding (the WHAT) with minimal metadata (priority, strategic risk, depends_on) and rich prose (cross-cutting concerns, stakeholder attribution, constraints)
- **ido4 MCP** will consume the strategic spec, explore the actual codebase, and produce a technical spec (the HOW) in the existing artifact format (effort, risk, type, ai, depends_on)
- The existing **ingestion pipeline** (spec-parser.ts → spec-mapper.ts → GitHub issues) stays unchanged — it eats the technical spec

**Current status:**
- Strategic spec format: designed (in ido4shape repo: `references/strategic-spec-format.md`)
- Transferred assets: `packages/plugin/skills/spec-quality/` and `packages/plugin/skills/spec-validate/` + `packages/plugin/agents/spec-reviewer.md`
- Decomposition agent: not yet built — see `strategic-spec-mcp-plan.md` for the work plan
- Strategic spec format reference in ido4shape: `references/example-strategic-notification-system.md`

## Architecture Principles

1. **Interface-based DI**: All services depend on interfaces, never concrete classes
2. **ServiceContainer**: Single initialization point — creates all services once per session
3. **No `any` types**: Use specific interfaces. No `@ts-ignore`.
4. **Structured errors**: Every error has a code, context, remediation, and retryable flag
5. **Deterministic validation**: The BRE pipeline runs real code, not LLM reasoning
6. **Retry and resilience**: GraphQL client has exponential backoff, rate limit tracking, pagination

## Key Domain Concepts

- **Wave**: A self-contained execution unit (like a sprint). Tasks are assigned to waves.
- **Epic**: A container for related tasks. All tasks in an epic MUST be in the same wave (Epic Integrity).
- **BRE**: Business Rule Engine — composable validation pipeline with 20+ steps
- **Transition**: A workflow state change (start, review, approve, block, unblock, return, refine, ready)

## The 5 Unbreakable Principles

1. **Epic Integrity**: All tasks within an epic MUST be assigned to the same wave
2. **Active Wave Singularity**: Only one wave can be active at a time
3. **Dependency Coherence**: A task's wave must be numerically higher than dependency tasks' waves
4. **Self-Contained Execution**: Each wave contains all dependencies needed for its completion
5. **Atomic Completion**: A wave is complete only when ALL its tasks are in "Done"

## Development Commands

```bash
npm install          # Install all workspace dependencies
npm run build        # Build all packages
npm run test         # Run all tests
npm run clean        # Remove all dist/ directories
```

## Local Development with Plugin

To run Claude Code with the full ido4 plugin (skills, agent, hooks, MCP server):

```bash
claude --plugin-dir ./packages/plugin
```

Prerequisites:
- `GITHUB_TOKEN` env var set (or `export GITHUB_TOKEN=$(gh auth token)`)
- Build completed: `npm run build`

Skills are namespaced: `/ido4:standup`, `/ido4:board`, `/ido4:pilot-test`, etc.

## Releasing

Both `@ido4/core` and `@ido4/mcp` are published to npm. CI auto-publishes on version tags.

**To release a new version:**
1. Bump version in both `packages/core/package.json` and `packages/mcp/package.json` (keep them in sync)
2. Commit: `git commit -am "release v0.x.y"`
3. Tag: `git tag v0.x.y`
4. Push: `git push origin main --tags`
5. GitHub Actions builds, tests, and publishes both packages to npm

**CI Workflows** (`.github/workflows/`):
- `ci.yml` — Runs build + test on every push to `main` and on PRs
- `publish.yml` — Publishes to npm on `v*` tags. Requires `NPM_TOKEN` repo secret (already configured)

**Package versions must stay in sync** — both packages are released together.

## Distribution

- **npm**: `@ido4/core`, `@ido4/mcp` — https://www.npmjs.com/org/ido4
- **GitHub**: https://github.com/ido4-dev/ido4
- **Docs (GitBook)**: https://hydro-dev.gitbook.io/ido4 — auto-syncs from `docs/` directory
- **Website**: https://github.com/ido4-dev/ido4-website (separate repo, deployed to ido4.dev)

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

## ido4 Development Governance

This project uses **ido4** for specs-driven development governance (Hydro — Wave-Based Governance methodology).

### Workflow

1. **Check the board** before starting work: use the `get_wave_status` tool or the `/ido4:board` skill
2. **Pick your next task**: use `get_next_task` for a scored recommendation, or check the board
3. **Start work**: call `start_task` — read the full briefing (spec, dependencies, downstream needs) before writing code
4. **Work from the spec**: the GitHub issue body IS the specification — read it completely, understand acceptance criteria
5. **Write context**: add comments on the issue at key decisions (what you decided, why, what interfaces you created)
6. **Complete work**: verify acceptance criteria are met, tests pass, then call `approve_task`

### Principles

- **Epic Integrity**: All tasks within an epic MUST be assigned to the same wave
- **Active Wave Singularity**: Only one wave can be active at a time
- **Dependency Coherence**: A task's wave must be numerically >= its dependency tasks' waves
- **Self-Contained Execution**: Each wave contains all dependencies needed for its tasks
- **Atomic Completion**: A wave is complete only when ALL its tasks are in terminal state

These are non-negotiable governance rules enforced by the Business Rule Engine (BRE).

### Wave Structure

- **Wave**: Execution container
- **Epic**: Execution container

### Available Skills

- `/ido4:standup` — Governance-aware briefing with risk detection
- `/ido4:board` — Flow intelligence and bottleneck analysis
- `/ido4:compliance` — Governance audit with quantitative scoring
- `/ido4:health` — Quick health check (RED/YELLOW/GREEN)
- `/ido4:plan-wave` — Wave composition with principle validation
- `/ido4:retro-wave` — Wave retrospective with data-backed analysis

### Configuration

- **Methodology**: Hydro — Wave-Based Governance (`.ido4/methodology-profile.json`)
- **Project**: [GitHub Project](https://github.com/users/b-coman/projects/115)
- **Audit trail**: `.ido4/audit-log.jsonl` (immutable governance events)
<!-- /ido4 -->