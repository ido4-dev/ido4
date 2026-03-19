# ido4 Next: The Development Governance Platform

## Vision, Architecture, and Roadmap for the MCP Transformation

---

**Status**: Strategic Vision Document
**Created**: March 5, 2026
**Purpose**: Define the transformation from ido4 CLI to ido4 Next — an MCP-native development governance platform that powers the next generation of AI-augmented consulting

---

## Part 1: The Vision

### What We're Building

ido4 Next is a **Development Governance Platform** — a system that enables small, senior-led teams to deliver enterprise-grade software by combining human judgment with AI agent execution under deterministic methodology enforcement.

The platform runs natively inside Claude Code (and any MCP-compatible AI coding environment) as an MCP server, providing real-time governance, compliance validation, and intelligent project orchestration.

### The Problem We Solve

The software industry is undergoing a fundamental shift. AI coding agents (Claude Code, Copilot, Devin, Cursor) can now execute development tasks autonomously. But execution without governance is chaos:

- **40% of AI-generated code contains security vulnerabilities**
- **Only 14% of organizations deploying AI agents have governance in place**
- **44% of project managers can't explain how AI recommendations are made**
- **No existing tool enforces development methodology programmatically inside the coding environment**

Traditional consulting firms sell headcount. A 10-person team costs $1.2-1.8M/year. Most of those people are doing execution work that AI agents can now handle. What AI agents *cannot* do is make strategic product decisions, design system architecture, or enforce methodology compliance.

### The Solution: Consultancy 2.0

A new model emerges: **2 senior humans (PM + Tech Architect) + AI agents + ido4 governance = the output of a 10-person team at a fraction of the cost.**

- The **PM** provides product vision, stakeholder management, and strategic decisions
- The **Tech Architect** provides system design, code quality oversight, and technical judgment
- **AI agents** provide execution capacity — coding, testing, documentation
- **ido4 Next** provides the **governance layer** — deterministic business rules that ensure methodology compliance, audit trails, and quality gates that no agent can bypass

This isn't a better project management tool. It's the **technology infrastructure that makes Consultancy 2.0 possible**.

### Who This Is For

**Primary**: Consulting firms and development agencies adopting AI-augmented delivery models — small senior teams that need to govern AI agent output at enterprise scale.

**Secondary**: Enterprise engineering teams deploying multiple AI coding agents who need methodology enforcement and compliance governance.

**Tertiary**: Individual senior developers using Claude Code who want structured project management integrated into their workflow.

---

## Part 2: From Today to Tomorrow

### What We Have Today (ido4 CLI)

The current ido4 CLI is a TypeScript command-line tool built with oclif that provides wave-based project management on top of GitHub Projects. It represents approximately 8 months of development and contains genuine, valuable intellectual property — but it also has significant gaps.

#### What Works Well (Preserve and Protect)

| Component | Value | Status |
|---|---|---|
| **Business Rule Engine (BRE)** | 20+ composable validation steps, 9 transition types, structured results with remediation. This is the core IP. | Complete |
| **Validation Pipeline Architecture** | Modular `ValidationStep` classes composed into per-transition pipelines. Easy to extend, test, and reason about. | Complete |
| **Input Sanitizer** | Comprehensive security: path traversal prevention, injection protection, format validation. Real security, not theater. | Complete |
| **Error Hierarchy** | `BusinessLogicError`, `ValidationError`, `SystemError` with context metadata and remediation steps. | Complete |
| **Dependency Analyzer** | Graph traversal, circular dependency detection, caching with TTL. Proven algorithm. | Complete |
| **Epic Detection** | Dual-condition detection using GitHub sub-issues API. Reliable and well-tested. | Complete |
| **Zod Config Validation** | Schema-validated project configuration with clear error messages. | Complete |
| **Base Patterns** | `BaseService`, `BaseRepository`, `BaseValidator` — clean, focused, consistent abstractions. | Complete |
| **Task Workflow Service** | All 8 workflow transitions (start, review, approve, block, unblock, return, refine, ready) implemented and calling GitHub API. | Complete |
| **Credential Management** | Multi-source token acquisition (env, gh CLI, OAuth), proper file permissions. | Complete |

#### What's Broken or Incomplete (Must Fix)

| Issue | Severity | Detail |
|---|---|---|
| **`wave:assign` crashes at runtime** | P0 | `GitHubWaveRepository.updateTaskWave()` throws "Method not yet implemented" |
| **Epic Integrity enforcement disabled** | P0 | `EpicValidator` is fully implemented but the call is commented out (TODO) in `wave-service.ts`. The system hardcodes `integrityStatus: 'maintained'`. A founding principle of ido4 is not being enforced. |
| **ApprovalRequirementValidation blocks everything** | P1 | Never checks for actual approval signals. All high-risk/ai-reviewed tasks fail validation unless `--force` is used. |
| **Wrong command suggestion** | P1 | `StatusTransitionValidation` maps "Ready for Dev" to `'prepare'` — the actual command is `task:ready` |
| **No GraphQL resilience** | P1 | Zero retry logic, zero rate limit awareness, zero circuit breaking. One transient 502 and the operation fails. |
| **No pagination** | P1 | `getProjectItems()` returns max 100 items. Enterprise projects silently lose data. |
| **Wave repository mostly stubs** | P2 | 5 of 7 methods throw or return placeholders |
| **Subtask validation always passes** | P2 | `getSubIssuesSummary()` always returns `null` — never detects subtasks |
| **Wave analytics hardcoded** | P2 | Velocity = `tasks/4`, completion = `sum+7 days`, integrity always "maintained" |
| **Constructor `any` typing** | P2 | Multiple services accept all dependencies as `: any`, defeating TypeScript strict mode |
| **5 `@ts-ignore` in BRE** | P2 | In `TaskTransitionValidator` constructor — violates project's own rules |
| **`new Function()` for evaluation** | P2 | Template intelligence engine evaluates YAML expressions via `new Function()` — code execution vector |
| **BRE engine rebuilds service graph** | P2 | `bre-intelligence-engine.ts` constructs a complete new service graph independently per suggestion call |
| **Return path validation duplicated 3x** | P3 | Hardcoded in TaskWorkflowService, BackwardTransitionValidation, and TaskReturnCommand |
| **N+1 GraphQL calls** | P3 | Epic detection calls API per item — 50 tasks = 50+ API calls |
| **5 of 10 domains have zero tests** | P3 | Waves, dependencies, intelligence, sandbox, users — all untested |

#### What's CLI-Specific (Will Be Dropped or Replaced)

| Component | Replacement in MCP |
|---|---|
| oclif command framework | MCP server request handlers |
| chalk terminal formatting | Structured data in tool responses |
| MessageManager + YAML templates | Direct structured responses |
| `base-command.ts` (1022-line monolith) | ServiceContainer with proper DI |
| Interactive readline prompts | Tool parameters |
| `--format json` flag | MCP always returns structured data |
| Self-documenting `--help` | MCP tool schemas + descriptions |
| Universal Intelligence display layer | Suggestions included in tool responses |
| Sandbox learning environment | Not applicable for MCP |

---

## Part 3: The Target Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ido4 Next Plugin for Claude Code                               │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MCP Server (@ido4/mcp)                                   │  │
│  │                                                           │  │
│  │  Tools (~22)              Resources           Prompts     │  │
│  │  ├─ task_*         (10)   ├─ project://       /standup    │  │
│  │  ├─ wave_*          (5)   ├─ wave://          /plan-wave  │  │
│  │  ├─ project_*       (3)   ├─ methodology://   /retro      │  │
│  │  ├─ dependency_*    (2)   └─ audit://         /board      │  │
│  │  └─ intelligence_*  (2)                       /compliance │  │
│  └──────────────┬─────────────────────────────────────────────┘  │
│                 │                                                │
│  ┌──────────────┴─────────────────────────────────────────────┐  │
│  │  Core Domain Layer (@ido4/core)                            │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────────────────────────┐    │  │
│  │  │ ServiceContainer                                   │    │  │
│  │  │  - Interface-based DI                              │    │  │
│  │  │  - Session-scoped caching                          │    │  │
│  │  │  - Single initialization                           │    │  │
│  │  └──────────────┘                                     │    │  │
│  │                                                            │  │
│  │  ┌───────────┐  ┌───────────┐  ┌────────────────────┐     │  │
│  │  │ Tasks     │  │ Waves     │  │ Infrastructure     │     │  │
│  │  │  Service  │  │  Service  │  │  GraphQL Client    │     │  │
│  │  │  BRE      │  │  Analytics│  │   + Retry          │     │  │
│  │  │  Workflow │  │  Validator│  │   + Rate Limiting  │     │  │
│  │  ├───────────┤  ├───────────┤  │   + Pagination     │     │  │
│  │  │ Epics     │  │ Deps      │  │  Repositories      │     │  │
│  │  │  Detector │  │  Analyzer │  │  Config Manager     │     │  │
│  │  │  Validator│  │  Validator│  │  Credential Mgr     │     │  │
│  │  │  Service  │  │  Service  │  │  Input Sanitizer    │     │  │
│  │  └───────────┘  └───────────┘  └────────────────────┘     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Experience Layer                                         │  │
│  │                                                           │  │
│  │  Skills            Hooks              Agent               │  │
│  │  /standup           PostToolUse:       project-manager     │  │
│  │  /plan-wave           git commit →      - persistent       │  │
│  │  /retro               update memory      memory           │  │
│  │  /compliance        PreToolUse:        - methodology       │  │
│  │  /board               git push →         expert           │  │
│  │                       validate task    - velocity          │  │
│  │                     Stop:                tracking          │  │
│  │                       summarize                            │  │
│  │                       session                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Distribution: npm (@ido4/core, @ido4/mcp) + Plugin Marketplace │
└─────────────────────────────────────────────────────────────────┘
```

### Package Structure

**`@ido4/core`** — The domain layer, zero CLI dependencies

```
@ido4/core/
├── domains/
│   ├── tasks/
│   │   ├── interfaces/          # ITaskService, ITaskWorkflowService
│   │   ├── task-service.ts
│   │   ├── task-workflow-service.ts
│   │   ├── task-completion-service.ts
│   │   ├── task-transition-validator.ts
│   │   ├── validation-steps/    # All 20+ validation step classes
│   │   └── types.ts
│   ├── waves/
│   │   ├── interfaces/
│   │   ├── wave-service.ts
│   │   ├── wave-analytics-service.ts
│   │   ├── wave-completion-service.ts
│   │   └── types.ts
│   ├── epics/
│   │   ├── interfaces/
│   │   ├── epic-service.ts
│   │   ├── epic-detector.ts
│   │   ├── epic-validator.ts
│   │   └── types.ts
│   ├── dependencies/
│   │   ├── interfaces/
│   │   ├── dependency-analyzer.ts
│   │   ├── dependency-validator.ts
│   │   ├── dependency-service.ts
│   │   └── types.ts
│   └── projects/
│       ├── interfaces/
│       ├── project-init-service.ts
│       ├── project-status-service.ts
│       └── types.ts
├── infrastructure/
│   ├── github/
│   │   ├── graphql-client.ts       # WITH retry, rate limiting, pagination
│   │   ├── repositories/
│   │   │   ├── issue-repository.ts
│   │   │   ├── project-repository.ts
│   │   │   ├── repository-repository.ts
│   │   │   └── epic-repository.ts
│   │   └── queries/                # All GraphQL queries extracted, deduplicated
│   ├── config/
│   │   ├── project-config.ts       # With directory traversal lookup
│   │   ├── workflow-config.ts
│   │   └── git-workflow-config.ts
│   └── security/
│       ├── input-sanitizer.ts
│       └── credential-manager.ts   # Unified token storage location
├── container/
│   ├── service-container.ts        # Central DI, session-scoped caching
│   └── interfaces.ts               # All service interfaces
├── shared/
│   ├── base-service.ts
│   ├── base-repository.ts
│   ├── base-validator.ts
│   └── errors/                     # Structured error types
└── index.ts                        # Public API
```

**`@ido4/mcp`** — The MCP server

```
@ido4/mcp/
├── server.ts                       # MCP server setup (STDIO transport)
├── tools/
│   ├── task-tools.ts               # 10 task tools
│   ├── wave-tools.ts               # 5 wave tools
│   ├── project-tools.ts            # 3 project tools
│   ├── dependency-tools.ts         # 2 dependency tools
│   └── intelligence-tools.ts       # 2 intelligence tools
├── resources/
│   ├── project-resource.ts         # project://config, project://status
│   ├── wave-resource.ts            # wave://current, wave://{name}
│   ├── methodology-resource.ts     # methodology://principles, methodology://transitions
│   └── audit-resource.ts           # audit://trail, audit://compliance
├── prompts/
│   ├── standup.ts                  # /ido4:standup
│   ├── plan-wave.ts                # /ido4:plan-wave
│   ├── board.ts                    # /ido4:board
│   ├── retro.ts                    # /ido4:retro
│   └── compliance.ts              # /ido4:compliance
└── index.ts
```

**`ido4-claude-plugin/`** — The Claude Code plugin bundle

```
ido4-claude-plugin/
├── .claude-plugin/plugin.json
├── .mcp.json                       # Points to @ido4/mcp
├── skills/
│   ├── standup/SKILL.md
│   ├── plan-wave/SKILL.md
│   ├── retro/SKILL.md
│   ├── compliance/SKILL.md
│   └── board/SKILL.md
├── agents/
│   └── project-manager/AGENT.md    # Persistent memory, methodology expert
├── hooks/hooks.json                # Git hooks, session hooks
└── settings.json                   # Default agent activation
```

### MCP Tool Design

**22 tools following the list → get → validate → execute pattern:**

#### Task Tools (10)

| Tool | Input | Output | Side Effects |
|---|---|---|---|
| `list_tasks` | `{status?, wave?, epic?, assignee?, hasDeps?}` | Task list with metadata | None |
| `get_task` | `{issue, fields?}` | Full task detail | None |
| `validate_task_transition` | `{issue, transition}` | BRE validation result with per-step details | None |
| `validate_all_transitions` | `{issue}` | All 9 transitions validated | None |
| `start_task` | `{issue, assignee?, dryRun?}` | Transition result + suggestions + git context | Status update, comment |
| `review_task` | `{issue, dryRun?}` | Result + PR status + suggestions | Status update, comment |
| `approve_task` | `{issue, message?, dryRun?}` | Result + cascade analysis | Status update, close issue, comment |
| `block_task` | `{issue, reason, dryRun?}` | Result + blocking category | Status update, comment |
| `unblock_task` | `{issue, dryRun?}` | Result + blocking duration | Status update, comment |
| `return_task` | `{issue, targetStatus, reason, dryRun?}` | Result + return analysis | Status update, comment |

#### Wave Tools (5)

| Tool | Input | Output | Side Effects |
|---|---|---|---|
| `list_waves` | `{includeMetrics?}` | All waves with task counts, completion %, status | None |
| `get_wave_status` | `{wave}` | Detailed analytics: velocity, bottlenecks, timeline | None |
| `create_wave` | `{name, description?, dryRun?}` | Wave creation result | Creates wave label |
| `assign_task_to_wave` | `{issue, wave, dryRun?}` | Assignment result + Epic Integrity validation | Updates wave field |
| `validate_wave_completion` | `{wave}` | Completeness check: tasks, epics, branch status | None |

#### Project Tools (3)

| Tool | Input | Output | Side Effects |
|---|---|---|---|
| `get_project_status` | `{includeEpics?}` | Dashboard: task counts, wave roadmap, epic progress | None |
| `analyze_dependencies` | `{issue?, wave?}` | Full dependency graph, circular detection, blockers | None |
| `get_next_actions` | `{context?}` | Intelligent suggestions based on current project state | None |

#### Intelligence Tool (1)

| Tool | Input | Output | Side Effects |
|---|---|---|---|
| `check_wave_readiness` | `{wave}` | External dependency check, readiness assessment | None |

### MCP Resources

Resources provide persistent context that Claude Code can reference without tool calls:

| Resource URI | Content | Update Frequency |
|---|---|---|
| `project://config` | Project configuration, field IDs, status options | Session start |
| `project://status` | Live dashboard: task counts, active wave, blockers | On request |
| `wave://current` | Active wave details, progress, remaining work | On request |
| `wave://{name}` | Specific wave details and analytics | On request |
| `methodology://principles` | The 5 unbreakable principles, explained | Static |
| `methodology://transitions` | Valid state transition matrix | Static |
| `audit://recent` | Recent state transitions with timestamps | On request |

### Structured Tool Responses

Every tool returns a consistent shape:

```typescript
interface ToolResponse<T> {
  success: boolean;
  data: T;
  suggestions: Suggestion[];        // What to do next
  warnings: Warning[];              // Non-blocking concerns
  validationResult?: ValidationResult;  // BRE output (for write tools)
  auditEntry?: AuditEntry;          // What was changed (for write tools)
}

interface Suggestion {
  action: string;                   // "start_task" | "review_task" | ...
  description: string;             // Why this is suggested
  parameters: Record<string, any>;  // Pre-filled parameters
  priority: 'high' | 'medium' | 'low';
}
```

This shape lets Claude Code reason about next steps without a separate intelligence system.

---

## Part 4: What's New (Beyond the CLI)

### Code Quality Gates in the BRE

The current BRE validates methodology compliance. For enterprise governance, it must also validate code quality. New validation steps:

| Validation Step | What It Checks | When |
|---|---|---|
| `TestCoverageValidation` | Minimum test coverage threshold met | review, approve |
| `SecurityScanValidation` | No critical/high security findings | review, approve |
| `PRReviewValidation` | Required number of approving reviews | approve |
| `BranchProtectionValidation` | Branch rules satisfied | review |
| `LintingValidation` | No linting errors in changed files | review |

These are **configurable** — each project defines its quality gates:

```json
// .ido4/quality-gates.json
{
  "review": {
    "requirePR": true,
    "minTestCoverage": 80,
    "securityScan": "warn",
    "linting": "block"
  },
  "approve": {
    "minReviewApprovals": 1,
    "securityScan": "block",
    "allChecksPass": true
  }
}
```

### Audit Trail and Compliance

Every state transition creates an audit entry:

```typescript
interface AuditEntry {
  timestamp: string;
  transition: string;           // "start" | "review" | "approve" | ...
  issue: number;
  fromStatus: string;
  toStatus: string;
  actor: string;                // "ai-agent" | "human:username"
  validationResult: {
    stepsRun: number;
    stepsPassed: number;
    stepsFailed: number;
    stepsWarned: number;
    details: ValidationStepResult[];
  };
  metadata: {
    wave: string;
    epic?: string;
    prNumber?: number;
    dryRun: boolean;
  };
}
```

The `audit://recent` MCP resource exposes this trail. For enterprise clients, this provides the compliance documentation they need: every decision auditable, every rule enforcement traceable.

### Configurable Methodology

Wave-based development is the default, but the BRE pipeline is composable. The system should support methodology profiles:

```json
// .ido4/methodology.json
{
  "name": "wave-based",
  "transitions": {
    "start": {
      "fromStatuses": ["Ready for Dev"],
      "validationSteps": [
        "StatusTransition",
        "Dependency",
        "WaveAssignment",
        "AISuitability",
        "RiskLevel",
        "EpicIntegrity",
        "TestCoverage"
      ]
    }
  },
  "principles": {
    "epicIntegrity": true,
    "activeWaveSingularity": true,
    "dependencyCoherence": true
  }
}
```

This allows enterprises to adopt ido4 with their existing methodology (Scrum, Kanban, SAFe) while still getting deterministic enforcement.

### Real Velocity and Analytics

Replace hardcoded values with real historical tracking:

- **Cycle time**: Actual time from "In Progress" to "Done" per task
- **Lead time**: Time from "Backlog" to "Done"
- **Throughput**: Tasks completed per wave
- **Wave velocity**: Story points delivered per wave (when effort field is used)
- **Blocking time**: Actual duration tasks spend in "Blocked" status
- **Epic delivery rate**: Percentage of epic tasks completed per wave

Stored in `.ido4/analytics.json` and updated on each state transition. Exposed via `wave://analytics` MCP resource.

### Multi-Project Support

Enterprise teams manage multiple projects. The MCP server should handle project switching:

```
list_projects → returns all configured projects
switch_project({projectId}) → changes active context
get_project_status → shows current project
```

Project configs discovered by walking directory tree for `.ido4/project-info.json` files.

### The Project Manager Agent

A Claude Code custom agent with persistent memory:

```yaml
# .claude/agents/project-manager/AGENT.md
---
name: ido4-project-manager
description: AI Project Manager with wave-based development governance expertise
memory: project
tools: mcp__ido4__*, Read, Grep, Glob
model: sonnet
---

You are the ido4 Project Manager — an expert in wave-based development governance.

## Your Responsibilities
- Maintain real-time awareness of project state via MCP tools
- Proactively suggest next actions based on wave goals and dependencies
- Enforce the methodology principles (you cannot override BRE — it's deterministic)
- Track team velocity and patterns in your memory
- Provide morning standups, wave retrospectives, and compliance reports

## Your Memory
Maintain in MEMORY.md:
- Current active wave and its progress
- Recently completed tasks and their outcomes
- Blocked items and resolution status
- Wave velocity metrics (update after each wave completion)
- Key architectural decisions from this project
- Recurring patterns and lessons learned

## What You Cannot Do
- Override BRE validation (it's deterministic — you report results, you don't bypass them)
- Make financial or contractual decisions
- Access systems outside the MCP tools available to you
- Skip human review checkpoints for ai-reviewed or human-only tasks

## How You Interact
- When asked "what should I work on?", query project state and suggest based on priorities
- When a task transition fails validation, explain WHY in plain language
- When a wave is nearing completion, proactively flag remaining work
- When you detect patterns (tasks always blocking, epics dragging), surface insights
```

---

## Part 5: The Roadmap

### Phase 0: Foundation Repair (Weeks 1-2)

Fix what's broken in the current codebase before extracting it.

**Must-fix bugs:**
- [ ] Implement `GitHubWaveRepository.updateTaskWave()` — make wave assignment actually work
- [ ] Un-TODO Epic Integrity enforcement in `wave-service.ts` — connect the EpicValidator
- [ ] Fix `ApprovalRequirementValidation` — implement real approval checking (PR reviews, approval comments)
- [ ] Fix `StatusTransitionValidation` command mapping — `'prepare'` → `'ready'`
- [ ] Fix `getStatusKey()` silent fallback to BACKLOG

**Must-fix architecture:**
- [ ] Remove all `@ts-ignore` (5 in TaskTransitionValidator)
- [ ] Replace constructor `any` typing with proper interfaces throughout services
- [ ] Remove `new Function()` from template intelligence engine — replace with safe evaluator
- [ ] Consolidate return path validation (currently duplicated in 3 places)
- [ ] Remove dead code: empty files, .backup file, disabled tests, dead domain

**Must-fix infrastructure:**
- [ ] Add retry with exponential backoff to GraphQL client
- [ ] Add rate limit header tracking and preemptive throttling
- [ ] Add pagination to `getProjectItems()` (cursor-based)
- [ ] Fix N+1 GraphQL calls in epic detection (batch query)
- [ ] Consolidate token storage to single location (`~/.config/ido4/`)
- [ ] Deduplicate GraphQL queries across query files

### Phase 1: Core Extraction (Weeks 3-5)

Extract the domain layer into `@ido4/core` with zero CLI dependencies.

- [ ] Define interfaces for all services (`ITaskService`, `IWaveService`, `IEpicService`, etc.)
- [ ] Create `ServiceContainer` with session-scoped caching and interface-based DI
- [ ] Extract domain services, removing any oclif/chalk/readline dependencies
- [ ] Extract repositories with proper interface contracts
- [ ] Extract config system with directory traversal lookup (walk up tree)
- [ ] Create proper TypeScript types for all service inputs/outputs (eliminate `any`)
- [ ] Move intelligence from separate system into tool response suggestions
- [ ] Write comprehensive tests for all domains (especially waves, dependencies, intelligence)
- [ ] Verify: `@ido4/core` has zero dependencies on oclif, chalk, or any CLI library
- [ ] Publish `@ido4/core` to npm

### Phase 2: MCP Server (Weeks 5-8)

Build `@ido4/mcp` on top of `@ido4/core`.

- [ ] Set up MCP server with STDIO transport using `@modelcontextprotocol/sdk`
- [ ] Implement read-only tools first: `list_tasks`, `get_task`, `validate_task_transition`, `validate_all_transitions`, `get_project_status`, `list_waves`, `get_wave_status`, `analyze_dependencies`
- [ ] Test with Claude Code locally — verify tool discovery, input validation, structured responses
- [ ] Implement write tools: `start_task`, `review_task`, `approve_task`, `block_task`, `unblock_task`, `return_task`, `create_wave`, `assign_task_to_wave`, `validate_wave_completion`
- [ ] Implement `get_next_actions` intelligence tool
- [ ] Implement MCP resources: `project://`, `wave://`, `methodology://`
- [ ] Implement MCP prompts: `/ido4:standup`, `/ido4:board`
- [ ] Implement consistent structured responses (`{success, data, suggestions, warnings}`)
- [ ] Add `dryRun` support to all write tools
- [ ] Error mapping: domain errors → MCP JSON-RPC errors with remediation
- [ ] Publish `@ido4/mcp` to npm

### Phase 3: Experience Layer (Weeks 8-10)

Build the Claude Code plugin with skills, hooks, and agent.

- [ ] Create plugin structure (`ido4-claude-plugin/`)
- [ ] Build skills: `/standup`, `/plan-wave`, `/retro`, `/compliance`, `/board`
- [ ] Build project-manager agent with persistent memory
- [ ] Build hooks: PostToolUse (git commit → update memory), PreToolUse (git push → validate task), Stop (summarize session)
- [ ] Configure permission pre-approvals for MCP tools
- [ ] Test end-to-end: user conversation → skill invocation → MCP tool calls → GitHub API
- [ ] Test agent memory persistence across sessions
- [ ] Package and publish plugin

### Phase 4: Enterprise Features (Weeks 10-14)

Add the capabilities that make this enterprise-ready.

- [ ] Implement code quality gates: `TestCoverageValidation`, `SecurityScanValidation`, `PRReviewValidation`
- [ ] Implement configurable quality gates (`.ido4/quality-gates.json`)
- [ ] Implement audit trail with `AuditEntry` on every state transition
- [ ] Implement `audit://recent` and `audit://compliance` MCP resources
- [ ] Implement real velocity tracking (cycle time, lead time, throughput)
- [ ] Store analytics in `.ido4/analytics.json`, expose via MCP resource
- [ ] Implement configurable methodology (`.ido4/methodology.json`)
- [ ] Implement multi-project support (project discovery, switching)
- [ ] Implement real assignee management (GitHub assignee API, not just comments)
- [ ] Implement real subtask validation (use GitHub sub-issues API)

### Phase 5: Validation and Launch (Weeks 14-16)

- [ ] Run pilot engagement with real enterprise project
- [ ] Gather feedback, iterate on tool design and suggestions
- [ ] Write documentation: methodology guide, plugin installation, MCP server configuration
- [ ] Performance testing: session startup time, tool response time under load
- [ ] Security audit: input validation, token handling, GraphQL injection prevention
- [ ] Publish to Claude Code plugin marketplace
- [ ] Open-source `@ido4/core` and `@ido4/mcp` on GitHub

---

## Part 6: Success Metrics

### Technical Metrics

| Metric | Target |
|---|---|
| MCP server startup time | < 2 seconds |
| Tool response time (read) | < 1 second |
| Tool response time (write) | < 3 seconds |
| BRE validation time | < 500ms |
| Test coverage (@ido4/core) | > 90% |
| Zero `any` types in core | 100% |
| Zero `@ts-ignore` | 100% |

### Business Metrics (Pilot Engagement)

| Metric | Target |
|---|---|
| Tasks managed per engagement | 50+ |
| Methodology compliance rate | > 95% (tasks following proper workflow) |
| BRE validation override rate | < 5% (uses of `--force` or `skipValidation`) |
| Time to first task transition | < 5 minutes after setup |
| Agent memory usefulness | PM reads/references agent memory in > 50% of sessions |

### Market Metrics (6 Months Post-Launch)

| Metric | Target |
|---|---|
| npm weekly downloads (@ido4/mcp) | 500+ |
| Claude Code plugin installs | 200+ |
| GitHub stars | 500+ |
| Enterprise pilot engagements | 2-3 |
| Community contributions | 10+ PRs |

---

## Part 7: What This Enables

When all phases are complete, the system enables this workflow:

### Morning

```
Developer: "Good morning, what's the status?"

Claude (via project-manager agent + MCP):
"Wave-003 'Authentication' is at 70% — 7 of 10 tasks done.
 - Task #72 has been in review for 3 days (needs attention)
 - Task #67 was unblocked yesterday when #65 completed
 - Task #73 is ready but depends on #67

 I recommend: review #72 first, then start #67.
 Historical note: similar auth tasks in wave-002 averaged 2.3 days cycle time."
```

### During Work

```
Developer: "I'm done with the OAuth callback. PR is up."

Claude (calls validate_task_transition, detects PR):
"BRE validation for #67 → In Review:
  ✓ Status transition valid
  ✓ All 3 dependencies satisfied
  ✓ PR #89 found and linked
  ✓ Test coverage: 87% (threshold: 80%) ✓
  ✓ Security scan: 0 critical, 0 high ✓
  ✓ Acceptance criteria present

Moving to In Review... Done.

This unblocked #73 (Session persistence). Want me to start it?"
```

### Compliance Check

```
PM: "/compliance"

Claude (queries audit trail + project state):
"Wave-003 Compliance Report:

  Methodology Compliance: 94%
  - 16 of 17 transitions followed proper workflow
  - 1 fast-track used (task #64, approved by PM)

  Code Quality Gates:
  - All reviewed tasks met 80% coverage threshold
  - 0 security findings in production code
  - Average PR review time: 1.2 days

  Audit Trail: 47 entries, all validated by BRE
  Epic Integrity: Maintained across all 3 epics

  Ready for client compliance review."
```

### Enterprise Client Delivery

```
PM to Client: "Here's our wave-003 delivery report."

[Report generated from audit://compliance resource]
- Every task transition validated by deterministic business rules
- Every code change passed automated quality gates
- Full audit trail with timestamps, actors, and validation results
- Methodology compliance: 94% (1 approved exception)
- Velocity: 3.2 tasks/week (up from 2.8 in wave-002)
```

---

## Appendix: Key Decisions

### Why MCP Server (not just Skills/CLAUDE.md)

Skills and CLAUDE.md rely on LLM reasoning to follow rules. LLMs skip steps, hallucinate compliance, and don't provide deterministic guarantees. The BRE must run as real code — not as instructions to an LLM. MCP tools execute real TypeScript logic and return real validation results.

### Why STDIO Transport (not HTTP)

STDIO is the recommended transport for local development tools in Claude Code. The server runs as a subprocess — no network overhead, no port management, no authentication complexity. For enterprise/multi-user deployment, HTTP transport can be added later without changing the domain layer.

### Why Keep the CLI (Optional)

Some users and CI/CD pipelines need the CLI. By extracting `@ido4/core`, both the CLI and MCP server consume the same domain logic. Zero duplication. The CLI becomes a thin oclif wrapper over `@ido4/core`, maintained as a secondary interface.

### Why Open Source the Core

The core domain logic and MCP server should be open source. This provides: community distribution, credibility, ecosystem adoption, and contributions. The competitive moat is not the code — it's the methodology, the consulting model, and the institutional knowledge built through agent memory over time. Open-sourcing the platform accelerates adoption without threatening the business model.

### Why "Development Governance" (not "AI Project Management")

"AI Project Management" positions ido4 against Linear, Jira, and Notion — tools with massive budgets and established markets. "Development Governance" is a new category with no incumbent. It positions ido4 as the answer to: "How do we ensure our AI agents follow our development methodology?" This is a question that gets louder every quarter as AI agent adoption accelerates.

---

*This document is the north star for the ido4 Next transformation. Every decision, every PR, every architecture choice should be evaluated against the vision described here.*
