# /plan-wave

**Principle-aware wave composition engine** that produces a valid-by-construction wave plan respecting all 5 Hydro governance principles. For Scrum sprint planning or Shape Up cycle planning, see [Planning Skills](planning.md).

## Invocation

```
/ido4dev:plan-wave
/ido4dev:plan-wave wave-003-advanced
```

## What It Does

The plan-wave skill composes the next development wave by enforcing governance constraints from the start — not validating after the fact:

1. **Epic-first grouping** — Groups candidate tasks by epic to ensure Epic Integrity (Principle 1)
2. **Dependency analysis** — Ensures all dependencies are satisfiable within the wave or already complete (Principles 3 & 4)
3. **Capacity estimation** — Uses real throughput data from analytics (not guesses)
4. **Risk assessment** — Considers task risk levels and AI suitability
5. **Compliance context** — Current score informs planning conservatism
6. **Validation** — Verifies the composed wave satisfies all 5 principles before presenting

## Output Format

```
WAVE PLAN: wave-003-advanced

CAPACITY BASIS: 1.4 tasks/day (wave-002 throughput) × 10 working days = ~14 tasks
COMPLIANCE CONTEXT: 92/A — maintaining high standard

EPIC GROUPS:
  Dashboard (E4): 3 tasks
    #275 Dashboard layout (M, MEDIUM risk) — no deps in this wave
    #277 Widget framework (L, LOW risk) — depends on #275
    #278 Analytics display (M, MEDIUM risk) — depends on #277
    Rationale: all 3 tasks are self-contained, sequential dependency chain

  Authentication (E3 — carry-forward):
    #276 RBAC (L, HIGH risk) — moved from wave-002 to restore epic integrity
    Rationale: fixes the epic split violation detected in compliance audit

GOVERNANCE CONSTRAINTS APPLIED:
  ✓ Epic Integrity — no epics split across waves
  ✓ Dependency Coherence — all deps in prior waves or within this wave
  ✓ Self-Contained — wave is completable without external blockers
  ✓ Capacity — 4 tasks within estimated throughput

DEFERRED (insufficient capacity or unresolved blockers):
  None — all candidate tasks fit within capacity
```

## Key Behavior

- **Never splits an epic** — If an epic's tasks can't all fit, the entire epic is deferred
- **Fixes known violations** — References compliance findings to resolve existing issues (like the Auth epic split)
- **Uses real data** — Throughput estimates come from `get_analytics`, not arbitrary numbers
- **Validates before presenting** — The plan is valid-by-construction, not validated after the fact
