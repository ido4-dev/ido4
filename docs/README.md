# ido4

**Your AI agents write code. ido4 gives them shared understanding, institutional memory, and quality enforcement.**

ido4 is the MCP server that makes AI-hybrid software development work at scale. It sits inside your AI coding environment and gives every session full project context — what to build, what was built before, who depends on your output. Deterministic governance validates every action. Institutional memory compounds knowledge across sessions. Task intelligence ensures agents focus on the highest-leverage work.

```
Agent: "Start task #42"

ido4 BRE:
  + Dependencies satisfied (#38, #41 both Done)
  + Assigned to active sprint
  + Spec has acceptance criteria
  + AI suitability: assisted (human review required)

  Transitioning to In Progress.
  3 downstream tasks will unblock when this ships.
```

Every state change validated. Every decision audited. Every agent coordinated.

## Why ido4 exists

AI coding agents are powerful but stateless. Each session starts fresh — no memory of what other agents built, no understanding of your methodology, no awareness of dependencies or deadlines.

ido4 solves this by being the **governance layer** between your agents and your project:

- **32 validation steps** enforce your workflow before any status changes
- **Full audit trail** records who did what, when, and whether the rules were followed
- **Context delivery** assembles upstream decisions, downstream needs, and sibling progress into a single call
- **Multi-agent coordination** with task locking, intelligent work distribution, and handoff
- **Three methodologies** built in — or bring your own

## Pick your methodology

ido4 is methodology-agnostic. The engine reads profiles; profiles define everything.

**Hydro** — Wave-based delivery with epic integrity. All tasks in an epic ship together. Five governance principles. Built for AI-augmented consulting teams.

**Scrum** — Sprint-based execution with type-scoped pipelines. User stories need acceptance criteria. Bugs skip dependency checks. Spikes have relaxed DoD. Tech debt requires 2 reviewers.

**Shape Up** — Fixed time, variable scope. Six-week cycles with a circuit breaker — if a bet doesn't ship by deadline, it's killed. No extensions. Scope gets hammered, not timelines.

```
> Initialize ido4 with Scrum for my-org/my-project
```

That's it. ido4 creates the GitHub Project, sets up fields and statuses matching your methodology, and starts governing.

## What you get

**57 MCP tools** (Hydro) / 56 (Scrum) / 53 (Shape Up) — generated dynamically from your methodology profile. Every write tool validates through the BRE, supports dry-run, and creates an audit entry.

**18 skills** — intelligent governance workflows. Morning standup that spots cascade blockers. Sprint planning that enforces Definition of Ready per work item type. Retrospectives with real cycle time data, not feelings.

**4 agents** — a PM agent with persistent memory, a code analyzer for spec decomposition, a technical spec writer, and a spec reviewer.

## Quick links

| I want to... | Go here |
|---|---|
| Get running in 5 minutes | [Installation](getting-started/installation.md) |
| See governance in action | [Sandbox Demo](getting-started/sandbox.md) |
| Understand the methodology options | [Methodologies](concepts/methodologies.md) |
| See all available tools | [Tool Reference](reference/tools.md) |
| Learn how the BRE works | [Business Rule Engine](concepts/business-rule-engine.md) |
| Set up multiple AI agents | [Multi-Agent Governance](concepts/multi-agent.md) |
| Configure for enterprise | [Enterprise Features](enterprise/overview.md) |
| Look up a term | [Glossary](concepts/glossary.md) |
