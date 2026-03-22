# /health

**Quick multi-dimensional governance dashboard** — one-line verdict with key metrics across flow, compliance, and team health.

## Invocation

```
/ido4dev:health
```

## What It Does

The health skill is a 5-second governance check. It evaluates three dimensions and returns a single verdict:

### Flow (% blocked)
- **GREEN**: < 10% of tasks blocked
- **YELLOW**: 10-20% blocked
- **RED**: > 20% blocked

### Governance (compliance grade)
- **GREEN**: Grade A or B
- **YELLOW**: Grade C
- **RED**: Grade D or F

### Team (agent activity)
- **GREEN**: All agents active or recently active
- **YELLOW**: Some agents idle
- **RED**: No agent activity in 24h

## Output Format

```
HEALTH: GREEN — wave-002-core flowing normally

Done:2 InProgress:1 Review:2 Blocked:2 Ready:2 Refinement:1
Compliance:92/A | Throughput:1.4/day | Agents: alpha(working) beta(available)

Suggestion: Run /ido4dev:board for cascade analysis on the 2 blocked tasks
```

Or when things aren't fine:

```
HEALTH: RED — wave-002-core has significant blockers

Done:2 InProgress:1 Review:2 Blocked:4 Ready:1 Refinement:0
Compliance:68/D | Throughput:0.3/day | Agents: alpha(stale) beta(idle)

CRITICAL: 40% of tasks blocked, compliance below threshold,
agent-alpha lock expired. Run /ido4dev:standup for full analysis.
```

## When to Use

- Start of day — quick check before diving into `/ido4dev:standup`
- After major transitions — verify nothing broke
- During demos — show governance status at a glance
- Between meetings — 5-second project pulse

## Next Steps

Based on the verdict, health suggests which skill to run:
- **RED** → `/ido4dev:standup` (full analysis needed)
- **YELLOW** → `/ido4dev:board` (investigate specific issues)
- **GREEN** → Continue working or run `/ido4dev:compliance` for deeper view
