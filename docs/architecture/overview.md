# Architecture Overview

ido4 is a layered system where each layer has a clear responsibility and strict dependency direction: upper layers depend on lower layers, never the reverse.

## System Layers

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 3: Experience (packages/plugin)                       │
│                                                              │
│  8 Skills          PM Agent          2 Governance Hooks      │
│  /standup          Persistent        PostToolUse:            │
│  /plan-wave        memory,           state transitions,      │
│  /board            methodology       wave assignments        │
│  /compliance       expert,                                   │
│  /retro            multi-agent                               │
│  /health           coordination                              │
│  /sandbox                                                    │
│  /pilot-test                                                 │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: MCP Server (packages/mcp — @ido4/mcp)             │
│                                                              │
│  51 Tools          9 Resources       6 Prompts               │
│  Task (18)         project://        standup                  │
│  Wave (5)          methodology://    plan-wave                │
│  Epic (4)          audit://          board                    │
│  Agent (4)         analytics://      compliance               │
│  Audit (2)         compliance://     health                   │
│  Analytics (2)     coordination://   retro                    │
│  Distribution (2)                                            │
│  Gate (1)          4 Aggregators                              │
│  Compliance (1)    standup-data                               │
│  Sandbox (3)       board-data                                │
│  Skill Data (4)    compliance-data                            │
│  Dependency (2)    health-data                                │
│  Project (2)                                                 │
├──────────────────────────────────────────────────────────────┤
│  Layer 1: Core Domain (packages/core — @ido4/core)           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ServiceContainer (9-layer DI)                          │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Domain Services                                        │  │
│  │  TaskService · WaveService · EpicService               │  │
│  │  DependencyService · ProjectService                    │  │
│  │  AuditService · AnalyticsService · AgentService        │  │
│  │  ComplianceService · WorkDistributionService           │  │
│  │  MergeReadinessService · SandboxService                │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ BRE Pipeline                                           │  │
│  │  TaskTransitionValidator · 27 ValidationSteps          │  │
│  │  ValidationStepRegistry · MethodologyConfig            │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Infrastructure                                         │  │
│  │  GraphQLClient (retry · pagination · rate limiting)    │  │
│  │  IssueRepository · ProjectRepository                   │  │
│  │  RepositoryRepository · EventBus                       │  │
│  └────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│  External: GitHub Projects V2 · Issues · Pull Requests       │
└──────────────────────────────────────────────────────────────┘
```

## Design Principles

### Interface-Based Dependency Injection

Every service depends on interfaces, never concrete classes. All interfaces are defined in `container/interfaces.ts`:

```typescript
interface ITaskService {
  startTask(issueNumber: number, actor: ActorIdentity, options?: TransitionOptions): Promise<TransitionResult>;
  validateTransition(issueNumber: number, transition: string, actor: ActorIdentity): Promise<ValidationResult>;
  // ...
}
```

This enables testing (mock any service), extensibility (swap implementations), and clear contracts.

### ServiceContainer

The `ServiceContainer` is the single initialization point. It creates all services in a 9-layer dependency order:

```
Layer 1: Config (project root, GitHub token)
Layer 2: Infrastructure (GraphQL client, repositories)
Layer 3: Domain validators (EpicValidator, BRE pipeline)
Layer 4: Domain services (Task, Wave, Dependency, Epic)
Layer 5: Audit + Sandbox (event bus subscription)
Layer 6: Project + Analytics + Agents
Layer 7: Compliance (reads audit + analytics)
Layer 8: Work Distribution (scoring engine)
Layer 9: Merge Readiness (6-check gate)
```

Each layer can only depend on layers below it. This prevents circular dependencies and makes initialization order deterministic.

### Event Bus

An internal publish-subscribe event bus decouples producers from consumers:

- **Producers**: TaskService (emits `task.transition`), WorkDistributionService (emits recommendations)
- **Consumers**: AuditService (subscribes to `*`, persists everything), AnalyticsService (invalidates cache on events)

Events are fire-and-forget — producers don't wait for consumers. This keeps transition latency low.

### Tool Design Philosophy

MCP tools are **governed domain operations**, not GitHub API wrappers:

- Every write tool goes through the BRE (validation before mutation)
- Every write tool supports `dryRun` (validate without executing)
- Every write tool records an audit event
- Every tool response follows `{success, data, suggestions, warnings}`
- Read tools provide the visibility the governance platform needs

## Package Boundaries

### @ido4/core

Zero dependencies on CLI frameworks, MCP SDK, or terminal formatting. Contains:
- All domain logic (services, validators, analyzers)
- Infrastructure adapters (GitHub GraphQL, file persistence)
- Configuration management
- Event bus and audit subsystem

**Can be used independently** for programmatic governance.

### @ido4/mcp

Depends on `@ido4/core` and `@modelcontextprotocol/sdk`. Contains:
- Tool registrations (51 tools with Zod schemas)
- Resource providers (9 resources)
- Prompt definitions (6 prompts)
- Aggregators (composite data fetchers for skills)
- STDIO transport setup

**Can be used with any MCP client**, not just Claude Code.

### plugin/

Depends on `@ido4/mcp` (via `.mcp.json` configuration). Contains:
- Skill definitions (SKILL.md files with governance workflows)
- PM Agent (AGENT.md with persistent memory)
- Governance hooks (PostToolUse triggers)
- Plugin manifest

**Specific to Claude Code** — uses Claude Code's plugin system.

## Data Flow Example

A task transition flows through all layers:

```
User: "Start task #42"
  ↓
Claude Code → calls start_task MCP tool
  ↓
@ido4/mcp → validates input, creates actor identity
  ↓
@ido4/core TaskService.startTask()
  ↓
  1. Load task data from GitHub (ProjectRepository)
  2. Run BRE pipeline (TaskTransitionValidator)
     → 7 validation steps execute sequentially
     → Result: pass/fail with per-step details
  3. If pass: update status on GitHub (ProjectRepository)
  4. Emit task.transition event (EventBus)
     → AuditService persists to JSONL
     → AnalyticsService invalidates cache
  5. Return result with suggestions
  ↓
@ido4/mcp → formats response as {success, data, suggestions}
  ↓
Claude Code → displays result to user
  ↓
PostToolUse hook → checks for governance impact (unblocks, milestones)
```
