---
title: "MCP Prompts"
---

ido4 provides 8 MCP prompts — portable intelligence frameworks that work with any MCP-compatible AI client, not just Claude Code. Each prompt generates methodology-specific reasoning using the active profile's terminology and principles.

## Prompts vs Skills

| Aspect | Skills | Prompts |
|---|---|---|
| Platform | Claude Code only | Any MCP client |
| Invocation | `/ido4dev:standup` | MCP prompt protocol |
| Features | Memory, file access, hooks | Tool calls only |
| Count | 21 | 8 |

If you're using Claude Code with the plugin, use skills. If you're using another MCP client (Cursor, Windsurf, etc.), use prompts.

## Available Prompts

### standup

Governance-aware briefing. Analyzes container phase, detects blockers with cascade reasoning, identifies temporal patterns from the audit trail, and recommends the highest-impact action.

**Arguments**: None

### plan-{container}

Container composition with principle-aware constraints. The prompt name adapts to your methodology: `plan-wave` (Hydro), `plan-sprint` (Scrum), `plan-cycle` (Shape Up). Framework for dependency analysis, capacity estimation using real throughput data, and validation against the active profile's principles.

**Arguments**: `containerName` (optional)

### board

Flow intelligence report. Detects blocked cascades, false statuses, review bottlenecks, container fragmentation, cycle time outliers, and agent coordination issues.

**Arguments**: `containerName` (optional)

### compliance

Three-part compliance assessment. Quantitative scoring (0-100 with category breakdown), structural audit of governance principles (varies by methodology), and cross-referenced synthesis with actor patterns and temporal trends.

**Arguments**: None

### health

Quick governance dashboard. RED/YELLOW/GREEN across three dimensions (flow, governance, team) with compact metrics and suggested next action.

**Arguments**: None

### retro

Container retrospective. Analyzes real throughput, cycle time trends, measured blocking time, actor patterns, and governance quality. Every recommendation is data-backed. Adapts to methodology: wave retro (Hydro), sprint retro (Scrum), cycle retro (Shape Up).

**Arguments**: `containerName` (optional)

### review

Container review for stakeholder communication. Deliverable assessment, outcome vs plan analysis, quality metrics, and forward-looking analysis.

**Arguments**: `containerName` (optional)

### execute-task

Specs-driven task execution guidance. 8-phase framework: specification comprehension, upstream context interpretation, downstream awareness, pattern detection, work execution (methodology-specific principles), escalation protocol, context capture, and completion verification.

**Arguments**: `issueNumber` (required)

## Methodology-Aware Generation

Prompts aren't just localized — they use fundamentally different reasoning frameworks per methodology:

- **Hydro prompts** reason about wave phases, epic integrity, and dependency coherence
- **Scrum prompts** reason about sprint goals, burndown trajectory, and DoR/DoD per work item type
- **Shape Up prompts** reason about hill chart positions, appetite consumption, scope hammering, and circuit breaker countdown

The prompt generators read the active methodology profile and produce methodology-native content.

## Using Prompts

In any MCP client that supports prompts:

```
// Request the standup prompt
GET /prompts/standup

// Request plan-wave with arguments
GET /prompts/plan-wave?containerName=wave-003-advanced
```

The prompt returns a structured reasoning framework that the AI client uses to compose tool calls and analyze results.
