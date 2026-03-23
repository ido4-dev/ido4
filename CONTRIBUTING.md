# Contributing to ido4

Thank you for your interest in contributing to ido4. This guide covers everything you need to get started.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- A GitHub account with a [personal access token](https://github.com/settings/tokens) (for integration testing)
- [GitHub CLI](https://cli.github.com/) (`gh`) recommended for token management

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ido4-dev/ido4.git
cd ido4-MCP

# Install all workspace dependencies
npm install

# Build all packages
npm run build

# Run all tests (1,731 tests)
npm run test
```

### Running with the Plugin

The ido4dev Claude Code plugin lives in a [separate repository](https://github.com/ido4-dev/ido4dev) and is distributed via the [ido4-plugins marketplace](https://github.com/ido4-dev/ido4-plugins).

For local development of the MCP server with the plugin:

```bash
export GITHUB_TOKEN=$(gh auth token)
claude --plugin-dir ../ido4dev
```

## Project Structure

This is an npm workspaces monorepo with two packages:

```
ido4-MCP/
├── packages/
│   ├── core/       # @ido4/core — Domain logic, zero CLI dependencies
│   └── mcp/        # @ido4/mcp — MCP server (STDIO transport)
├── architecture/   # Architecture decision docs
├── diagrams/       # HTML architecture diagrams
├── docs/           # Documentation (GitBook — auto-syncs)
├── ideas/          # Ideas backlog
├── package.json    # Workspace root
└── tsconfig.json   # Shared TypeScript config
```

### @ido4/core

The domain layer. Profile-driven methodology engine with 34 BRE validation steps, container management, integrity enforcement, dependency analysis, audit trail, analytics, compliance scoring, multi-agent coordination, work distribution, merge readiness, ingestion pipeline, sandbox with algorithmic ScenarioBuilder, and strategic spec parser. Three built-in profiles: Hydro, Scrum, Shape Up. **Zero dependencies on CLI frameworks or MCP SDK.**

### @ido4/mcp

The MCP server. Dynamically generates tools, resources, and prompts from the active methodology profile. STDIO transport. Hydro: 58 tools, Scrum: 56, Shape Up: 54. 6 composite aggregators, 9 resources, 8 prompts.

### ido4dev Plugin (separate repo)

The Claude Code plugin lives at [ido4-dev/ido4dev](https://github.com/ido4-dev/ido4dev). 21 skills (governance, planning, retrospectives, onboarding, guided demo, sandbox exploration, spec validation, decomposition), 4 agents (PM, code-analyzer, technical-spec-writer, spec-reviewer), and 2 governance hooks. Install via marketplace: `/plugin install ido4dev@ido4-plugins`.

## Architecture Principles

1. **Interface-based DI** — All services depend on interfaces, never concrete classes
2. **ServiceContainer** — Single initialization point, creates all services once per session (9 layers)
3. **No `any` types** — Use specific interfaces. No `@ts-ignore`.
4. **Structured errors** — Every error has a code, context, remediation, and retryable flag
5. **Deterministic validation** — The BRE pipeline runs real code, not LLM reasoning
6. **Every write supports `dryRun`** — All mutation tools accept a dryRun parameter
7. **Profile-driven** — Methodology profiles define states, transitions, containers, integrity rules, pipelines. The engine reads profiles, not methodology-specific code.

## Coding Standards

### TypeScript

- Strict mode enabled. No `any`, no `@ts-ignore`.
- All service methods must have a corresponding interface definition.
- Use specific types from `container/interfaces.ts`.

### Testing

- Tests must test real behavior, not just existence (`expect(true).toBe(true)` is forbidden).
- Use Vitest as the test runner.
- No hardcoded analytics values — use real data or mark explicitly as TODO.
- Cross-profile tests verify methodology-agnosticism — if a test only passes with one profile, there's a hardcoded string hiding.

### Tool Design

- Every tool response follows the `{success, data, suggestions, warnings}` shape.
- Every state transition creates an audit entry.
- Every write operation must support `dryRun`.
- Tools are **governed domain operations**, not GitHub API wrappers — every write goes through governance (BRE, actor identity, audit trail).

### Commits

- Write clear, descriptive commit messages focusing on the "why".
- One logical change per commit.

## Making Changes

1. **Read before editing.** Understand existing code before modifying it.
2. **Run tests.** `npm run test` must pass before submitting.
3. **Build clean.** `npm run build` must complete without errors.
4. **Keep it focused.** Don't add features, refactor code, or make improvements beyond the scope of your change.

## Pull Requests

1. Fork the repository and create a branch from `main`.
2. Make your changes following the coding standards above.
3. Ensure `npm run build && npm run test` passes.
4. Submit a PR with a clear description of what changed and why.

## Reporting Issues

Use [GitHub Issues](https://github.com/ido4-dev/ido4/issues) to report bugs or request features. Include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Environment details (Node version, OS)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
