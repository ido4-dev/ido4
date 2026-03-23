# Quick Start

From zero to AI-hybrid development in under 5 minutes. Set up ido4 and give your AI agents full project context, task intelligence, and quality governance. This guide uses Hydro (wave-based) as the example — the flow is identical for Scrum and Shape Up, just with different terminology.

## 1. Initialize

```
> Initialize ido4 governance for my-org/my-project
```

ido4 creates a GitHub Project V2 with methodology-appropriate fields and statuses. Want Scrum or Shape Up instead? Just say so:

```
> Initialize ido4 with Scrum for my-org/my-project
> Initialize ido4 with Shape Up for my-org/my-project
```

**What gets created:**
- GitHub Project V2 linked to your repo
- Custom fields: Status, execution container (Wave/Sprint/Cycle), grouping container (Epic/Bet), Dependencies, AI Suitability, Risk Level, Effort, Task Type
- Status options matching your methodology's state machine
- `.ido4/` config directory

## 2. Create a task

```
> Create a task: "Build user authentication service"
>   Epic: Authentication, Wave: wave-001, Effort: L, Risk: HIGH
```

The task becomes a GitHub issue on your project board with all governance fields populated. It lives in GitHub — ido4 doesn't have its own database.

## 3. Load context and start working

Here's where ido4 earns its keep. Before an agent writes a single line of code, it loads full project context:

```
> Load context for task #42

get_task_execution_data:
  ✓ Task spec + acceptance criteria loaded
  ✓ Upstream: #38 built JWT refresh endpoint (RSA-256, 30min TTL)
  ✓ Upstream: #41 created user schema with bcrypt hashing
  ✓ Siblings: #39, #40 established error handling pattern
  ✓ Downstream: #45, #47 waiting on this task
  Risk: critical path — 3 of 5 remaining epic tasks depend on #42
```

The agent now knows what was built before, what patterns to follow, and who depends on its output. Then it starts, and the BRE validates:

```
> Start task #42

BRE Validation:
  + Task is in Ready for Dev
  + Dependencies #38, #41 both Done
  + Assigned to active wave
  + Epic integrity maintained
  + AI suitability: assisted (human review recommended)

Transitioning to In Progress.
```

If something's wrong, the transition is **blocked** — not warned, blocked:

```
> Start task #43

BLOCKED:
  ✗ Dependency #42 is In Progress, not Done

  You cannot start #43 until #42 is complete.
```

The BRE doesn't negotiate. Dependencies must be satisfied. Containers must be assigned. Integrity rules must hold.

## 4. Build and capture context

As the agent works, it writes structured context so the next agent inherits understanding:

```
> Review task #42 with context: "Built OAuth2 token rotation at
  /auth/rotate. Used sliding window TTL (not fixed) for active
  sessions. Circuit breaker shared with refresh endpoint."

BRE Validation: ✓ 3/3 steps passed
Context comment saved on GitHub issue #42.
Task #42 → In Review. PR #89 linked.
```

This is the read-execute-write loop: agents read accumulated context → build → write what they built → the next agent inherits everything. Knowledge compounds even though each agent is stateless.

## 5. The workflow

Work flows through your methodology's state machine. At every arrow, the BRE validates. At every transition, an audit event is recorded.

```
Ready for Dev --> In Progress --> In Review --> Done
                       |
                   Blocked
```

The exact states and transitions depend on your methodology — [Scrum has 6 states](../concepts/methodologies.md#scrum), [Shape Up has 8](../concepts/methodologies.md#shape-up). The governance pattern is the same.

## 6. See what's happening

```
> /ido4dev:standup
```

A governance-aware morning briefing: what's blocked, what's in review too long, which task has the highest cascade value, and the single highest-leverage action for the day. Every insight backed by real audit trail data.

```
> /ido4dev:health
```

Five-second verdict: **GREEN** (everything flowing), **YELLOW** (concerns), or **RED** (action needed).

## 7. Multi-agent setup

Running multiple AI agents? Register them:

```
> Register agent "agent-alpha" with capabilities: backend, data, API
```

Now `get_next_task` scores candidates across four dimensions — cascade value, momentum, capability match, and dependency freshness — and recommends the highest-leverage assignment for each agent.

When an agent finishes, `complete_and_handoff` atomically approves the task, releases the lock, identifies what got unblocked, and suggests the next assignment.

## What to try next

- **[Sandbox Demo](sandbox.md)** — See governance discover embedded violations in a real GitHub project, with methodology-specific scenarios for Hydro, Scrum, and Shape Up.
- **[Methodologies](../concepts/methodologies.md)** — Understand the differences between Hydro, Scrum, and Shape Up
- **[Business Rule Engine](../concepts/business-rule-engine.md)** — The 34 validation steps under the hood
- **[Skills](../skills/overview.md)** — 21 intelligent skills for governance, planning, and project intelligence
