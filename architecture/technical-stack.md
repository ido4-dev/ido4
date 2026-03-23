# Technical Stack

## Runtime

| Component | Technology | Why |
|---|---|---|
| Language | TypeScript (strict mode) | Type safety for a governance engine. No `any` types. No `@ts-ignore`. |
| Runtime | Node.js | MCP SDK requirement. STDIO transport for local development. |
| Package Manager | npm workspaces | Monorepo with `@ido4/core` and `@ido4/mcp`. Plugin distributed separately via [ido4-dev/ido4dev](https://github.com/ido4-dev/ido4dev). |

## Core Dependencies

| Package | Purpose | Used In |
|---|---|---|
| `@modelcontextprotocol/sdk` | MCP server implementation (STDIO transport) | `@ido4/mcp` |
| `zod` | Schema validation for tool inputs, config, and runtime validation | Both packages |
| `@octokit/graphql` | GitHub GraphQL API client | `@ido4/core` |

**Zero CLI framework dependencies.** No oclif, no chalk, no terminal formatting. The domain layer (`@ido4/core`) has no opinion about how its output is displayed.

## GitHub API

| API | Usage |
|---|---|
| GraphQL v4 | All GitHub operations — Projects V2, Issues, Pull Requests, Labels, Sub-issues |
| REST (limited) | PR file changes, vulnerability alerts (where GraphQL coverage is incomplete) |

### Resilience

The GraphQL client includes:
- **Exponential backoff** — Retries on transient failures (5xx, network errors) with increasing delays
- **Rate limit tracking** — Reads `X-RateLimit-Remaining` headers and throttles proactively
- **Cursor-based pagination** — Handles projects with >100 items without silent data loss
- **Request coalescing** — Batches related queries where possible

## Architecture Patterns

### Interface-Based Dependency Injection

Every service depends on interfaces, never concrete classes. All interfaces live in `container/interfaces.ts`:

```typescript
interface ITaskService {
  startTask(issueNumber: number, actor: ActorIdentity, options?: TransitionOptions): Promise<TransitionResult>;
}
```

### ServiceContainer (9-Layer DI)

Single initialization point. Creates all services in dependency order:

```
Layer 1: Config
Layer 2: Infrastructure (GraphQL, repositories)
Layer 3: Validators (BRE pipeline)
Layer 4: Domain services (Task, Container, Dependency, Epic)
Layer 5: Audit + Sandbox
Layer 6: Project + Analytics + Agents
Layer 7: Compliance
Layer 8: Work Distribution
Layer 9: Merge Readiness
```

Each layer depends only on layers below it. No circular dependencies.

### Event Bus

Internal publish-subscribe for decoupling:
- **Producers**: TaskService (`task.transition`), WorkDistributionService (recommendations)
- **Consumers**: AuditService (persists everything), AnalyticsService (invalidates cache)

Events are fire-and-forget — producers don't wait for consumers.

### Structured Errors

Every error has:
- `code` — Machine-readable error identifier
- `context` — Relevant data for debugging
- `remediation` — What to do about it
- `retryable` — Whether the operation can be retried

### Profile-Driven Engine

The engine reads methodology profiles (TypeScript constants or JSON files) and generates everything dynamically: tools, prompts, pipelines, compliance scoring. Zero methodology-specific code in the engine. Adding a new methodology means writing a profile, not changing engine code.

## Testing

| Framework | Used For |
|---|---|
| Vitest | All tests — unit, integration, and service-level |

**Test counts (v0.5.0):**
- `@ido4/core`: 1,273 tests
- `@ido4/mcp`: 458 tests (including server integration)
- **Total**: 1,731 tests

**Test philosophy**: Tests must test real behavior, not existence. `expect(true).toBe(true)` is forbidden. Cross-profile tests verify methodology-agnosticism — if a test only passes with one profile, there's a hardcoded string hiding.

## CI/CD

| Workflow | Trigger | Actions |
|---|---|---|
| `ci.yml` | Push to `main`, PRs | Build + test all packages |
| `publish.yml` | `v*` tags | Publish `@ido4/core` and `@ido4/mcp` to npm |

Both packages are published at the same version. `./scripts/release.sh <version>` bumps both, commits, tags, and pushes.

## Distribution

| Channel | Package | Status |
|---|---|---|
| npm | `@ido4/core@0.5.0` | Public |
| npm | `@ido4/mcp@0.5.0` | Public |
| GitHub | `ido4-dev/ido4` | Public |
| Docs (Starlight) | `docs.ido4.dev` | Built with Astro Starlight, hosted on Firebase |
| Global install | `npx @ido4/mcp` | Works |

## Plugin Architecture (Claude Code)

The ido4dev plugin lives in a separate repository ([ido4-dev/ido4dev](https://github.com/ido4-dev/ido4dev)) and is distributed via the [ido4-plugins marketplace](https://github.com/ido4-dev/ido4-plugins). Install: `/plugin install ido4dev@ido4-plugins`.

| Component | Count | Description |
|---|---|---|
| Skills | 21 | SKILL.md files — governance workflows composing MCP tools (incl. onboard, guided-demo, sandbox-explore) |
| Agents | 4 | PM agent, spec-reviewer, code-analyzer, technical-spec-writer |
| Hooks | 2 | SessionStart (MCP server auto-install) + PostToolUse (governance signals) |
| MCP Server | npm | `@ido4/mcp` installed automatically via SessionStart hook to `${CLAUDE_PLUGIN_DATA}` |

## File Persistence

| File | Format | Purpose |
|---|---|---|
| `.ido4/project-info.json` | JSON | Project configuration, field IDs, repository info |
| `.ido4/methodology-profile.json` | JSON | Active methodology profile (may extend a built-in) |
| `.ido4/audit-log.jsonl` | JSONL (append-only) | Immutable audit trail |
| `.ido4/agent-store.json` | JSON | Registered agent profiles |
