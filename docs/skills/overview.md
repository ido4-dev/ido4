# Skills

Skills are where ido4's intelligence lives. Each skill composes multiple MCP tools into a governance workflow — gathering data, spotting patterns, and delivering actionable insights. Every claim is backed by a tool call result. Nothing is guessed.

## At a glance

### Intelligence (works with any methodology)

| Skill | What it tells you |
|---|---|
| `/ido4:standup` | What's blocked, what's stale, and the single highest-leverage action for the day |
| `/ido4:board` | Whether work is actually flowing — cascade blockers, false statuses, review bottlenecks |
| `/ido4:health` | GREEN / YELLOW / RED in 5 seconds |
| `/ido4:compliance` | How governed are we? Score, principle audit, and what to fix first |

### Planning (methodology-specific)

| Skill | Methodology | What it produces |
|---|---|---|
| `/ido4:plan-wave` | Hydro | Valid-by-construction wave plan respecting all 5 principles |
| `/ido4:plan-sprint` | Scrum | Sprint backlog with DoR gates per work item type |
| `/ido4:plan-cycle` | Shape Up | Betting table with appetite check and circuit breaker risk |

### Retrospectives (methodology-specific)

| Skill | Methodology | What it analyzes |
|---|---|---|
| `/ido4:retro-wave` | Hydro | Velocity, epic integrity, blocking time — real data from the audit trail |
| `/ido4:retro-sprint` | Scrum | Sprint goal achievement, DoR effectiveness, carry-over trends |
| `/ido4:retro-cycle` | Shape Up | Bet outcomes, appetite accuracy, circuit breaker decisions |

### Decomposition

| Skill | What it does |
|---|---|
| `/ido4:decompose` | Transforms a strategic spec into a technical spec with implementation tasks grounded in your codebase |
| `/ido4:spec-validate` | Catches format and quality issues before ingestion |

### Sandbox & Verification

| Skill | What it demonstrates |
|---|---|
| `/ido4:sandbox` | Creates a real GitHub project with embedded violations — then discovers them live |
| `/ido4:sandbox-hydro` | Hydro-specific demo: epic integrity violations, cascade blockers |
| `/ido4:sandbox-scrum` | Scrum-specific demo: DoR violations, type mismatches |
| `/ido4:sandbox-shape-up` | Shape Up-specific demo: circuit breaker countdown, scope creep |
| `/ido4:pilot-test` | End-to-end verification that the full governance stack works |

## How skills work

Skills are SKILL.md files — structured prompts that tell the AI what to do, not how to think:

1. Call specific MCP tools to gather data
2. Analyze results for patterns and anomalies
3. Present findings in a consistent format
4. Recommend actions grounded in evidence

The key insight: skills call **composite data tools** (`get_standup_data`, `get_board_data`, etc.) that aggregate 5-12 individual tool calls into a single request. One call returns everything the skill needs.

## Skills vs Prompts

| | Skills | Prompts |
|---|---|---|
| Platform | Claude Code (with plugin) | Any MCP client |
| Invocation | `/ido4:standup` | MCP prompt protocol |
| Features | Memory, file access, hooks | Tool calls + reasoning |
| Count | 18 (+ 1 auto-activating) | 8 |

The 8 prompts (standup, plan-container, board, compliance, health, retro, review, execute-task) mirror the corresponding skills in a portable format. Use skills in Claude Code, prompts everywhere else.

## Cross-skill intelligence

Skills share knowledge through Claude Code's memory:

- **Retro** persists findings (velocity baselines, blocking patterns)
- **Standup** reads previous retro findings for context
- **Plan** uses velocity baselines for capacity estimation
- **Compliance** tracks score trends across assessments
- **PM Agent** bridges everything — persistent memory across sessions

The governance intelligence layer gets smarter with every skill invocation.

## PM Agent

The Project Manager agent is a persistent governance brain with methodology expertise:

- Maintains velocity baselines, compliance trends, and blocker patterns across sessions
- Grounds every recommendation in real data — audit trail, analytics, compliance score
- Coordinates multiple agents — detects lock contention, idle agents, work imbalance
- Cannot override the BRE — translates validation failures into actionable guidance

See [PM Agent](pm-agent.md) for details.
