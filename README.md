<p align="center">
  <h1 align="center">ido4</h1>
  <p align="center"><strong>AI-Hybrid Software Development at Scale</strong></p>
  <p align="center">The platform that gives AI agents shared understanding, institutional memory, and quality enforcement</p>
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
  <img src="https://img.shields.io/badge/tests-1731-16A34A" alt="1731 Tests">
  <img src="https://img.shields.io/npm/l/@ido4/core" alt="MIT License">
</p>

---

AI agents can write code. But can they understand the full project? Know what was built before them? Pick the highest-leverage task? Build on decisions from previous sessions? Coordinate with other agents without conflicts?

**ido4** is an [MCP](https://modelcontextprotocol.io/) server that makes AI-hybrid software development actually work. It runs inside Claude Code (and any MCP-compatible AI environment), giving every AI session full project context — what to build, what's already built, who depends on your output — with deterministic governance ensuring quality at every step.

The system carries the knowledge, not the agent. Every session starts with accumulated project understanding. Every action is validated through **34 real validation steps** — not LLM instructions that can be hallucinated. Every outcome is recorded so the next session is smarter than the last.

```
Developer: "Start task #268"

ido4 BRE: BLOCKED — 3 validation failures:
  ✗ StatusTransition    — Blocked → In Progress is not a valid path
  ✗ DependencyValidation — dependency #267 not completed (In Progress)
  ✗ StartFromReadyForDev — task must be in Ready for Dev status

  Allowed action: unblock (the only valid path forward)
```

## The Problem

AI coding agents can execute. But AI-hybrid development at scale needs more than execution:

- **No shared understanding.** Every AI session starts from scratch. No knowledge of what was built yesterday, what decisions were made, what patterns were established. Context is lost between sessions.
- **No task intelligence.** Agents pick whatever task seems obvious, not the one that unblocks the most downstream work. No scoring, no cascade analysis, no epic momentum.
- **No institutional memory.** When Agent A builds an auth service and Agent B needs to consume it next week, there's no structured knowledge transfer. B searches the codebase blind.
- **No quality enforcement.** Dependencies get violated. Epics ship incomplete. Quality gates get skipped. Nobody can trace what happened when something breaks.
- **No coordination.** Multiple agents on the same codebase with no awareness of each other — duplicate work, conflicting changes, cascade failures.

Traditional project management tools (Linear, Jira, Notion) track work after the fact. They don't **empower agents** to build effectively. ido4 is the platform that makes AI-hybrid development work — from context delivery through quality enforcement.

## See It In Action

The sandbox creates a real GitHub project from a [demo codebase](https://github.com/ido4-dev/ido4-demo), embeds governance violations, and discovers them live — using the same tools that govern real projects:

```
$ claude --plugin-dir ../ido4dev
> /ido4dev:onboard

Demo project cloned. Creating governed sandbox...
✓ Tasks ingested via pipeline, violations embedded, agents registered

══════════════════════════════════════════════
  LIVE GOVERNANCE ANALYSIS
══════════════════════════════════════════════

CASCADE BLOCKER: Delivery Engine Core blocking 11 downstream tasks
  Working in src/notifications/delivery-engine.ts.
  Channel providers, template renderer, and API endpoint all waiting.

FALSE STATUS: Delivery Status Tracking shows "In Review" — no PR
  Status updated during sync meeting. Implementation not started.

REVIEW BOTTLENECK: Retry Policy PR open 3 days, 0 reviews
  Changes in src/notifications/retry-policy.ts. Code ready, idle.

INTEGRITY VIOLATION: Idempotency Guard in wrong wave
  Part of Notification Core capability but assigned to wave-003
  instead of wave-002. Delivery pipeline can't ship atomically.

══════════════════════════════════════════════
  INTELLIGENT WORK DISTRIBUTION
══════════════════════════════════════════════

agent-alpha (notification core — locked on Delivery Engine):
  → Email Provider       score:47  cascade:15 epic:12 cap:10 fresh:10
  → Webhook Provider     score:35  cascade:8  epic:12 cap:10 fresh:5

agent-beta (channel providers — available):
  → Email Provider       score:44  cascade:15 epic:12 cap:7  fresh:10
  → SMS Provider         score:30  cascade:8  epic:12 cap:7  fresh:3

Every score is deterministic — computed from dependency graphs,
capability completion ratios, agent capabilities, and audit timestamps.

══════════════════════════════════════════════
  MERGE READINESS GATE (6 checks)
══════════════════════════════════════════════

check_merge_readiness(Retry Policy):
  ✓ Workflow Compliance   — full audit trail (start → review)
  ✗ PR Review             — 0 approvals, 1 required
  ✓ Dependency Completion — all upstream satisfied
  ✓ Capability Integrity  — Notification Core in single wave
  ✓ Security Gates        — no vulnerability alerts
  ✓ Compliance Threshold  — score 88 (B+)
  Verdict: NOT READY TO MERGE

══════════════════════════════════════════════
  BRE ENFORCEMENT
══════════════════════════════════════════════

validate_all_transitions(Email Provider — Blocked):
  start   → BLOCKED (dependency Delivery Engine not complete)
  review  → BLOCKED (wrong status, no PR)
  approve → BLOCKED (can't jump to Done)
  unblock → ALLOWED ← the only valid path
```

These aren't hypothetical checks. These are the same governance rules that run on every real task, every real transition, every real project. [Try the sandbox demo →](https://hydro-dev.gitbook.io/ido4/getting-started/sandbox)

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
claude --plugin-dir ../ido4dev

# Try the interactive sandbox demo
> /ido4dev:onboard
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

### Context Assembly & Task Intelligence

Every AI session starts with full project understanding — not a blank slate:

- **`get_task_execution_data`** — One call assembles: task spec, upstream dependency context (what was actually built, not just "done"), sibling patterns, downstream consumers, epic progress, and quantified risk flags.
- **`get_next_task`** — 4-dimension scoring recommends the highest-leverage task: cascade value (what unblocks the most), epic momentum (finish what's started), capability match, dependency freshness.
- **`get_standup_data`** — Full project briefing: blocked tasks, compliance score, recent audit events, agent status, analytics — everything a session needs to orient.
- **Structured context comments** — Agents write what they built; next agent reads accumulated knowledge. Institutional memory that compounds across sessions.

### Deterministic Business Rule Engine

Every task transition runs through a composable validation pipeline — 34 built-in steps across 5 categories, configurable per methodology:

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

### 21 Intelligence Skills

Skills are intelligent workflows that compose multiple tools into project intelligence and governance insights. Core skills work across all methodologies; methodology-specific variants speak your methodology's language:

| Skill | What It Does |
|---|---|
| `/ido4dev:onboard` | Zero-friction onboarding — auto-clones demo, creates sandbox, guided governance discovery |
| `/ido4dev:guided-demo` | Four-act governance walkthrough — project, discovery, enforcement, pipeline |
| `/ido4dev:sandbox-explore` | Interactive exploration — 13 structured paths across governance capabilities |
| `/ido4dev:standup` | Morning briefing — risks, leverage points, highest-impact action |
| `/ido4dev:board` | Flow intelligence — blockers, cascade risks, false statuses, capability cohesion |
| `/ido4dev:compliance` | Three-part assessment: quantitative score + structural audit + synthesis |
| `/ido4dev:health` | 5-second governance verdict: RED / YELLOW / GREEN |
| `/ido4dev:plan-wave` | Principle-aware wave composition. Also: `/plan-sprint` (Scrum), `/plan-cycle` (Shape Up) |
| `/ido4dev:retro-wave` | Data-backed retrospective. Also: `/retro-sprint` (Scrum), `/retro-cycle` (Shape Up) |
| `/ido4dev:decompose` | Decompose a strategic spec into a technical spec via codebase analysis |
| `/ido4dev:sandbox` | Sandbox lifecycle — create, reset, destroy |
| `/ido4dev:pilot-test` | End-to-end verification of the entire governance stack |

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
│  21 Skills · 4 Agents · 2 Governance Hooks                   │
├──────────────────────────────────────────────────────────────┤
│  MCP Server (@ido4/mcp)                                      │
│  58 Tools · 9 Resources · 7 Prompts · STDIO Transport        │
├──────────────────────────────────────────────────────────────┤
│  Core Domain Layer (@ido4/core)                               │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ Tasks    │ │Containers│ │ Agents     │ │ Compliance   │  │
│  │ BRE (34  │ │Integrity │ │ Work       │ │ Analytics    │  │
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
| [`@ido4/core`](packages/core/) | `npm i @ido4/core` | Domain logic — BRE (34 steps), profile-driven services, repositories. Zero CLI dependencies. |
| [`@ido4/mcp`](packages/mcp/) | `npm i @ido4/mcp` | MCP server — STDIO transport, 58 tools (Hydro), 9 resources, 8 prompts. |
| [`ido4dev`](https://github.com/ido4-dev/ido4dev) | — | Claude Code plugin — 21 skills, 4 agents, governance hooks. |

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

ido4 provides the infrastructure that enterprise AI-hybrid development requires:

**Context at scale.** Every AI session starts with full project understanding — accumulated knowledge from every prior session, dependency context, risk signals, and institutional memory. No agent starts from scratch.

**Compliance documentation.** Every decision is auditable. Every rule enforcement is traceable. The audit trail provides the evidence that enterprise clients demand — who did what, when, and whether the rules were followed.

**Multi-methodology support.** Three built-in profiles: Hydro (wave-based), Scrum (sprint-based), Shape Up (cycle-based). The engine is methodology-agnostic — profiles define states, transitions, containers, integrity rules, and pipelines. Adopt ido4 with your existing methodology while getting deterministic enforcement.

**Quality gates.** Configure minimum PR reviews, test coverage thresholds, and security scan requirements per transition. Gates are enforced deterministically — not as suggestions.

**Multi-agent coordination at scale.** Deploy multiple AI agents on the same codebase with confidence. Each agent has a unique identity, capability profile, and audit trail. Task intelligence recommends the highest-leverage work. Task locking prevents duplicate effort. Handoff chains keep work flowing continuously.

## The New Way of Working

ido4 enables a new operating model for software delivery — AI-hybrid development at enterprise scale:

**2 senior humans + AI agents + ido4 = the output of a 10-person team.**

| Role | Provides |
|---|---|
| **PM** | Product vision, stakeholder management, strategic decisions |
| **Tech Architect** | System design, code quality oversight, technical judgment |
| **AI Agents** | Execution capacity — coding, testing, documentation |
| **ido4** | **The platform** — context intelligence, institutional memory, task distribution, and deterministic quality enforcement |

This isn't a better project management tool. It's the infrastructure that makes AI-hybrid software development actually work — where AI agents understand the full project, build on each other's work, and deliver with the quality and coherence that enterprise clients demand.

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture guide, and testing conventions.

```bash
# Development
npm install
npm run build
npm run test          # 1,731 tests

# Run with plugin
claude --plugin-dir ../ido4dev
```

## License

[MIT](LICENSE)

---

<p align="center">
  <strong>ido4</strong> — The platform that makes AI-hybrid software development work. At scale. For real.
</p>
