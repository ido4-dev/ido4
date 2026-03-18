# Prompt Design Notes — Methodology-Specific Governance Reasoning

Internal design document. NOT published. Captures the governance reasoning
each methodology's prompts must embody.

## Core Principle

Each methodology's prompts encode its NATIVE governance reasoning, not
Hydro reasoning with different vocabulary. Same 6 prompt slots, completely
different analytical frameworks.

---

## Scrum — Sprint Goal-Driven Governance

### Daily Scrum (standup)
- Opens with Sprint Goal and progress toward it
- Burndown trajectory: on track / behind / ahead
- Impediments blocking Sprint Goal (not generic "blockers")
- Scope stability check: items added/removed mid-sprint?
- Sprint Goal achievement risk assessment
- DoD compliance for items marked "Done"
- No cascade analysis — sprint backlog is flat

### Sprint Planning (plan-sprint)
- Sprint Goal formulation FIRST (Topic 1: WHY)
- Velocity-based capacity: rolling 3-5 sprint average
- Focus factor adjustment (0.6-0.8 typical)
- PO priority ordering drives item selection (Topic 2: WHAT)
- DoR compliance check for candidate items
- Work decomposition into <1 day tasks (Topic 3: HOW)
- Capacity formula: velocity range * focus factor = planning ceiling
- No epic-first grouping — PO priority is the ordering principle

### Sprint Board (board)
- Sprint burndown chart interpretation (healthy slope vs warning patterns)
- Sprint Goal progress (not just task counts)
- Impediment count and aging
- Scope stability (items added after planning)
- Work Item Age vs cycle time SLE
- Not a kanban intelligence report — simpler, goal-focused

### Compliance
- DoD compliance (HIGHEST priority — items marked Done must meet DoD)
- DoR compliance (items entered sprint properly refined?)
- Sprint scope stability (no mid-sprint additions without removal)
- Scrum event cadence (all events happening?)
- Velocity consistency (no inflation: velocity up but throughput flat?)
- Carry-over rate (<20% healthy, >40% critical)
- Sprint Goal achievement rate (>80% over 5 sprints)
- Retrospective improvement follow-through

### Health
- Sprint Goal: on track / at risk / missed
- Burndown: tracking / behind / flat / hockey stick
- Carry-over rate trend
- DoD compliance rate
- Impediment count
- Velocity stability

### Retro
- Sprint Goal achieved? (binary — the key question)
- Velocity trend (3-5 sprint window)
- Carry-over analysis (what carried, why?)
- Cycle time per item type
- Focus factor trend
- What went well / what to improve / commitments
- Previous retro improvement follow-through
- Scrum event effectiveness

---

## Shape Up — Appetite-Driven, Hill Chart Governance

### Status Check (standup)
- Hill chart position for each scope in active bets
- Appetite consumption: days used / cycle length
- Scopes stuck uphill (haven't crested the hill — #1 risk signal)
- Circuit breaker proximity (days left vs uphill scope count)
- Scope count trajectory (growing = creep, stable/shrinking = hammering)
- NO daily cadence assumption — this is on-demand
- Bet-level progress, not task-level

### Betting Table (plan-cycle)
- Evaluate shaped pitches (Problem / Appetite / Solution / Rabbit Holes / No Gos)
- Cycle capacity: how many big-batch + small-batch bets?
- No backlog — fresh pitches only (flag stale re-pitches)
- Bet independence check (cross-bet dependencies are a design smell)
- Previous cycle ship rate as context
- Cooldown planning
- No dependency ordering — bets must be independent

### Hill Chart (board)
- Each bet's scopes plotted on the hill
- Uphill (figuring it out) vs downhill (making it happen)
- Scopes stuck uphill = primary finding
- Scope hammering signals (nice-to-haves being cut — healthy)
- Scope creep signals (new scopes appearing — unhealthy)
- Bet-level summary, not task-level detail
- Circuit breaker countdown

### Compliance
- Circuit breaker enforcement (HAS ANY BET BEEN EXTENDED? — highest priority)
- Appetite discipline (scope growing beyond appetite?)
- Shaping quality (pitches had problem/appetite/solution/rabbit holes/no gos?)
- Scope definition (are teams working in scopes or just tasks?)
- Cooldown utilization (productive or wasted?)
- No backlog accumulation (pitches discarded if not bet on?)

### Health
- Cycle progress: days remaining vs uphill scope ratio
- Bets: shipping / on track / at risk / likely to be killed
- Circuit breaker risk count
- Scope trajectory: hammering (good) vs creeping (bad)
- Ship rate trend (across cycles)

### Retro (Cycle Retrospective)
- Ship rate: what shipped vs what was killed
- For killed bets: was it the right call? Was shaping insufficient?
- Appetite accuracy: was the appetite right for what shipped?
- Hill chart accuracy: did uphill-to-downhill progression match expectations?
- Scope hammering effectiveness: was the right scope cut?
- Cooldown productivity
- Shaping improvement recommendations
