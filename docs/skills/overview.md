# Skills, Agents & Hooks

Skills are where ido4's project intelligence lives. Each skill composes multiple MCP tools into an intelligent workflow — assembling context, spotting patterns, and delivering actionable insights. Every claim is backed by real data from the audit trail and analytics. Nothing is guessed.

Together with 4 specialized agents and 2 automation hooks, the plugin layer turns raw governance data into the project understanding that makes AI-hybrid development work.

## Complete Inventory

### Project Intelligence (any methodology)

| Component | Type | What it does |
|---|---|---|
| `/ido4dev:standup` | Skill | Morning briefing — what's blocked, what's at risk, the single highest-leverage action for the day |
| `/ido4dev:board` | Skill | Flow intelligence — cascade blockers, false statuses, review bottlenecks, epic cohesion |
| `/ido4dev:health` | Skill | GREEN / YELLOW / RED verdict across flow, governance, and team dimensions |
| `/ido4dev:compliance` | Skill | Quantitative score (0-100) + structural principle audit + improvement recommendations |

### Planning (methodology-specific)

| Component | Type | Methodology | What it produces |
|---|---|---|---|
| `/ido4dev:plan-wave` | Skill | Hydro | Valid-by-construction wave plan respecting all 5 governance principles |
| `/ido4dev:plan-sprint` | Skill | Scrum | Sprint backlog with Definition of Ready gates per work item type |
| `/ido4dev:plan-cycle` | Skill | Shape Up | Betting table with appetite check and circuit breaker risk assessment |

### Retrospectives (methodology-specific)

| Component | Type | Methodology | What it analyzes |
|---|---|---|---|
| `/ido4dev:retro-wave` | Skill | Hydro | Velocity, epic integrity, blocking time — real data from audit trail |
| `/ido4dev:retro-sprint` | Skill | Scrum | Sprint goal achievement, DoR effectiveness, carry-over trends |
| `/ido4dev:retro-cycle` | Skill | Shape Up | Bet outcomes, appetite accuracy, circuit breaker decisions |

### Specification & Decomposition

| Component | Type | What it does |
|---|---|---|
| `/ido4dev:decompose` | Skill | Transforms a strategic spec into a technical spec with implementation tasks grounded in your codebase |
| `/ido4dev:spec-validate` | Skill | Catches format and quality issues before ingestion |
| `/ido4dev:spec-quality` | Skill | Quality standards for task descriptions, success conditions, effort/risk calibration |
| Code Analyzer | Agent | Maps strategic capabilities to codebase modules, discovers patterns. Uses Read/Glob/Grep. Model: Opus |
| Technical Spec Writer | Agent | Decomposes capabilities into right-sized tasks with code-grounded metadata. Model: Opus |
| Spec Reviewer | Agent | Independent two-stage review — format compliance + quality assessment. Model: Sonnet |

### Sandbox & Onboarding

| Component | Type | What it does |
|---|---|---|
| `/ido4dev:onboard` | Skill | Zero-friction first touch — auto-clones demo codebase, creates sandbox, guided governance discovery |
| `/ido4dev:guided-demo` | Skill | Four-act governance walkthrough — project overview, violation discovery, enforcement, full pipeline |
| `/ido4dev:sandbox-explore` | Skill | Interactive exploration — 13 structured paths across governance, enforcement, coordination |
| `/ido4dev:sandbox` | Skill | Sandbox lifecycle management — create, reset, destroy |
| `/ido4dev:pilot-test` | Skill | End-to-end verification that the full governance stack works |

### Persistent Intelligence

| Component | Type | What it does |
|---|---|---|
| PM Agent | Agent | Persistent project intelligence brain. Maintains velocity baselines, compliance trends, blocker patterns across sessions. Grounds every recommendation in real data. Model: Sonnet |
| Post-transition | Hook | Fires after state changes. Checks: did this unblock downstream? Create new blocker? Reach milestone? |
| Post-wave-assignment | Hook | Fires after wave assignment. Checks epic integrity and dependency violations. |

**Totals: 21 skills + 4 agents + 2 hooks**

## How Skills Work

Skills are SKILL.md files — structured prompts that tell the AI what to do:

1. Call specific MCP tools to gather data
2. Analyze results for patterns and anomalies
3. Present findings in a consistent format
4. Recommend actions grounded in evidence

### Composite Data Tools (the performance layer)

Skills don't make 10+ individual tool calls. They call **composite aggregators** that assemble everything in one request:

| Aggregator | What it assembles | Used by |
|---|---|---|
| `get_standup_data` | Container status, tasks, PR reviews, blocker analyses, audit trail (24h), analytics, agents, compliance | `/ido4dev:standup` |
| `get_board_data` | Container status, tasks with PR + lock annotations, analytics, agents | `/ido4dev:board` |
| `get_compliance_data` | Compliance score, audit trail, analytics, tasks, blocker analyses, integrity checks | `/ido4dev:compliance` |
| `get_health_data` | Container status, compliance, analytics, agents | `/ido4dev:health` |
| `get_task_execution_data` | Task spec, upstream context (what was built), sibling patterns, downstream consumers, epic progress, risk flags | Task execution |

These are MCP tools defined in `@ido4/mcp` — available to any MCP client, not just skills.

## Skills vs Prompts vs Agents

| | Skills | Prompts | Agents |
|---|---|---|---|
| Platform | Claude Code (with plugin) | Any MCP client | Claude Code (with plugin) |
| Invocation | `/ido4dev:standup` | MCP prompt protocol | Invoked by skills |
| Features | Memory, file access, hooks | Tool calls + reasoning | Specialized instructions, model selection |
| Count | 18 | 8 | 4 |
| Purpose | Intelligent workflows | Portable guidance | Focused AI roles |

## Cross-Skill Intelligence Loop

Skills share knowledge through Claude Code's memory, creating a compounding intelligence loop:

- **Retro** analyzes what happened → persists findings (velocity baselines, blocking patterns, process gaps)
- **Standup** reads retro findings → contextualizes today's risks against historical patterns
- **Plan** reads velocity baselines → grounds capacity estimates in real throughput, not guesses
- **Compliance** tracks score trends → detects governance degradation across assessments
- **PM Agent** bridges everything → persistent memory across sessions, coordination across agents

Every skill invocation makes the next one smarter. This is institutional memory in action.

## PM Agent

The PM agent is a persistent project intelligence brain — not a chatbot, but a data-grounded advisor:

- Maintains velocity baselines, compliance trends, and blocker patterns across sessions
- Grounds every recommendation in real data — audit trail, analytics, compliance score
- Coordinates multiple agents — detects lock contention, idle agents, work imbalance
- Cannot override the BRE — translates validation failures into actionable guidance

See [PM Agent](pm-agent.md) for details.
