# Tool Reference

ido4 provides MCP tools organized into categories. The exact count varies by methodology profile because container management tools and transition tools are generated dynamically from the profile.

| Profile | Tools | Reason |
|---|---|---|
| Hydro | 58 | 2 containers (Wave, Epic) + 9 transitions |
| Scrum | 56 | 2 containers (Sprint, Epic) + 8 transitions |
| Shape Up | 54 | 3 containers (Cycle, Bet, Scope) + 10 transitions |

Every write tool supports `dryRun`, goes through BRE validation, and creates an audit entry.

**`dryRun: true`** — Validates the operation fully (runs the entire BRE pipeline) and returns what would happen, but doesn't mutate GitHub or create audit events. Use this to preview impact before committing to a transition.

**Tools are governed operations, not API wrappers.** Every write goes through: input validation → BRE pipeline (34 steps) → GitHub mutation → audit event → structured response with suggestions. This is why an agent can't accidentally violate a governance principle.

## Task Governance

### Workflow Transitions (dynamic)

Transition tools are generated from the active profile's transition definitions. The exact set depends on which transitions the profile defines.

**Universal transitions** (all profiles):

| Tool | Description | Key Parameters |
|---|---|---|
| `start_task` | Begin work — validates dependencies, container assignment, singularity | `issueNumber`, `dryRun?` |
| `review_task` | Submit for review/QA | `issueNumber`, `dryRun?` |
| `block_task` | Block a task with a required reason | `issueNumber`, `reason`, `dryRun?` |
| `unblock_task` | Unblock a task | `issueNumber`, `dryRun?` |
| `return_task` | Backward transition to a previous status | `issueNumber`, `targetStatus`, `reason`, `dryRun?` |

**Hydro-specific:**

| Tool | Description |
|---|---|
| `refine_task` | Backlog -> In Refinement |
| `ready_task` | In Refinement/Backlog -> Ready for Dev |
| `approve_task` | In Review -> Done |
| `complete_task` | Administrative completion (Done -> Done) |

**Scrum-specific:**

| Tool | Description |
|---|---|
| `plan_task` | Product Backlog -> Sprint Backlog |
| `approve_task` | In Review -> Done |

**Shape Up-specific:**

| Tool | Description |
|---|---|
| `shape_task` | Raw Idea -> Shaped |
| `bet_task` | Shaped -> Bet On |
| `ship_task` | QA -> Shipped |
| `kill_task` | Building/QA/Blocked -> Killed (circuit breaker) |

All transition tools accept optional `message` (added as issue comment), `context` (structured development context written as ido4 context comment), and `skipValidation` (bypasses BRE — recorded in audit trail).

### Task Data (4 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `get_task` | Full task details: status, containers, dependencies, all metadata | `issueNumber` |
| `get_task_field` | Get a specific field value | `issueNumber`, `field?` |
| `list_tasks` | List all tasks with optional filtering by status, container, assignee | `status?`, `wave?`, `assignee?` |
| `create_task` | Create a new task (GitHub issue) and add to the project board | `title`, `body?`, containers, metadata fields |

### Task Intelligence (6 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `validate_transition` | Dry-run a specific transition | `issueNumber`, `transition` |
| `validate_all_transitions` | Check all possible transitions — shows what's allowed and what's blocked | `issueNumber` |
| `find_task_pr` | Find the pull request linked to a task | `issueNumber` |
| `get_pr_reviews` | Get all reviews for a PR | `prNumber` |
| `add_task_comment` | Add a governed comment with audit trail | `issueNumber`, `comment` |
| `get_sub_issues` | Get sub-issues of a parent issue with completion progress | `issueNumber` |

## Container Management (dynamic)

Container tools are generated from the profile's container definitions. Each managed container type gets its own set of tools.

### Execution Container Tools

For the execution container (Wave/Sprint/Cycle):

| Tool Pattern | Hydro | Scrum | Shape Up |
|---|---|---|---|
| `list_{plural}` | `list_waves` | `list_sprints` | `list_cycles` |
| `get_{singular}_status` | `get_wave_status` | `get_sprint_status` | `get_cycle_status` |
| `create_{singular}` | `create_wave` | `create_sprint` | `create_cycle` |
| `assign_task_to_{singular}` | `assign_task_to_wave` | `assign_task_to_sprint` | `assign_task_to_cycle` |
| `validate_{singular}_completion` | `validate_wave_completion` | `validate_sprint_completion` | `validate_cycle_completion` |

### Grouping Container Tools

For grouping containers (Epic/Bet):

| Tool Pattern | Hydro | Scrum | Shape Up |
|---|---|---|---|
| `search_{plural}` | `search_epics` | `search_epics` | `search_bets` |
| `get_{singular}_tasks` | `get_epic_tasks` | `get_epic_tasks` | `get_bet_tasks` |
| `get_{singular}_timeline` | `get_epic_timeline` | `get_epic_timeline` | `get_bet_timeline` |
| `validate_{singular}_integrity` | `validate_epic_integrity` | `validate_epic_integrity` | `validate_bet_integrity` |

Shape Up also generates Scope tools (`list_scopes`, etc.) since Scope is a third container type.

## Multi-Agent Coordination (7 tools)

### Agent Management

| Tool | Description | Key Parameters |
|---|---|---|
| `register_agent` | Register an AI agent with role and capabilities | `agentId`, `name`, `role`, `capabilities?` |
| `list_agents` | List all registered agents and their status | -- |
| `lock_task` | Acquire exclusive lock (30min TTL) | `issueNumber`, `agentId?` |
| `release_task` | Release a task lock | `issueNumber`, `agentId?` |

### Intelligent Distribution

| Tool | Description | Key Parameters |
|---|---|---|
| `get_next_task` | Scored task recommendation: cascade, momentum, capability match, freshness | `agentId?`, `waveName?` |
| `complete_and_handoff` | Atomic: approve + release lock + identify unblocked + recommend next | `issueNumber`, `agentId?` |
| `get_coordination_state` | Full multi-agent picture: agents, events, locks, recommendations | `agentId?`, `since?` |

## Audit, Analytics & Compliance (5 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `query_audit_trail` | Query events by time, actor, transition, issue, session | `since?`, `until?`, `actorId?`, `transition?`, `issueNumber?`, `limit?` |
| `get_audit_summary` | Event counts grouped by type, actor, and transition | `since?`, `until?` |
| `get_analytics` | Velocity, cycle time, lead time, throughput, blocking time | `waveName?`, `since?`, `until?` |
| `get_task_cycle_time` | Full timeline for a specific task | `issueNumber` |
| `compute_compliance_score` | Deterministic 0-100 score with 5-category breakdown | `since?`, `waveName?`, `actorId?` |

## Quality Gate & Dependencies (3 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `check_merge_readiness` | 6-check gate: workflow, PR review, deps, integrity, security, compliance | `issueNumber`, `overrideReason?`, `minReviews?`, `minComplianceScore?` |
| `analyze_dependencies` | Full dependency tree: depth, circular detection, blocker identification | `issueNumber` |
| `validate_dependencies` | Check if all dependencies for a task are satisfied | `issueNumber` |

## Project & Sandbox (5 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `init_project` | Initialize ido4 governance: create/connect GitHub Project V2, set up fields and config | `mode` ('create' or 'connect'), `repository?`, `projectName?`, `methodology?` |
| `get_project_status` | Dashboard: container summaries, task distribution, completion metrics | -- |
| `create_sandbox` | Create methodology-specific sandbox with embedded violations | `repository`, `methodology?` |
| `destroy_sandbox` | Destroy sandbox: close issues, delete project, remove config | -- |
| `reset_sandbox` | Destroy and recreate fresh | -- |

## Ingestion (2 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `ingest_spec` | Ingest a technical spec: parse, validate, create GitHub issues | `specContent`, `dryRun?` |
| `parse_strategic_spec` | Parse a strategic spec from ido4shape into structured data | `specContent` |

## Composite Intelligence (5 tools)

These tools aggregate multiple data sources into single responses, optimized for skill consumption:

| Tool | Replaces | Used By |
|---|---|---|
| `get_standup_data` | 10-12 individual calls (container status, tasks, PRs, deps, audit, analytics, agents, compliance) | `/ido4dev:standup` |
| `get_board_data` | 5-6 individual calls (container status, tasks with PR/lock annotations, analytics, agents) | `/ido4dev:board` |
| `get_compliance_data` | 7+ individual calls (compliance score, audit, analytics, containers, tasks, deps) | `/ido4dev:compliance` |
| `get_health_data` | 5 individual calls (container status, compliance, analytics, agents) | `/ido4dev:health` |
| `get_task_execution_data` | 5-10 individual calls (task spec, upstream deps with context, siblings, downstream, progress) | Task execution |

## Response Format

Every tool returns a consistent structure:

```json
{
  "success": true,
  "data": { },
  "suggestions": [
    {
      "action": "review_task",
      "description": "Task #42 has been in progress for 3 days",
      "priority": "high"
    }
  ],
  "warnings": [
    "Container integrity warning: Auth tasks span 2 waves"
  ]
}
```
