# MCP Prompts

ido4 provides 7 MCP prompts — portable intelligence frameworks that work with any MCP-compatible AI client, not just Claude Code.

## Prompts vs Skills

| Aspect | Skills | Prompts |
|---|---|---|
| Platform | Claude Code only | Any MCP client |
| Invocation | `/ido4:standup` | MCP prompt protocol |
| Features | Memory, file access, hooks | Tool calls only |
| Count | 18 | 7 |

Prompts mirror the corresponding skills in a portable format. If you're using Claude Code with the plugin, use skills. If you're using another MCP client, use prompts.

## Available Prompts

### standup

Governance-aware morning briefing. Provides a framework for analyzing wave phase, detecting blockers, identifying review bottlenecks, analyzing temporal patterns from the audit trail, and recommending the highest-impact action.

**Arguments**: None

### plan-wave

Principle-aware wave composition. Step-by-step framework for epic-first grouping (Principle 1), dependency analysis (Principles 3 & 4), capacity estimation using real throughput data, and validation against all 5 principles.

**Arguments**: `waveName` (optional)

### board

Flow intelligence report. Framework for detecting blocked cascades, false statuses, review bottlenecks, epic fragmentation, cycle time outliers, and agent coordination issues.

**Arguments**: `waveName` (optional)

### compliance

Three-part compliance assessment. Quantitative scoring (0-100 with 5-category breakdown), structural audit of all 5 governance principles, and cross-referenced synthesis with actor patterns and temporal trends.

**Arguments**: None

### health

Quick governance dashboard. RED/YELLOW/GREEN classification across three dimensions (flow, governance, team) with compact metrics and suggested next action.

**Arguments**: None

### retro

Wave retrospective. Framework for analyzing real throughput, cycle time trends, measured blocking time, actor patterns, and governance quality. Every recommendation is data-backed.

**Arguments**: `waveName` (optional)

## Using Prompts

In any MCP client that supports prompts:

```
// Request the standup prompt
GET /prompts/standup

// Request plan-wave with arguments
GET /prompts/plan-wave?waveName=wave-003-advanced
```

The prompt returns a structured reasoning framework that the AI client uses to compose tool calls and analyze results. The framework includes:
- What data to gather (which tools to call)
- What patterns to look for
- How to format the output
- Anti-patterns to avoid
