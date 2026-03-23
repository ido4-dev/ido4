---
title: "Enterprise Features"
---

ido4 provides the infrastructure that enterprise AI-hybrid development requires — context intelligence for every agent session, institutional memory that compounds across teams, compliance documentation, configurable methodology, quality gates, and full audit trails. All features work across all three built-in methodologies (Hydro, Scrum, Shape Up) and custom profiles.

## Why Enterprise Teams Need More Than AI Agents

Enterprise development teams are deploying AI coding agents at scale. The productivity gains are real, but agents alone don't scale:

- **Context**: Every AI session starts from scratch. No knowledge of prior work, no understanding of dependencies, no institutional memory. At enterprise scale, this means agents repeatedly rediscover what others already built.
- **Coordination**: Multiple AI agents must work coherently — understanding who's building what, what's blocked, and where the highest-leverage work is.
- **Compliance**: Regulated industries need proof that development processes were followed. "The AI did it" is not an acceptable audit response.
- **Consistency**: Multiple AI agents must follow the same methodology, not each agent's interpretation of it.
- **Quality**: Speed without quality gates produces technical debt faster than any human team could.

ido4 addresses all five — context intelligence, coordination, compliance, consistency, and quality — with a platform that empowers agents rather than constraining them.

## Compliance Reporting

### Deterministic Scoring

The compliance score is a 0-100 number computed from audit trail data. The category weights vary by methodology:

| Category | Hydro | Scrum | Shape Up |
|---|---|---|---|
| BRE Pass Rate | 40% | 40% | 35% |
| Quality Gates | 20% | 25% | 25% |
| Process Adherence | 20% | 25% | 20% |
| Container Integrity | 10% | -- | 10% |
| Flow Efficiency | 10% | 10% | 10% |

### Three-Part Assessment

The `/ido4dev:compliance` skill provides a comprehensive report:

1. **Quantitative**: Numerical score with per-category breakdown
2. **Structural**: Audit of all governance principles with severity scoring
3. **Synthesis**: Cross-referenced findings with actor pattern analysis and recommendations

### Client-Ready Output

Every claim is backed by data. Every metric is derived from actual events. The compliance report provides the evidence that enterprise clients demand.

## Configurable Methodology

### Three Built-in Profiles

| Profile | Key Feature | Tool Count |
|---|---|---|
| Hydro | Wave-based governance with epic integrity | 58 |
| Scrum | Sprint-based with type-scoped DoR/DoD | 56 |
| Shape Up | Cycle-based with circuit breaker | 54 |

### Profile Inheritance

Custom profiles extend built-in ones:

```json
{
  "extends": "hydro",
  "id": "enterprise-strict",
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

Override only what you need. Everything else inherits from the base profile. See [Configurable Methodology](methodology.md) for full details.

## Quality Gates

### Built-in Gates

| Gate | What It Checks | Configurable |
|---|---|---|
| PR Review | Minimum approving reviews on linked PR | `PRReviewValidation:minApprovals=N` |
| Test Coverage | Coverage threshold from CI status checks | `TestCoverageValidation:threshold=N` |
| Security Scan | Repository vulnerability alerts | `SecurityScanValidation` |
| Task Lock | Warns if locked by another agent | `TaskLockValidation` |

### Merge Readiness Gate

The `check_merge_readiness` tool runs 6 checks before approving a merge:

1. Workflow Compliance — full governance lifecycle followed
2. PR Review — required approvals present
3. Dependency Completion — all upstream work done
4. Container Integrity — epic/bet cohesion maintained
5. Security Gates — no vulnerability alerts
6. Compliance Threshold — project meets minimum score

### Emergency Overrides

Overrides are available — but audited:

```
check_merge_readiness(#42, overrideReason: "Critical hotfix approved by CTO")
-> READY (overridden) -- audit event recorded, compliance score impacted
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

Real metrics computed from the audit trail:
- Cycle time (start -> approve/ship)
- Lead time (first activity -> approve/ship)
- Throughput (tasks per day)
- Blocking time (block -> unblock duration)
- Container velocity (delivery pace per wave/sprint/cycle)

## Multi-Agent Governance

Deploy multiple AI agents with confidence:

- **Unique identity** — Each agent has an ID, role, and capability profile
- **Task locking** — Exclusive access prevents conflicts (30min TTL)
- **Work distribution** — 4-dimension scoring recommends optimal assignments
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
| One-size-fits-all methodology | Profile-driven, configurable |
