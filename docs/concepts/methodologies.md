# Methodologies

ido4 doesn't force a methodology on you. It ships three — pick the one that fits how your team works, or extend one to make it yours.

The engine is methodology-agnostic. Methodologies are **profiles** — data structures that define states, transitions, containers, validation pipelines, and principles. The engine reads the profile and generates everything dynamically: tools, prompts, BRE pipelines, compliance scoring. Zero methodology-specific code in the engine.

## Hydro

**For teams that ship features whole.**

Hydro organizes work into **waves** — self-contained delivery units executed one at a time. Related tasks group into **epics**, and the defining rule is: all tasks in an epic must be in the same wave. You don't ship half a feature.

This is the methodology built for AI-augmented consulting — where a small senior team governs multiple AI agents delivering complete features to enterprise clients.

### Why Hydro

- **Epic Integrity** prevents partial feature delivery — no shipping auth tokens in wave-002 and RBAC in wave-003
- **Wave sequencing** gives clear execution order with dependency coherence
- **Five principles** provide comprehensive governance without methodology overhead
- **Refinement pipeline** (Backlog -> In Refinement -> Ready for Dev) ensures tasks are well-specified before agents touch them

### The workflow

```
Backlog -> In Refinement -> Ready for Dev -> In Progress -> In Review -> Done
                                                   |
                                               Blocked
```

7 states, 9 transitions (including backward transitions and administrative completion).

### Containers

| Container | Role | Key Rule |
|---|---|---|
| **Wave** | When work happens | Only one active at a time. Named `wave-001-auth-system`. |
| **Epic** | What ships together | All tasks in an epic must share the same wave. |

### The five principles

1. **Epic Integrity** — All tasks in an epic, same wave. Non-negotiable.
2. **Active Wave Singularity** — One wave at a time. Focus.
3. **Dependency Coherence** — Can't build floor two before the foundation.
4. **Self-Contained Execution** — Every wave has everything it needs.
5. **Atomic Completion** — A wave at 90% is not complete.

### 57 tools

---

## Scrum

**For teams with different types of work.**

Scrum organizes work into **sprints** with a defining feature that sets it apart: **type-scoped validation pipelines**. User stories, bugs, spikes, and tech debt each get different quality gates. A story needs acceptance criteria before entering the sprint. A spike doesn't need PR approval to close. Tech debt requires two reviewers.

This isn't Scrum with governance bolted on — it's Scrum where the Definition of Ready and Definition of Done are enforced by code, not by team norms.

### Why Scrum

- **Type-scoped DoR/DoD** — Different work deserves different validation. The BRE knows the difference.
- **Epics span sprints** — Unlike Hydro, there's no epic-sprint integrity rule. An epic can take three sprints. That's normal.
- **Familiar terminology** — Product Backlog, Sprint Backlog, User Stories. Your team already knows this.
- **Lightweight governance** — One principle (Sprint Singularity) plus type-aware pipelines. Not five principles — just the ones that matter for sprint execution.

### The workflow

```
Product Backlog -> Sprint Backlog -> In Progress -> In Review -> Done
                                          |
                                      Blocked
```

6 states, 8 transitions.

### Containers

| Container | Role | Key Rule |
|---|---|---|
| **Sprint** | When work happens | Only one active. Named `Sprint 14`. |
| **Epic** | Long-running themes | Spans sprints freely. No integrity constraint. |

### Type-scoped pipelines

This is Scrum's superpower in ido4:

| Work Item | Planning (DoR) | Approval (DoD) |
|---|---|---|
| **User Story** | Needs acceptance criteria + effort estimate | Standard approval + context |
| **Bug** | Needs reproduction steps | Standard (skips dependency check on start) |
| **Spike** | Minimal — just the status transition | Relaxed — no PR approval needed |
| **Tech Debt** | Standard | Requires **2 PR reviewers** |
| **Chore** | Standard | Standard |

The BRE checks `plan:story`, `plan:bug`, `plan:spike` as separate pipelines. Different work, different gates.

### 56 tools

---

## Shape Up

**For teams that bet on outcomes, not tasks.**

Shape Up works in fixed **cycles** (default 6 weeks) where teams commit to **bets** — shaped pitches with defined appetite. The defining discipline: the **circuit breaker**. If a bet doesn't ship by cycle end, it's killed. No extensions. No carry-over. Scope gets hammered, not timelines.

This forces honesty about scope — and it's the only methodology in ido4 with two terminal states: **Shipped** and **Killed**. Both are valid outcomes.

### Why Shape Up

- **Circuit breaker** kills runaway projects before they eat your roadmap
- **Fixed appetite** means time is the constraint, scope is the variable. Agents cut scope, not quality.
- **Shaping pipeline** (Raw Idea -> Shaped -> Bet On) ensures work is well-understood before building starts
- **Killed bets are healthy** — they mean the governance worked, not that the team failed

### The workflow

```
Raw Idea -> Shaped -> Bet On -> Building -> QA -> Shipped
                                  |              |
                              Blocked        Killed
```

8 states, 10 transitions. The `kill` transition is available from Building, QA, and Blocked — the circuit breaker can fire at any point.

### Containers

| Container | Role | Key Rule |
|---|---|---|
| **Cycle** | Fixed time period | 6 weeks. Only one active. Named `cycle-001-notifications`. |
| **Bet** | Committed pitch | All tasks in a bet share the same cycle. |
| **Scope** | Optional sub-grouping | Within a bet. Not managed by governance. Emerges during building. |

### Four principles

1. **Bet Integrity** — All tasks in a bet, same cycle.
2. **Active Cycle Singularity** — One cycle at a time.
3. **Circuit Breaker** — Unfinished at cycle end = killed. No extensions.
4. **Fixed Appetite** — Time fixed, scope variable.

### 53 tools

---

## Choosing

| Question | Hydro | Scrum | Shape Up |
|---|---|---|---|
| Do features need to ship whole? | Yes — Epic Integrity | No — epics span sprints | Yes — Bet Integrity |
| Different quality gates per work type? | No | **Yes** — type-scoped pipelines | No |
| What happens to unfinished work? | Stays in wave until done | Carries over to next sprint | **Killed** by circuit breaker |
| How many governance principles? | 5 | 1 | 4 |
| Shaping/refinement pipeline? | 2-stage (refine, ready) | 1-stage (plan) | 2-stage (shape, bet) |
| Terminal states | Done | Done | Shipped, Killed |

---

## How profiles work

A methodology profile defines everything the engine needs:

| Section | What It Controls |
|---|---|
| `states` | Workflow states with categories (todo, active, done, blocked) |
| `transitions` | Valid state changes with source/target mappings |
| `containers` | Container types with singularity, completion rules, naming |
| `integrityRules` | Relationships between containers |
| `principles` | Named governance rules with enforcement mechanisms |
| `workItems` | Work item types with lifecycle overrides |
| `pipelines` | BRE validation steps per transition (and per type) |
| `compliance` | Expected lifecycle and scoring weights |

The engine generates tools, prompts, and validation pipelines from this profile. Changing methodology = changing the profile, not the code.

## Custom profiles

Extend a built-in profile and override what you need:

```json
{
  "extends": "scrum",
  "id": "my-team",
  "pipelines": {
    "approve": {
      "steps": [
        "StatusTransitionValidation:DONE",
        "ApprovalRequirementValidation",
        "PRReviewValidation:2",
        "TestCoverageValidation:90",
        "SecurityScanValidation"
      ]
    }
  }
}
```

Everything else inherits from Scrum. See [Configurable Methodology](../enterprise/methodology.md) for full details.

## At a glance

| | Hydro | Scrum | Shape Up |
|---|---|---|---|
| States | 7 | 6 | 8 |
| Transitions | 9 | 8 | 10 |
| Containers | 2 | 2 | 3 |
| Integrity Rules | 2 | 0 | 1 |
| Principles | 5 | 1 | 4 |
| Work Item Types | 5 | 5 | 1 |
| Type-Scoped Pipelines | No | Yes | No |
| Terminal States | 1 | 1 | 2 |
| MCP Tools | 57 | 56 | 53 |
