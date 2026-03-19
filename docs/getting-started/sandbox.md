# Sandbox Demo

The sandbox is the fastest way to experience ido4 governance. It creates a real GitHub Project V2 with 20 tasks, 5 epics, 4 waves, and **5 deliberately embedded governance violations** — then discovers them live using the same tools that govern real projects.

## Running the Sandbox

```bash
# Launch Claude Code with ido4
claude --plugin-dir ./packages/plugin

# Start the sandbox
> /ido4:sandbox
```

The skill will ask which GitHub repository to use (format: `owner/repo`). It then:

1. **Creates** a GitHub Project V2 with 20 tasks across 5 epics and 4 waves
2. **Seeds** a pull request, temporal context comments, 28 audit events, and 2 registered agents
3. **Runs** live governance analysis, discovering all 5 violations in real-time
4. **Demonstrates** BRE enforcement — showing what's blocked and why
5. **Shows** intelligent work distribution and merge readiness gates

## What Gets Created

| Component | Count | Purpose |
|---|---|---|
| GitHub Issues | 20 | Tasks with full governance fields |
| Epics | 5 | Setup, Data Pipeline, Auth, Dashboard, Docs |
| Waves | 4 | Foundation (done), Core (active), Advanced, Polish |
| Pull Request | 1 | Seeded for review bottleneck detection |
| Audit Events | 28 | Realistic timeline for analytics and compliance |
| Agents | 2 | alpha (backend/data) + beta (frontend/auth) |

## The 5 Embedded Violations

### 1. Cascade Blocker
T7 (ETL transformations) is In Progress and blocks T8 (Data validation), which blocks T9 (API rate limiting). Three tasks — 30% of the active wave — chained to a single root cause.

### 2. False Status
T10 (Auth token service) is marked "In Review" but has no pull request. Status doesn't reflect reality.

### 3. Review Bottleneck
T12 (Session management) has a PR open for 4 days with zero reviews. Code is ready but sitting idle.

### 4. Epic Integrity Violation
The Auth epic has tasks in both wave-002 and wave-003 — RBAC was split out. This violates Principle 1 (all tasks in an epic must be in the same wave).

### 5. Stale Work
T7 has been In Progress for 4 days on an XL-effort, HIGH-risk task with no review submission.

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

Every finding comes from a real tool call. Nothing is hardcoded or simulated.
