# Planning Skills

ido4 provides methodology-specific planning skills that compose execution containers following all governance constraints.

| Skill | Methodology | What It Plans |
|---|---|---|
| `/ido4dev:plan-wave` | Hydro | Wave composition with epic integrity |
| `/ido4dev:plan-sprint` | Scrum | Sprint planning with type-aware capacity |
| `/ido4dev:plan-cycle` | Shape Up | Cycle betting with appetite constraints |

## /ido4dev:plan-wave (Hydro)

Composes waves following all 5 Hydro governance principles.

### What It Does

1. Calls `get_standup_data` for current project state
2. Identifies tasks ready for wave assignment
3. Groups tasks by epic (Epic Integrity)
4. Analyzes dependency chains (Dependency Coherence)
5. Estimates capacity using real throughput data from analytics
6. Assesses risk levels and AI suitability distribution
7. Validates the composed wave against all 5 principles
8. Presents a valid-by-construction wave plan

### Output

- Wave composition: which tasks go in which wave
- Epic groupings: showing integrity is maintained
- Dependency analysis: confirming all dependencies are satisfiable
- Capacity assessment: based on historical velocity
- Risk distribution: task risk levels and AI suitability breakdown
- Validation result: governance principle compliance

### When to Use

- Beginning of a new wave
- After a wave completion/retrospective
- When re-planning due to scope changes

## /ido4dev:plan-sprint (Scrum)

Sprint planning with type-aware capacity estimation.

### What It Does

1. Gathers project state and backlog
2. Filters for Product Backlog items ready to pull into a sprint
3. Checks DoR compliance per work item type (Stories need AC, Bugs need repro steps)
4. Estimates sprint capacity using velocity data
5. Respects dependency ordering
6. Presents sprint backlog recommendation

### Scrum-Specific Features

- **Type-aware DoR check**: Stories without acceptance criteria are flagged, not silently planned
- **Velocity-based capacity**: Uses real historical throughput, not story point estimates
- **Sprint goal alignment**: Prioritizes tasks that contribute to a cohesive sprint goal
- **Spillover detection**: Warns about unfinished work from previous sprint

## /ido4dev:plan-cycle (Shape Up)

Cycle planning with appetite-driven betting table.

### What It Does

1. Gathers shaped pitches (tasks in Shaped status)
2. Assesses appetite per bet (size: S/M/L/XL)
3. Evaluates risk levels (flags rabbit holes)
4. Checks cycle capacity against appetite budget
5. Considers cooldown pipeline (what's ready to bet on)
6. Presents betting table recommendation

### Shape Up-Specific Features

- **Appetite check**: Total appetite of bets must fit the cycle duration
- **Circuit breaker awareness**: Flags bets that were killed in previous cycles (potential re-bets)
- **Scope variable**: Recommends scope cuts when appetite is tight rather than extending time
- **Cooldown pipeline**: Shows what's available in the cooldown for the next cycle
