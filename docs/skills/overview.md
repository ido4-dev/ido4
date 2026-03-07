# Skills Overview

Skills are intelligent governance workflows that compose multiple MCP tools into actionable insights. Each skill gathers data, analyzes patterns, and presents findings — all grounded in real tool call results.

## Available Skills

| Skill | Invocation | Purpose |
|---|---|---|
| [Standup](standup.md) | `/ido4:standup` | Morning briefing with risks, blockers, and highest-impact recommendation |
| [Plan Wave](plan-wave.md) | `/ido4:plan-wave` | Principle-aware wave composition engine |
| [Board](board.md) | `/ido4:board` | Flow intelligence — blockers, cascades, false statuses |
| [Compliance](compliance.md) | `/ido4:compliance` | Three-part compliance assessment |
| [Retro](retro.md) | `/ido4:retro` | Data-backed wave retrospective |
| [Health](health.md) | `/ido4:health` | 5-second RED/YELLOW/GREEN verdict |
| [Sandbox](sandbox.md) | `/ido4:sandbox` | Interactive governance demo |
| Pilot Test | `/ido4:pilot-test` | End-to-end verification of the governance stack |

## How Skills Work

Skills are Claude Code SKILL.md files — structured prompts that instruct the AI to:

1. Call specific MCP tools to gather data
2. Analyze the results for patterns and anomalies
3. Present findings in a consistent format
4. Make recommendations grounded in evidence

Skills don't guess. Every insight comes from a tool call result. If a skill says "T12 has been in review for 4 days," it's because the audit trail shows a `review` transition 4 days ago with no subsequent `approve`.

## Skills vs Prompts

ido4 provides both **skills** (Claude Code plugin) and **prompts** (MCP server):

| Aspect | Skills | Prompts |
|---|---|---|
| Invocation | `/ido4:standup` | Via MCP prompt protocol |
| Available in | Claude Code (with plugin) | Any MCP-compatible client |
| Features | Full skill capabilities (tools, files, memory) | Tool calls + structured reasoning |
| Count | 8 | 6 |

The 6 prompts (standup, plan-wave, board, compliance, health, retro) mirror the corresponding skills in a portable format. Any MCP client can use them — not just Claude Code.

## Data Pipeline

Skills leverage 4 composite data tools that aggregate governance data in single calls:

| Aggregator | Replaces | Used By |
|---|---|---|
| `get_standup_data` | 10-12 individual tool calls | /standup |
| `get_board_data` | 5-6 individual tool calls | /board |
| `get_compliance_data` | 7+ individual tool calls | /compliance |
| `get_health_data` | 5 individual tool calls | /health |

These aggregators fetch wave status, task lists, PR states, dependency graphs, audit trails, analytics, agent lists, and compliance scores — all in one call per skill.

## Cross-Skill Intelligence

Skills share intelligence through Claude Code's memory system:

- **Retro** and **Compliance** persist findings to `MEMORY.md` in structured `--- FINDINGS ---` blocks
- **Standup** and **Plan Wave** read `MEMORY.md` (auto-loaded) for historical context
- **Sandbox** seeds memory with pre-built governance observations
- **PM Agent** bridges everything — persists insights and references them across sessions

This creates a governance intelligence layer that gets smarter over time.

## PM Agent

The Project Manager agent (`/ido4:project-manager`) is a persistent governance brain:

- **Persistent memory** — Tracks velocity baselines, compliance trends, recurring blockers
- **Data-backed decisions** — Uses audit trail, analytics, and compliance score instead of estimation
- **Multi-agent coordination** — Detects lock contention, idle agents, work imbalance
- **Leverage thinking** — Always asks "What single action creates the most downstream value?"
- **Wave lifecycle awareness** — Recommendations differ by wave phase (early/mid/late)

The agent cannot override the BRE — it reports validation results and translates errors into actionable guidance.
