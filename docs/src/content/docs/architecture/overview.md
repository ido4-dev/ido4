---
title: "Architecture Overview"
---

ido4 is a layered system where each layer has a clear responsibility and strict dependency direction: upper layers depend on lower layers, never the reverse. This design ensures governance rules are enforced consistently across all operations — validation before mutation, audit trail capture, no bypasses.

<details>
<summary>System Block — how ido4 fits in the ecosystem</summary>
<iframe src="/diagrams/00-system-block.html" width="100%" height="820" style="border: none; border-radius: 8px;" loading="lazy"></iframe>
</details>

<details>
<summary>Service Container — 9-layer dependency graph</summary>
<iframe src="/diagrams/08-service-container.html" width="100%" height="820" style="border: none; border-radius: 8px;" loading="lazy"></iframe>
</details>

<details>
<summary>Plugin Layer — skills, agents, and hooks</summary>
<iframe src="/diagrams/09-plugin-layer.html" width="100%" height="820" style="border: none; border-radius: 8px;" loading="lazy"></iframe>
</details>

## System Layers

```
+--------------------------------------------------------------+
|  Layer 3: Experience ([ido4dev](https://github.com/ido4-dev/ido4dev))                        |
|                                                               |
|  21 Skills         4 Agents          2 Governance Hooks       |
|  /standup          PM Agent,         PostToolUse:             |
|  /plan-wave        Spec Reviewer,    state transitions,       |
|  /plan-sprint      Code Analyzer,    container assignments    |
|  /plan-cycle       Tech Spec Writer                           |
|  /board            Persistent                                 |
|  /compliance       memory,                                    |
|  /retro-*          methodology                                |
|  /health           expert                                     |
|  /sandbox-*                                                   |
|  /decompose                                                   |
|  /spec-validate                                               |
|  /pilot-test                                                  |
+--------------------------------------------------------------+
|  Layer 2: MCP Server (packages/mcp -- @ido4/mcp)             |
|                                                               |
|  58 Tools (Hydro)  9 Resources       8 Prompts               |
|  56 Tools (Scrum)  project://        standup                  |
|  54 Tools (ShapeUp)methodology://    plan-container           |
|                    audit://          board                     |
|  Dynamic from      analytics://      compliance               |
|  profile:          compliance://     health                    |
|  - Transitions     coordination://   retro                    |
|  - Containers                        execute-task             |
|                    6 Aggregators                               |
|                    standup-data, board-data,                   |
|                    compliance-data, health-data,               |
|                    coordination-data, task-execution-data      |
+--------------------------------------------------------------+
|  Layer 1: Core Domain (packages/core -- @ido4/core)           |
|                                                               |
|  +--------------------------------------------------------+  |
|  | ServiceContainer (9-layer DI)                           |  |
|  +--------------------------------------------------------+  |
|  | Domain Services                                         |  |
|  |  TaskService . ContainerService . EpicService           |  |
|  |  DependencyService . ProjectService                     |  |
|  |  AuditService . AnalyticsService . AgentService         |  |
|  |  ComplianceService . WorkDistributionService            |  |
|  |  MergeReadinessService . SandboxService                 |  |
|  |  IngestionService                                       |  |
|  +--------------------------------------------------------+  |
|  | BRE Pipeline                                            |  |
|  |  TaskTransitionValidator . 34 ValidationSteps           |  |
|  |  ValidationStepRegistry . MethodologyConfig             |  |
|  +--------------------------------------------------------+  |
|  | Profile Engine                                          |  |
|  |  ProfileRegistry . ProfileConfigLoader                  |  |
|  |  3 Built-in Profiles (Hydro, Scrum, Shape Up)           |  |
|  +--------------------------------------------------------+  |
|  | Infrastructure                                          |  |
|  |  GraphQLClient (retry, pagination, rate limiting)       |  |
|  |  IssueRepository . ProjectRepository                    |  |
|  |  RepositoryRepository . EventBus                        |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
|  External: GitHub Projects V2 / Issues / Pull Requests        |
+--------------------------------------------------------------+
```

## Design Principles

### Interface-Based Dependency Injection

Every service depends on interfaces, never concrete classes. All interfaces are defined in `container/interfaces.ts`:

```typescript
interface ITaskService {
  startTask(issueNumber: number, actor: ActorIdentity, options?: TransitionOptions): Promise<TransitionResult>;
  validateTransition(issueNumber: number, transition: string, actor: ActorIdentity): Promise<ValidationResult>;
}
```

### ServiceContainer

The `ServiceContainer` creates all services in a 9-layer dependency order:

```
Layer 1: Config (project root, GitHub token)
Layer 2: Infrastructure (GraphQL client, repositories)
Layer 3: Domain validators (BRE pipeline)
Layer 4: Domain services (Task, Container, Dependency, Epic)
Layer 5: Audit + Sandbox (event bus subscription)
Layer 6: Project + Analytics + Agents
Layer 7: Compliance (reads audit + analytics)
Layer 8: Work Distribution (scoring engine)
Layer 9: Merge Readiness (6-check gate)
```

Each layer depends only on layers below it. No circular dependencies.

### Profile-Driven Generation

The MCP server generates tools, resources, and prompts dynamically from the active methodology profile:

```
Profile (hydro.ts / scrum.ts / shape-up.ts)
    |
    +--> Transition tools (start_task, approve_task, ship_task, ...)
    +--> Container tools (list_waves, list_sprints, list_cycles, ...)
    +--> BRE pipelines (which validation steps run for which transition)
    +--> Prompts (methodology-specific terminology and reasoning)
    +--> Compliance (lifecycle sequence and scoring weights)
```

Adding a new methodology requires only a new profile — zero engine code changes.

### Event Bus

Internal publish-subscribe decouples producers from consumers:

- **Producers**: TaskService (`task.transition`), WorkDistributionService (recommendations)
- **Consumers**: AuditService (persists everything), AnalyticsService (invalidates cache)

Events are fire-and-forget — producers don't wait for consumers.

### Tool Design Philosophy

MCP tools are **governed domain operations**, not GitHub API wrappers:

- Every write tool goes through the BRE (validation before mutation)
- Every write tool supports `dryRun` (validate without executing)
- Every write tool records an audit event
- Every tool response follows `{success, data, suggestions, warnings}`

## Package Boundaries

### @ido4/core

Zero dependencies on CLI frameworks, MCP SDK, or terminal formatting. Contains:
- All domain logic (services, validators, analyzers)
- Profile engine and built-in profiles
- Infrastructure adapters (GitHub GraphQL, file persistence)
- Configuration management
- Event bus and audit subsystem

**Can be used independently** for programmatic governance.

### @ido4/mcp

Depends on `@ido4/core` and `@modelcontextprotocol/sdk`. Contains:
- Dynamic tool registration from profile (Hydro: 58, Scrum: 56, Shape Up: 54)
- Resource providers (9 resources)
- Prompt definitions (8 prompts, methodology-specific)
- Aggregators (6 composite data fetchers for skills)
- STDIO transport setup

**Can be used with any MCP client**, not just Claude Code.

### ido4dev Plugin ([separate repo](https://github.com/ido4-dev/ido4dev))

Distributed via the [ido4-plugins marketplace](https://github.com/ido4-dev/ido4-plugins). The MCP server is auto-installed from npm via a SessionStart hook. Contains:
- 21 skill definitions (context intelligence, planning, retrospectives, onboarding, sandbox, decomposition)
- 4 agents (PM, spec-reviewer, code-analyzer, technical-spec-writer)
- 2 hooks (SessionStart: MCP server install, PostToolUse: governance signals)
- Plugin manifest

**Specific to Claude Code** — uses Claude Code's plugin system. Install: `/plugin install ido4dev@ido4-plugins`.

## Data Flow Example

A task transition flows through all layers:

```
User: "Start task #42"
  |
Claude Code -> calls start_task MCP tool
  |
@ido4/mcp -> validates input, creates actor identity
  |
@ido4/core TaskService.startTask()
  |
  1. Load task data from GitHub (ProjectRepository)
  2. Look up profile pipeline for "start" transition
  3. Run BRE pipeline (TaskTransitionValidator)
     -> 7-9 validation steps execute sequentially
     -> Result: pass/fail with per-step details
  4. If pass: update status on GitHub (ProjectRepository)
  5. Emit task.transition event (EventBus)
     -> AuditService persists to JSONL
     -> AnalyticsService invalidates cache
  6. Return result with suggestions
  |
@ido4/mcp -> formats response as {success, data, suggestions}
  |
Claude Code -> displays result to user
  |
PostToolUse hook -> checks for governance impact
```
