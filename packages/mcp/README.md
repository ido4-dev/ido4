# @ido4/mcp

The MCP server for [ido4](https://github.com/ido4-dev/ido4) — the platform for AI-hybrid software development at scale. Provides context intelligence, task distribution, and deterministic governance over STDIO transport.

## Installation

```bash
npm install @ido4/mcp
```

## Usage

### With Claude Code

Add to your MCP client configuration (`.mcp.json` or Claude Code settings):

```json
{
  "mcpServers": {
    "ido4": {
      "command": "npx",
      "args": ["@ido4/mcp"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    }
  }
}
```

### With the Plugin (recommended)

The ido4 plugin bundles the MCP server with skills, an agent, and hooks:

```bash
claude --plugin-dir ./packages/plugin
```

### Standalone

```bash
GITHUB_TOKEN=your-token npx @ido4/mcp
```

## 51 Tools

### Task Governance (18)

| Tool | Description |
|---|---|
| `start_task` | Start working on a task — BRE-validated transition to In Progress |
| `review_task` | Submit for review — transition to In Review |
| `approve_task` | Approve and complete — transition to Done |
| `block_task` | Block a task with a required reason |
| `unblock_task` | Unblock — transition back to Ready for Dev |
| `return_task` | Return to a previous status with reason |
| `refine_task` | Move from Backlog to In Refinement |
| `ready_task` | Mark as Ready for Dev from In Refinement |
| `get_task` | Get full task details with all metadata |
| `get_task_field` | Get a specific field value |
| `list_tasks` | List tasks with optional status/wave/assignee filters |
| `create_task` | Create a new task with initial field values |
| `validate_transition` | Dry-run validation of a specific transition |
| `validate_all_transitions` | Check all 9 possible transitions |
| `find_task_pr` | Find the linked pull request |
| `get_pr_reviews` | Get PR reviews (reviewer, state, feedback) |
| `add_task_comment` | Add a governed, audit-trailed comment |
| `get_sub_issues` | Get sub-issues of a parent issue |

### Wave & Epic Management (9)

| Tool | Description |
|---|---|
| `list_waves` | List all waves with task counts and completion % |
| `get_wave_status` | Detailed wave status with task breakdown |
| `create_wave` | Create a new wave |
| `assign_task_to_wave` | Assign task to wave with Epic Integrity validation |
| `validate_wave_completion` | Check if a wave can be completed |
| `search_epics` | Search for epics by name/title |
| `get_epic_tasks` | Get all tasks in an epic with status and wave |
| `get_epic_timeline` | Epic timeline with connected/sub-issues |
| `validate_epic_integrity` | Check epic integrity for a task |

### Multi-Agent Coordination (7)

| Tool | Description |
|---|---|
| `register_agent` | Register an AI agent with role and capabilities |
| `list_agents` | List all registered agents |
| `lock_task` | Acquire exclusive lock on a task |
| `release_task` | Release a task lock |
| `get_next_task` | Get scored task recommendation for an agent |
| `complete_and_handoff` | Approve + release + recommend next — atomic handoff |
| `get_coordination_state` | Full coordination picture: agents, events, locks |

### Audit, Analytics & Compliance (5)

| Tool | Description |
|---|---|
| `query_audit_trail` | Query audit events with flexible filters |
| `get_audit_summary` | Summary of governance activity over a period |
| `get_analytics` | Velocity, cycle time, lead time, throughput |
| `get_task_cycle_time` | Cycle time and timeline for a specific task |
| `compute_compliance_score` | Deterministic 0-100 compliance score |

### Quality Gate & Dependencies (3)

| Tool | Description |
|---|---|
| `check_merge_readiness` | 6-check quality gate for merge approval |
| `analyze_dependencies` | Full dependency tree with circular detection |
| `validate_dependencies` | Check if all task dependencies are satisfied |

### Project & Sandbox (5)

| Tool | Description |
|---|---|
| `init_project` | Initialize ido4 governance for a repository |
| `get_project_status` | Dashboard: wave summaries, task distribution |
| `create_sandbox` | Create sandbox with embedded governance violations |
| `destroy_sandbox` | Destroy sandbox (closes issues, deletes project) |
| `reset_sandbox` | Destroy and recreate fresh |

### Composite Intelligence (4)

| Tool | Description |
|---|---|
| `get_standup_data` | All data for a governance standup in one call |
| `get_board_data` | All data for an intelligent board in one call |
| `get_compliance_data` | All data for compliance assessment in one call |
| `get_health_data` | All data for a quick health check in one call |

## 9 Resources

| URI | Description |
|---|---|
| `ido4://project/config` | Project configuration and field IDs |
| `ido4://project/status` | Live project dashboard |
| `ido4://methodology/principles` | The 5 governance principles |
| `ido4://methodology/transitions` | Valid state transition matrix |
| `ido4://audit/recent` | Recent audit trail entries |
| `ido4://analytics/overview` | Project analytics summary |
| `ido4://compliance/score` | Current compliance score |
| `ido4://coordination/state` | Multi-agent coordination state |
| `ido4://coordination/events` | Recent governance events |

## 6 Prompts

| Prompt | Description |
|---|---|
| `standup` | Governance-aware morning briefing |
| `plan-wave` | Principle-aware wave composition |
| `board` | Flow intelligence with blocker detection |
| `compliance` | Quantitative + structural compliance assessment |
| `health` | Quick RED/YELLOW/GREEN governance verdict |
| `retro` | Data-backed wave retrospective |

## Testing

```bash
npm run test  # 231 tests
```

## License

[MIT](../../LICENSE)
