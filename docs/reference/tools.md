# Tool Reference

ido4 provides 51 MCP tools organized into 7 categories. Every write tool supports `dryRun`, goes through BRE validation, and creates an audit entry.

## Task Governance (18 tools)

### Workflow Transitions

| Tool | Description | Key Parameters |
|---|---|---|
| `start_task` | Transition from Ready for Dev to In Progress. Runs full BRE validation. | `issueNumber`, `dryRun?` |
| `review_task` | Submit for review — In Progress to In Review. | `issueNumber`, `dryRun?` |
| `approve_task` | Approve and complete — In Review to Done. Closes the GitHub issue. | `issueNumber`, `dryRun?` |
| `block_task` | Block a task with a required reason. | `issueNumber`, `reason`, `dryRun?` |
| `unblock_task` | Unblock — Blocked back to Ready for Dev. | `issueNumber`, `dryRun?` |
| `return_task` | Return to a previous status (backward transition). | `issueNumber`, `targetStatus`, `reason`, `dryRun?` |
| `refine_task` | Move from Backlog to In Refinement. | `issueNumber`, `dryRun?` |
| `ready_task` | Mark as Ready for Dev from In Refinement. | `issueNumber`, `dryRun?` |

All transition tools accept optional `message` (added as issue comment) and `skipValidation` (bypasses BRE — recorded in audit trail).

### Task Data

| Tool | Description | Key Parameters |
|---|---|---|
| `get_task` | Full task details: status, wave, epic, dependencies, all metadata. | `issueNumber` |
| `get_task_field` | Get a specific field value. | `issueNumber`, `field?` |
| `list_tasks` | List all tasks with optional filtering. | `status?`, `wave?`, `assignee?` |
| `create_task` | Create a new task (GitHub issue) and add to the project board. | `title`, `body?`, `wave?`, `epic?`, `effort?`, `riskLevel?`, ... |

### Task Intelligence

| Tool | Description | Key Parameters |
|---|---|---|
| `validate_transition` | Dry-run: validate a specific transition without executing it. | `issueNumber`, `transition` |
| `validate_all_transitions` | Check all 9 possible transitions — shows what's allowed and what's blocked. | `issueNumber` |
| `find_task_pr` | Find the pull request linked to a task (closing references + title/body mentions). | `issueNumber` |
| `get_pr_reviews` | Get all reviews for a PR: reviewer, state, feedback. | `prNumber` |
| `add_task_comment` | Add a governed comment with audit trail. | `issueNumber`, `comment` |
| `get_sub_issues` | Get sub-issues of a parent issue with state and completion progress. | `issueNumber` |

## Wave & Epic Management (9 tools)

### Wave Tools

| Tool | Description | Key Parameters |
|---|---|---|
| `list_waves` | All waves with task counts and completion percentages. | — |
| `get_wave_status` | Detailed wave status: task breakdown, metrics, blockers. | `waveName` |
| `create_wave` | Create a new wave for grouping tasks. | `name`, `description?` |
| `assign_task_to_wave` | Assign a task to a wave — enforces Epic Integrity. | `issueNumber`, `waveName` |
| `validate_wave_completion` | Check if all tasks in a wave are Done. | `waveName` |

### Epic Tools

| Tool | Description | Key Parameters |
|---|---|---|
| `search_epics` | Search for epics by name or title pattern. | `searchTerm` |
| `get_epic_tasks` | All tasks assigned to an epic with status and wave. | `epicName` |
| `get_epic_timeline` | Epic timeline: connected issues, sub-issues, completion summary. | `issueNumber` |
| `validate_epic_integrity` | Check if a task's epic assignment maintains wave cohesion. | `issueNumber` |

## Multi-Agent Coordination (7 tools)

### Agent Management

| Tool | Description | Key Parameters |
|---|---|---|
| `register_agent` | Register an AI agent with role and capabilities. | `agentId`, `name`, `role`, `capabilities?` |
| `list_agents` | List all registered agents and their status. | — |
| `lock_task` | Acquire exclusive lock (30min TTL). | `issueNumber`, `agentId?` |
| `release_task` | Release a task lock. | `issueNumber`, `agentId?` |

### Intelligent Distribution

| Tool | Description | Key Parameters |
|---|---|---|
| `get_next_task` | Scored task recommendation: cascade, epic momentum, capability match, freshness. | `agentId?`, `waveName?` |
| `complete_and_handoff` | Atomic: approve + release lock + identify unblocked + recommend next. | `issueNumber`, `agentId?` |
| `get_coordination_state` | Full multi-agent picture: agents, events, locks, recommendations. | `agentId?`, `since?` |

## Audit, Analytics & Compliance (5 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `query_audit_trail` | Query events by time, actor, transition, issue, session. | `since?`, `until?`, `actorId?`, `transition?`, `issueNumber?`, `limit?` |
| `get_audit_summary` | Event counts grouped by type, actor, and transition. | `since?`, `until?` |
| `get_analytics` | Velocity, cycle time, lead time, throughput, blocking time. | `waveName?`, `since?`, `until?` |
| `get_task_cycle_time` | Full timeline for a specific task: cycle, lead, blocking time. | `issueNumber` |
| `compute_compliance_score` | Deterministic 0-100 score with 5-category breakdown and recommendations. | `since?`, `waveName?`, `actorId?` |

## Quality Gate & Dependencies (3 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `check_merge_readiness` | 6-check gate: workflow, PR review, deps, epic integrity, security, compliance. Supports override. | `issueNumber`, `overrideReason?`, `minReviews?`, `minComplianceScore?` |
| `analyze_dependencies` | Full dependency tree: depth, circular detection, blocker identification. | `issueNumber` |
| `validate_dependencies` | Check if all dependencies for a task are satisfied (all Done). | `issueNumber` |

## Project & Sandbox (5 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `init_project` | Initialize ido4 governance: create/connect GitHub Project V2, set up fields and config. | `mode` ('create'\|'connect'), `repository?`, `projectName?` |
| `get_project_status` | Dashboard: wave summaries, task distribution by status, blocked count, completion metrics. | — |
| `create_sandbox` | Create sandbox with 20 tasks, 5 epics, 4 waves, embedded violations. | `repository` |
| `destroy_sandbox` | Destroy sandbox: close issues, delete project, remove config. Refuses on non-sandbox projects. | — |
| `reset_sandbox` | Destroy and recreate fresh. | — |

## Composite Intelligence (4 tools)

These tools aggregate multiple data sources into single responses, optimized for skill consumption:

| Tool | Replaces | Used By |
|---|---|---|
| `get_standup_data` | 10-12 individual calls (wave status, tasks, PRs, deps, audit, analytics, agents, compliance) | `/ido4:standup` |
| `get_board_data` | 5-6 individual calls (wave status, tasks with PR/lock annotations, analytics, agents) | `/ido4:board` |
| `get_compliance_data` | 7+ individual calls (compliance score, audit, analytics, waves, tasks, deps, epics) | `/ido4:compliance` |
| `get_health_data` | 5 individual calls (wave status, compliance, analytics, agents) | `/ido4:health` |

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
    "Epic integrity warning: Auth epic tasks span 2 waves"
  ]
}
```
