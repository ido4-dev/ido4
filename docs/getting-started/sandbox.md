# Sandbox Demo

The sandbox is the fastest way to experience ido4 governance. It creates a real GitHub Project V2 with tasks, containers, and **deliberately embedded governance violations** — then discovers them live using the same tools that govern real projects.

ido4 provides methodology-specific sandbox variants so you can experience governance in the methodology you plan to use.

## Available Sandboxes

| Skill | Methodology | Tasks | Containers | Violations |
|---|---|---|---|---|
| `/ido4:sandbox` | Hydro (default) | 20 | 4 Waves, 5 Epics | 5 |
| `/ido4:sandbox-hydro` | Hydro | 20 | 4 Waves, 5 Epics | 5 |
| `/ido4:sandbox-scrum` | Scrum | 20 | 3 Sprints, 4 Epics | 5 |
| `/ido4:sandbox-shape-up` | Shape Up | 15 | 1 Cycle, 3 Bets | 5 |

## Running the Sandbox

```bash
# Launch Claude Code with ido4
claude --plugin-dir ./packages/plugin

# Start the default sandbox (Hydro)
> /ido4:sandbox

# Or pick a specific methodology
> /ido4:sandbox-scrum
> /ido4:sandbox-shape-up
```

The skill will ask which GitHub repository to use (format: `owner/repo`). It then:

1. **Creates** a GitHub Project V2 with tasks and methodology-appropriate containers
2. **Seeds** pull requests, temporal context comments, audit events, and registered agents
3. **Runs** live governance analysis, discovering all violations in real-time
4. **Demonstrates** BRE enforcement — showing what's blocked and why
5. **Shows** intelligent work distribution and merge readiness gates

## Hydro Sandbox

20 tasks across 5 epics and 4 waves. The sandbox demonstrates wave-based governance with epic integrity enforcement.

### What Gets Created

| Component | Count | Purpose |
|---|---|---|
| GitHub Issues | 20 | Tasks with full governance fields |
| Epics | 5 | Setup, Data Pipeline, Auth, Dashboard, Docs |
| Waves | 4 | Foundation (done), Core (active), Advanced, Polish |
| Pull Request | 1 | Seeded for review bottleneck detection |
| Audit Events | 28 | Realistic timeline for analytics and compliance |
| Agents | 2 | alpha (backend/data) + beta (frontend/auth) |

### The 5 Embedded Violations

1. **Cascade Blocker** — T7 blocks T8, which blocks T9. Three tasks chained to a single root cause.
2. **False Status** — T10 is marked "In Review" but has no pull request.
3. **Review Bottleneck** — T12 has a PR open for 4 days with zero reviews.
4. **Epic Integrity Violation** — Auth epic has tasks in both wave-002 and wave-003.
5. **Stale Work** — T7 has been In Progress for 4 days with no review submission.

## Scrum Sandbox

20 tasks across 4 epics and 3 sprints. The sandbox demonstrates sprint-based governance with type-scoped pipelines.

### Scrum-Specific Violations

- **Sprint spillover** — Tasks from Sprint 13 not completed, carried into Sprint 14
- **Story without acceptance criteria** — User story planned into sprint without DoR checks
- **Spike past timebox** — Research spike In Progress for 5 days without findings
- **Type mismatch** — Bug classified as story, getting wrong pipeline

## Shape Up Sandbox

15 tasks across 3 bets in 1 cycle. The sandbox demonstrates fixed-time governance with the circuit breaker.

### Shape Up-Specific Violations

- **Appetite exceeded** — Bet scope has grown beyond original pitch appetite
- **Circuit breaker countdown** — Cycle approaching deadline with incomplete bets
- **Scope creep** — New tasks added mid-cycle outside original pitch
- **Bet integrity violation** — Task assigned to wrong cycle
- **Stale building** — Task stuck in Building status for half the cycle

## After the Demo

The sandbox offers three options:

- **Keep** — Continue experimenting. Run other skills (`/ido4:standup`, `/ido4:compliance`, `/ido4:board`), attempt transitions, modify task states — watch how governance responds.
- **Reset** — Destroy and recreate fresh for another demo.
- **Destroy** — Clean up everything: closes all issues, deletes the PR and branch, removes the project and config.

## What You'll See

The sandbox demonstrates every layer of the governance stack:

- **BRE validation** — Watch 32 validation steps evaluate transitions (configurable per methodology profile)
- **Work distribution** — See 4-dimension scoring differentiate task recommendations
- **Merge readiness** — See the 6-check gate catch process violations
- **Audit trail** — Real event-sourced data powering analytics and compliance
- **Multi-agent coordination** — Two agents with different capabilities getting different recommendations
- **Methodology-specific governance** — Epic integrity (Hydro), type-scoped DoR/DoD (Scrum), circuit breaker (Shape Up)

Every finding comes from a real tool call. Nothing is hardcoded or simulated.
