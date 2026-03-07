# /compliance

**Comprehensive compliance intelligence** — quantitative behavioral scoring, structural principle audit, and cross-referenced synthesis.

## Invocation

```
/ido4:compliance
```

## What It Does

The compliance skill performs a three-part assessment that goes far beyond a single score:

### Part 1: Quantitative Score

Calls `compute_compliance_score` and presents the numerical breakdown:

- Overall score (0-100) with letter grade
- Per-category scores: BRE pass rate, quality gates, process adherence, epic integrity, flow efficiency
- Contribution of each category to the total
- Actionable recommendations from the scoring engine

### Part 2: Structural Principle Audit

Examines each of the 5 governance principles against live project state:

| Principle | Check | Severity |
|---|---|---|
| Epic Integrity | Any epics split across waves? | PASS / WARN / FAIL |
| Active Wave Singularity | Only one active wave? | PASS / FAIL |
| Dependency Coherence | Any forward dependencies? | PASS / WARN / FAIL |
| Self-Contained Execution | Any external blockers? | PASS / WARN |
| Atomic Completion | Incomplete waves with leftover tasks? | PASS / WARN / FAIL |

### Part 3: Cross-Referenced Synthesis

Combines both perspectives:

- **Actor pattern analysis** — Which agent/user has the most overrides, blocks, or shortcuts?
- **Temporal trends** — Is compliance improving or degrading over the last 3 waves?
- **Prioritized recommendations** — What to fix first for maximum compliance improvement

## Output Persistence

Compliance findings are persisted to `MEMORY.md` in a structured `--- FINDINGS ---` block. This enables:

- Future standups to reference compliance history
- Plan-wave to incorporate compliance context
- PM Agent to track compliance trends across sessions

## Example Output

```
COMPLIANCE ASSESSMENT

PART 1 — QUANTITATIVE SCORE
  Score: 92/100 (A)
  BRE Pass Rate:      95% (38.0/40)
  Quality Gates:      88% (17.6/20)
  Process Adherence:  90% (18.0/20)
  Epic Integrity:    100% (10.0/10)
  Flow Efficiency:    84%  (8.4/10)

PART 2 — STRUCTURAL AUDIT
  Epic Integrity:           FAIL — Auth epic split (wave-002 + wave-003)
  Active Wave Singularity:  PASS
  Dependency Coherence:     PASS
  Self-Contained Execution: PASS
  Atomic Completion:        PASS

PART 3 — SYNTHESIS
  The quantitative score (92/A) and structural audit diverge on
  epic integrity. The score shows 100% because no epic-splitting
  transitions occurred this period — but the split already exists
  from a prior assignment. This is a structural debt, not a
  behavioral one.

  Recommendation: Move #276 (RBAC) from wave-003 to wave-002 to
  restore Auth epic integrity. This is the single highest-impact
  compliance action available.
```
