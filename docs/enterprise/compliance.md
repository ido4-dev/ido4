# Compliance Reporting

ido4's compliance system provides deterministic, data-backed reporting that enterprise clients require. Every metric is computed from the audit trail — the same event log that powers context assembly, analytics, and institutional memory. No manual tracking, no estimation, no self-reported data.

## Compliance Score

### How It Works

The `compute_compliance_score` tool analyzes audit trail events and produces a 0-100 score:

```
compute_compliance_score(waveName: "wave-002-core")
```

### 5 Weighted Categories

| Category | Weight | Measures | Data Source |
|---|---|---|---|
| **BRE Pass Rate** | 40% | % of transitions passing BRE without overrides | Audit: `task.transition` events |
| **Quality Gates** | 20% | PR reviews done, coverage met, scans clean | GitHub API via repositories |
| **Process Adherence** | 20% | Tasks following full workflow (start→review→approve) | Audit: transition sequence analysis |
| **Container Integrity** | 0-10% | Grouping containers maintaining execution container cohesion (Hydro: 10%, Shape Up: 10%, Scrum: 0% — redistributed) | Project state: container mapping |
| **Flow Efficiency** | 10% | Active work time vs blocked/waiting time | Audit: block/unblock intervals |

### Letter Grades

| Score | Grade | Interpretation |
|---|---|---|
| 90-100 | A | Excellent — methodology consistently followed |
| 80-89 | B | Good — minor gaps, no systemic issues |
| 70-79 | C | Acceptable — some process shortcuts detected |
| 60-69 | D | Concerning — significant governance gaps |
| 0-59 | F | Failing — methodology not being followed |

### Example Output

```json
{
  "score": 92,
  "grade": "A",
  "categories": {
    "brePassRate": { "score": 95, "weight": 40, "contribution": 38.0 },
    "qualityGates": { "score": 88, "weight": 20, "contribution": 17.6 },
    "processAdherence": { "score": 90, "weight": 20, "contribution": 18.0 },
    "epicIntegrity": { "score": 100, "weight": 10, "contribution": 10.0 },
    "flowEfficiency": { "score": 84, "weight": 10, "contribution": 8.4 }
  },
  "recommendations": [
    "Review PR turnaround — 2 PRs waited >3 days",
    "T8 has been blocked for 3 days — investigate root cause"
  ]
}
```

## The /compliance Skill

The `/ido4:compliance` skill provides a three-part assessment:

### Part 1: Quantitative Score

Calls `compute_compliance_score` and presents the numerical breakdown. This is the "what" — a data-driven snapshot.

### Part 2: Structural Audit

Examines each governance principle defined in the active methodology profile:

- **Hydro (5 principles)**: Epic Integrity, Active Wave Singularity, Dependency Coherence, Self-Contained Execution, Atomic Completion
- **Scrum (1 principle)**: Sprint Singularity
- **Shape Up (4 principles)**: Bet Integrity, Active Cycle Singularity, Circuit Breaker, Fixed Appetite

Each principle gets a severity score: PASS, WARN, or FAIL.

### Part 3: Cross-Referenced Synthesis

Combines quantitative and structural findings:

- Actor pattern analysis (which agent/user has the most overrides?)
- Temporal trends (is compliance improving or degrading?)
- Prioritized recommendations (what to fix first for maximum impact)

## Client Delivery

A compliance report for an enterprise client includes:

1. **Score card** — 92/A with per-category breakdown
2. **Principle audit** — All active methodology principles assessed with evidence
3. **Audit evidence** — Every transition with actor, timestamp, and validation results
4. **Velocity metrics** — Real throughput and cycle time data
5. **Recommendations** — Actionable items ranked by impact

Every claim is verifiable. Every metric has a paper trail. This is the compliance documentation that regulated industries need.
