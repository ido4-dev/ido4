# Enterprise Features

ido4 provides the governance infrastructure that enterprise software delivery requires — compliance documentation, configurable methodology, quality gates, and full audit trails.

## Why Enterprise Teams Need Governance

Enterprise development teams are deploying AI coding agents at scale. The productivity gains are real, but so are the risks:

- **Compliance**: Regulated industries need proof that development processes were followed. "The AI did it" is not an acceptable audit response.
- **Consistency**: Multiple AI agents must follow the same methodology, not each agent's interpretation of it.
- **Accountability**: When something breaks in production, the audit trail must show exactly who (human or AI) did what, when, and whether the rules were followed.
- **Quality**: Speed without quality gates produces technical debt faster than any human team could.

ido4 addresses all four with deterministic enforcement, not guidelines.

## Compliance Reporting

### Deterministic Scoring

The compliance score is a 0-100 number computed from audit trail data across 5 weighted categories:

| Category | Weight | What It Measures |
|---|---|---|
| BRE Pass Rate | 40% | Transitions that passed validation without overrides |
| Quality Gates | 20% | PR reviews completed, test coverage met, scans clean |
| Process Adherence | 20% | Tasks following full workflow (start → review → approve) |
| Epic Integrity | 10% | Epics maintaining wave cohesion |
| Flow Efficiency | 10% | Active work time vs blocked/waiting time |

### Three-Part Assessment

The `/ido4:compliance` skill provides a comprehensive report:

1. **Quantitative**: Numerical score with per-category breakdown
2. **Structural**: Audit of all 5 governance principles with severity scoring
3. **Synthesis**: Cross-referenced findings with actor pattern analysis and recommendations

### Client-Ready Output

Every claim is backed by data. Every metric is derived from actual events. The compliance report provides the evidence that enterprise clients demand — who did what, when, and whether the rules were followed.

## Configurable Methodology

### Default: Wave-Based Development

ido4 ships with a wave-based methodology — tasks are organized into sequential waves with strict governance principles. This is the recommended approach for AI-augmented teams.

### Custom Methodologies

Teams can customize the BRE pipeline via `.ido4/methodology.json`:

```json
{
  "name": "custom-scrum",
  "transitions": {
    "start": {
      "steps": ["StatusTransition", "Dependency", "WaveAssignment"]
    },
    "approve": {
      "steps": [
        "StatusTransition",
        "PRReview:minApprovals=2",
        "TestCoverage:threshold=90",
        "SecurityScan"
      ]
    }
  },
  "principles": {
    "epicIntegrity": true,
    "activeWaveSingularity": true,
    "dependencyCoherence": true
  }
}
```

This allows enterprises to adopt ido4 with their existing methodology (Scrum, Kanban, SAFe) while getting deterministic enforcement.

## Quality Gates

### Built-in Gates

| Gate | What It Checks | Configurable |
|---|---|---|
| PR Review | Minimum approving reviews on linked PR | `PRReview:minApprovals=N` |
| Test Coverage | Coverage threshold from CI status checks | `TestCoverage:threshold=N` |
| Security Scan | Repository vulnerability alerts | `SecurityScan` |
| Task Lock | Warns if locked by another agent | `TaskLock` |

### Merge Readiness Gate

The `check_merge_readiness` tool runs 6 checks before approving a merge:

1. Workflow Compliance — full governance lifecycle followed
2. PR Review — required approvals present
3. Dependency Completion — all upstream work done
4. Epic Integrity — epic is cohesive within its wave
5. Security Gates — no vulnerability alerts
6. Compliance Threshold — project meets minimum score

### Emergency Overrides

Overrides are available for emergency situations — but they're audited:

```
check_merge_readiness(#42, overrideReason: "Critical hotfix approved by CTO")
→ READY (overridden) — audit event recorded, compliance score impacted
```

## Audit Trail

### Event Sourcing

Every governance action produces an immutable event:
- Append-only JSONL file (`.ido4/audit-log.jsonl`)
- In-memory ring buffer for fast session queries
- Queryable by time, actor, transition, issue, session

### What Gets Audited

- Every task state transition (with actor identity and validation results)
- Every work recommendation (agent, task, score breakdown)
- Every handoff (completed task, unblocked tasks, next assignment)
- Every governance override (reason, authorizer)

### Analytics from Events

Real metrics computed from the audit trail — no manual tracking:
- Cycle time (start → approve)
- Lead time (first activity → approve)
- Throughput (tasks per day)
- Blocking time (block → unblock duration)
- Wave velocity (delivery pace per wave)

## Multi-Agent Governance

Deploy multiple AI agents with confidence:

- **Unique identity** — Each agent has an ID, role, and capability profile
- **Task locking** — Exclusive access prevents conflicts
- **Work distribution** — 4-dimension scoring recommends optimal task assignments
- **Coordination state** — Full visibility into agent activity
- **Audit attribution** — Every action traced to a specific agent

## The Consultancy 2.0 Model

ido4 enables a new operating model: **2 senior humans + AI agents + governance = enterprise-scale delivery**.

| Traditional | With ido4 |
|---|---|
| 10-person team at $1.2-1.8M/year | 2 humans + AI agents at a fraction |
| Manual methodology compliance | Deterministic BRE enforcement |
| Retrospective compliance reports | Real-time compliance scoring |
| Single-agent workflows | Multi-agent coordination |
| Trust-based quality | Gate-enforced quality |

The competitive moat isn't the code — it's the methodology, the consulting model, and the institutional knowledge built through governance data over time.
