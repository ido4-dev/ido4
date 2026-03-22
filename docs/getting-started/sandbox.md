# Sandbox Demo

The sandbox is the fastest way to experience ido4 governance. It creates a real GitHub Project V2 with tasks, containers, and **deliberately embedded governance violations** — then discovers them live using the same tools that govern real projects.

## Quick Start

The fastest path: `/ido4dev:onboard` handles everything — clones the demo codebase, creates the sandbox, and walks you through governance discovery.

```bash
# Launch Claude Code with ido4
claude --plugin-dir ./packages/plugin

# Zero-friction onboarding (recommended for first-time users)
> /ido4dev:onboard

# Or manual sandbox creation
> /ido4dev:sandbox
```

## Available Skills

| Skill | Purpose |
|---|---|
| `/ido4dev:onboard` | Zero-friction first touch — auto-clones demo, creates sandbox, guided discovery |
| `/ido4dev:sandbox` | Manual sandbox lifecycle — create, reset, destroy |
| `/ido4dev:guided-demo` | Four-act governance walkthrough (~15 minutes) |
| `/ido4dev:sandbox-explore` | Interactive exploration — pick what to investigate |

All three methodologies are supported: Hydro (wave-based), Scrum (sprint-based), Shape Up (cycle-based). The sandbox uses the same technical spec across all methodologies — demonstrating that one project can be governed by different profiles.

## What Gets Created

The sandbox uses ido4's own ingestion pipeline to create governed issues from a technical spec. Tasks are distributed algorithmically across containers with roles assigned from the dependency graph:

| Component | Details |
|---|---|
| **Tasks** | Created from a technical spec via the ingestion pipeline |
| **Capabilities** | Mapped to epics (Hydro/Scrum) or bets (Shape Up) |
| **Containers** | Waves, sprints, or cycles — methodology-specific execution units |
| **Governance violations** | Cascade blockers, false status, review bottlenecks, integrity violations |
| **Audit trail** | Backdated events creating realistic temporal history |
| **Agents** | Two registered agents with task locks and capability profiles |
| **Seeded PR** | Real code file for review bottleneck demonstration |

## Governance Violations

Each sandbox has methodology-appropriate violations that governance skills discover:

**All methodologies:**
- **Cascade blocker** — A critical-path task blocking multiple downstream tasks
- **False status** — A task shows "In Review" but has no pull request
- **Review bottleneck** — A PR open for days with zero reviewers

**Hydro-specific:**
- **Epic integrity violation** — A capability's tasks split across different waves

**Shape Up-specific:**
- **Circuit breaker countdown** — Cycle approaching deadline with incomplete bets
- **Killed bet** — Correct governance behavior when a bet isn't viable

## After the Demo

- `/ido4dev:sandbox-explore` — Try breaking rules, fixing violations, running work distribution
- `/ido4dev:standup` — Full governance standup briefing
- `/ido4dev:compliance` — Deep compliance analysis
- `/ido4dev:init` — Initialize ido4 on your own project
- `/ido4dev:sandbox cleanup` — Clean up: closes issues, deletes project, removes config
