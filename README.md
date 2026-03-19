<p align="center">
  <h1 align="center">ido4</h1>
  <p align="center"><strong>Development Governance for AI-Augmented Teams</strong></p>
  <p align="center">Deterministic methodology enforcement that runs inside AI coding environments</p>
</p>

<p align="center">
  <a href="#see-it-in-action">See It In Action</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="docs/README.md">Documentation</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/MCP-compatible-7C3AED" alt="MCP Compatible">
  <img src="https://img.shields.io/badge/tools-58-2563EB" alt="58 MCP Tools">
  <img src="https://img.shields.io/badge/tests-1768-16A34A" alt="1768 Tests">
  <img src="https://img.shields.io/npm/l/@ido4/core" alt="MIT License">
</p>

---

AI agents can write code. Ship features. Fix bugs. But who ensures they follow your development methodology?

**ido4** is an [MCP](https://modelcontextprotocol.io/) server that provides deterministic governance for AI-augmented development teams. It runs inside Claude Code (and any MCP-compatible AI environment), enforcing business rules that no agent can bypass — with full audit trails, compliance scoring, and multi-agent coordination.

Every task transition passes through **32 validation steps** executed as real TypeScript code. Not LLM instructions that can be hallucinated. Not suggestions that can be ignored. Deterministic rules enforced by the AI's own tool environment.

```
Developer: "Start task #268"

ido4 BRE: BLOCKED — 3 validation failures:
  ✗ StatusTransition    — Blocked → In Progress is not a valid path
  ✗ DependencyValidation — dependency #267 not completed (In Progress)
  ✗ StartFromReadyForDev — task must be in Ready for Dev status

  Allowed action: unblock (the only valid path forward)
```

## The Problem

AI coding agents are everywhere — Claude Code, Copilot, Cursor, Devin — but **governance hasn't kept up**:

- **No methodology enforcement.** AI agents execute tasks in whatever order they choose. Dependencies get violated. Epics ship incomplete. Quality gates get skipped.
- **No audit trail.** When 3 AI agents make 40 transitions in a day, nobody knows who did what, when, or whether the rules were followed.
- **No coordination.** Multiple agents on the same codebase with no awareness of each other — duplicate work, conflicting changes, cascade failures.

Traditional project management tools (Linear, Jira, Notion) track work. They don't **govern** it. ido4 fills the gap between execution and accountability.

## See It In Action

The sandbox creates a real GitHub project with 20 tasks, 5 epics, and 5 embedded governance violations — then discovers them live:

```
$ claude --plugin-dir ./packages/plugin
> /ido4:sandbox

Creating sandbox on your-org/your-repo...
✓ 20 tasks, 5 epics, 4 waves, 1 PR, 28 audit events, 2 agents

══════════════════════════════════════════════
  LIVE GOVERNANCE ANALYSIS
══════════════════════════════════════════════

CASCADE BLOCKER: #267 → #268 → #269
  ETL transformations (In Progress) blocks Data validation,
  which blocks API rate limiting. 3 tasks — 30% of the active
  wave — chained to one root cause.

FALSE STATUS: #270 "In Review" with no pull request
  Moved to review 5 days ago but implementation isn't finished.
  Status should reflect reality.

REVIEW BOTTLENECK: #272 PR open 4 days, 0 reviews
  Code is ready but sitting idle. Blocks the Auth epic.

EPIC INTEGRITY: Auth epic split across waves
  Token service, OAuth, Session management in wave-002 — but
  RBAC in wave-003. Security domain shipping incomplete.

══════════════════════════════════════════════
  INTELLIGENT WORK DISTRIBUTION
══════════════════════════════════════════════

agent-alpha (backend/data — locked on #267):
  → #273 Data export     score:50  cascade:15 epic:7 cap:13 fresh:15
  → #274 Batch proc      score:17  cascade:0  epic:7 cap:10 fresh:0

agent-beta (frontend/auth — available):
  → #273 Data export     score:47  cascade:15 epic:7 cap:10 fresh:15
  → #271 OAuth           score:13  cascade:0  epic:0 cap:13 fresh:0

Every score is deterministic — computed from dependency graphs,
epic completion ratios, agent capabilities, and audit timestamps.

══════════════════════════════════════════════
  MERGE READINESS GATE (6 checks)
══════════════════════════════════════════════

check_merge_readiness(#272 Session management):
  ✓ Workflow Compliance   — full audit trail (start → review)
  ✗ PR Review             — 0 approvals, 1 required
  ✓ Dependency Completion — all upstream satisfied
  ⚠ Epic Integrity        — Auth epic split across waves
  ✓ Security Gates        — no vulnerability alerts
  ✓ Compliance Threshold  — score 92 (A)
  Verdict: NOT READY TO MERGE

══════════════════════════════════════════════
  BRE ENFORCEMENT
══════════════════════════════════════════════

validate_all_transitions(#268 — Blocked):
  start   → BLOCKED (dependency #267 not complete)
  review  → BLOCKED (wrong status, no PR)
  approve → BLOCKED (can't jump to Done)
  unblock → ALLOWED ← the only valid path
```

These aren't hypothetical checks. These are the same governance rules that run on every real task, every real transition, every real project.

## Quick Start

### As a Claude Code Plugin

```bash
# Clone and build
git clone https://github.com/ido4-dev/ido4.git
cd ido4-MCP
npm install && npm run build

# Set your GitHub token
export GITHUB_TOKEN=$(gh auth token)

# Launch Claude Code with ido4 governance
claude --plugin-dir ./packages/plugin

# Try the interactive sandbox demo
> /ido4:sandbox
```

### As a Standalone MCP Server

```bash
npm install @ido4/mcp
```

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "ido4": {
      "command": "npx",
      "args": ["@ido4/mcp"],
      "env": {
        "GITHUB_TOKEN": "your-token"
      }
    }
  }
}
```

### Initialize a Project

```bash
# Inside Claude Code with the plugin loaded:
> Initialize ido4 governance for my-org/my-project
# The AI calls init_project, creates the GitHub Project V2,
# sets up custom fields, and writes .ido4/ config
```

## Features

### Deterministic Business Rule Engine

Every task transition runs through a composable validation pipeline — 32 built-in steps across 5 categories, configurable per methodology:

| Category | What It Validates |
|---|---|
| **Workflow** | Status transitions, state machine paths, required fields |
| **Dependencies** | Completion checks, circular detection, cascade analysis |
| **Governance** | Wave assignment, epic integrity, active wave singularity |
| **Quality Gates** | PR reviews, test coverage, security scans, task locks |
| **Risk** | AI suitability assessment, risk level enforcement |

The BRE is **configurable** — define your own methodology in `.ido4/methodology.json`:

```json
{
  "transitions": {
    "start": {
      "steps": ["StatusTransition", "Dependency", "WaveAssignment", "EpicIntegrity"]
    },
    "approve": {
      "steps": ["StatusTransition", "PRReview:minApprovals=2", "SecurityScan", "TestCoverage:threshold=80"]
    }
  }
}
```

### Multi-Agent Coordination

Built for teams deploying multiple AI agents on the same codebase:

- **Task locking** — Agents acquire exclusive locks. No duplicate effort.
- **Work distribution** — 4-dimension scoring (cascade value, epic momentum, capability match, dependency freshness) recommends the highest-leverage task for each agent.
- **Coordination state** — Every agent sees who's working on what, recent events, and handoff opportunities.
- **Complete-and-handoff** — Atomic operation: approve work, release lock, identify unblocked tasks, recommend next work.

### Audit Trail & Compliance

Every governance action creates an immutable audit entry:

- **Event-sourced** — Append-only JSONL with in-memory ring buffer for fast queries
- **Compliance scoring** — Deterministic 0-100 score across 5 weighted categories: BRE pass rate (40%), quality gates (20%), process adherence (20%), epic integrity (10%), flow efficiency (10%)
- **Real analytics** — Cycle time, lead time, throughput, blocking time — computed from actual events, not estimates
- **Queryable** — Filter by time range, actor, transition type, issue number, session

### 18 Governance Skills

Skills are intelligent workflows that compose multiple tools into governance insights. Core skills work across all methodologies; methodology-specific variants speak your methodology's language:

| Skill | What It Does |
|---|---|
| `/ido4:standup` | Morning briefing — risks, leverage points, highest-impact action |
| `/ido4:board` | Flow intelligence — blockers, cascade risks, false statuses, epic cohesion |
| `/ido4:compliance` | Three-part assessment: quantitative score + structural audit + synthesis |
| `/ido4:plan-wave` | Principle-aware wave composition — valid-by-construction plans |
| `/ido4:retro-wave` | Data-backed wave retrospective (Hydro). Also: `/retro-sprint` (Scrum), `/retro-cycle` (Shape Up) |
| `/ido4:health` | 5-second governance verdict: RED / YELLOW / GREEN |
| `/ido4:sandbox` | Interactive demo — routes to methodology-specific sandbox (Hydro, Scrum, Shape Up) |
| `/ido4:decompose` | Decompose a strategic spec into a technical spec via codebase analysis |
| `/ido4:pilot-test` | End-to-end verification of the entire governance stack |

### CI/CD Quality Gate

A 6-check merge readiness gate that catches what CI alone can't:

1. **Workflow Compliance** — Did the task follow the full governance workflow?
2. **PR Review** — Does the PR have the required number of approving reviews?
3. **Dependency Completion** — Are all upstream dependencies satisfied?
4. **Epic Integrity** — Is the epic cohesive within its wave?
5. **Security Gates** — Are there vulnerability alerts?
6. **Compliance Threshold** — Does the project meet its compliance score minimum?

Emergency overrides are available — but they're audited and impact the compliance score. Governance doesn't prevent action; it ensures accountability.

## The 5 Governance Principles

ido4's governance model is built on 5 principles that cannot be bypassed:

| # | Principle | What It Means |
|---|---|---|
| 1 | **Epic Integrity** | All tasks in an epic MUST be in the same wave. No partial feature delivery. |
| 2 | **Active Wave Singularity** | Only one wave can be active at a time. Focus, not scatter. |
| 3 | **Dependency Coherence** | A task's wave must be >= its dependencies' waves. No forward dependencies. |
| 4 | **Self-Contained Execution** | Each wave contains everything needed for its own completion. |
| 5 | **Atomic Completion** | A wave is complete only when ALL its tasks reach Done. |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Claude Code Plugin                                          │
│  18 Skills · 4 Agents · 2 Governance Hooks                   │
├──────────────────────────────────────────────────────────────┤
│  MCP Server (@ido4/mcp)                                      │
│  58 Tools · 9 Resources · 7 Prompts · STDIO Transport        │
├──────────────────────────────────────────────────────────────┤
│  Core Domain Layer (@ido4/core)                               │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ Tasks    │ │Containers│ │ Agents     │ │ Compliance   │  │
│  │ BRE (32  │ │Integrity │ │ Work       │ │ Analytics    │  │
│  │  steps)  │ │ Deps     │ │ Distrib.   │ │ Audit Trail  │  │
│  └──────────┘ └──────────┘ │ Merge Gate │ └──────────────┘  │
│                             └────────────┘                    │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Infrastructure: GraphQL (retry · pagination · rate       ││
│  │ limiting) · GitHub Repositories · Config · Sandbox       ││
│  └──────────────────────────────────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│  GitHub Projects V2 · Issues · Pull Requests                  │
└──────────────────────────────────────────────────────────────┘
```

### Monorepo Structure

| Package | npm | Description |
|---|---|---|
| [`@ido4/core`](packages/core/) | `npm i @ido4/core` | Domain logic — BRE (32 steps), profile-driven services, repositories. Zero CLI dependencies. |
| [`@ido4/mcp`](packages/mcp/) | `npm i @ido4/mcp` | MCP server — STDIO transport, 58 tools (Hydro), 9 resources, 7 prompts. |
| [`plugin`](packages/plugin/) | — | Claude Code plugin — 18 skills, 4 agents, governance hooks. |

### 51 MCP Tools

<details>
<summary><strong>Task Governance (18 tools)</strong></summary>

`start_task` · `review_task` · `approve_task` · `block_task` · `unblock_task` · `return_task` · `refine_task` · `ready_task` · `get_task` · `get_task_field` · `list_tasks` · `create_task` · `validate_transition` · `validate_all_transitions` · `find_task_pr` · `get_pr_reviews` · `add_task_comment` · `get_sub_issues`
</details>

<details>
<summary><strong>Wave & Epic Management (9 tools)</strong></summary>

`list_waves` · `get_wave_status` · `create_wave` · `assign_task_to_wave` · `validate_wave_completion` · `search_epics` · `get_epic_tasks` · `get_epic_timeline` · `validate_epic_integrity`
</details>

<details>
<summary><strong>Multi-Agent Coordination (7 tools)</strong></summary>

`register_agent` · `list_agents` · `lock_task` · `release_task` · `get_next_task` · `complete_and_handoff` · `get_coordination_state`
</details>

<details>
<summary><strong>Audit, Analytics & Compliance (5 tools)</strong></summary>

`query_audit_trail` · `get_audit_summary` · `get_analytics` · `get_task_cycle_time` · `compute_compliance_score`
</details>

<details>
<summary><strong>Quality Gate & Dependencies (3 tools)</strong></summary>

`check_merge_readiness` · `analyze_dependencies` · `validate_dependencies`
</details>

<details>
<summary><strong>Project & Sandbox (5 tools)</strong></summary>

`init_project` · `get_project_status` · `create_sandbox` · `destroy_sandbox` · `reset_sandbox`
</details>

<details>
<summary><strong>Composite Intelligence (4 tools)</strong></summary>

`get_standup_data` · `get_board_data` · `get_compliance_data` · `get_health_data`
</details>

## For Enterprise

ido4 provides the governance infrastructure that enterprise delivery requires:

**Compliance documentation.** Every decision is auditable. Every rule enforcement is traceable. The audit trail provides the evidence that enterprise clients demand — who did what, when, and whether the rules were followed.

**Multi-methodology support.** Three built-in profiles: Hydro (wave-based), Scrum (sprint-based), Shape Up (cycle-based). The engine is methodology-agnostic — profiles define states, transitions, containers, integrity rules, and pipelines. Adopt ido4 with your existing methodology while getting deterministic enforcement.

**Quality gates.** Configure minimum PR reviews, test coverage thresholds, and security scan requirements per transition. Gates are enforced deterministically — not as suggestions.

**Multi-agent governance at scale.** Deploy multiple AI agents on the same codebase with confidence. Each agent has a unique identity, capability profile, and audit trail. Work distribution prevents conflicts. Task locking prevents duplicate effort. Coordination state provides full visibility.

## The Consultancy 2.0 Model

ido4 enables a new operating model for software delivery:

**2 senior humans + AI agents + ido4 governance = the output of a 10-person team.**

| Role | Provides |
|---|---|
| **PM** | Product vision, stakeholder management, strategic decisions |
| **Tech Architect** | System design, code quality oversight, technical judgment |
| **AI Agents** | Execution capacity — coding, testing, documentation |
| **ido4** | **Governance** — deterministic rules ensuring methodology compliance |

This isn't a better project management tool. It's the technology infrastructure that makes AI-augmented delivery possible at enterprise scale.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture guide, and testing conventions.

```bash
# Development
npm install
npm run build
npm run test          # 1,768 tests

# Run with plugin
claude --plugin-dir ./packages/plugin
```

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>ido4</strong> — Because AI execution without governance is just chaos with better syntax.
</p>
