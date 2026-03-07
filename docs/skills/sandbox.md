# /sandbox

**Interactive governance demo** — creates a real GitHub project with embedded violations, then discovers them live using the same tools that govern real projects.

## Invocation

```
/ido4:sandbox
```

## What It Creates

| Component | Count | Purpose |
|---|---|---|
| GitHub Issues | 20 | Tasks with full governance fields |
| Epics | 5 | Setup, Data Pipeline, Auth, Dashboard, Docs |
| Waves | 4 | Foundation (done), Core (active), Advanced, Polish |
| Pull Request | 1 | For review bottleneck detection |
| Audit Events | 28 | Realistic timeline for analytics |
| Agents | 2 | alpha (backend/data) + beta (frontend/auth) |
| Context Comments | 5 | Temporal dimension on key tasks |

## The 5 Embedded Violations

1. **Cascade blocker** — T7→T8→T9, 3 tasks chained to one root cause
2. **False status** — T10 "In Review" with no PR
3. **Review bottleneck** — T12 PR open 4 days, 0 reviews
4. **Epic integrity** — Auth epic split across wave-002 and wave-003
5. **Stale work** — T7 In Progress for 4 days, XL effort, HIGH risk

## Demo Flow

### Phase 1: Setup
Creates the sandbox and seeds all data (2-3 minutes).

### Phase 2: Live Governance Analysis
The skill runs governance tools and narrates each finding:
- Wave status overview
- Cascade blocker discovery via `analyze_dependencies`
- Review integrity check via `find_task_pr` + `get_pr_reviews`
- Epic integrity analysis via `list_tasks` grouping
- Work distribution via `get_next_task` for both agents
- Merge readiness gate via `check_merge_readiness`

### Phase 3: BRE Enforcement Gauntlet
Demonstrates that governance is enforcement, not visibility:
- Shows all transitions blocked for a blocked task (except `unblock`)
- Shows valid transitions allowed for a ready task
- Proves the BRE is deterministic and cannot be bypassed

### Cleanup
- **Keep** — Continue experimenting with other skills
- **Reset** — Destroy and recreate fresh
- **Destroy** — Close all issues, delete PR, remove project

## Use Cases

- **Onboarding** — New team members experience governance firsthand
- **Sales demos** — Show governance to potential clients/investors
- **Skill testing** — Validate skills against a known scenario
- **Training** — Practice governance workflows in a safe environment
