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
Claude Code plugin bundle. Contains skills (/standup, /plan-wave, /board), the project-manager agent with persistent memory, and automation hooks.

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

## Code Provenance

Domain logic is being extracted from the original ido4 CLI at:
`/Users/bogdanionutcoman/dev-projects/github-pm-ai-manager/`

The vision document describing the full transformation is at:
`/Users/bogdanionutcoman/dev-projects/github-pm-ai-manager/docs/_IN-DEVELOPMENT/ido4-next-vision-and-roadmap.md`

## Rules

1. Every service method must have a corresponding interface definition
2. Every write operation must support `dryRun` parameter
3. Every tool response follows the `{success, data, suggestions, warnings}` shape
4. Every state transition creates an audit entry
5. Tests must test real behavior, not just existence (`expect(true).toBe(true)` is forbidden)
6. No hardcoded analytics values — use real data or mark explicitly as TODO with a tracking issue
