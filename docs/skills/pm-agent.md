# PM Agent

The Project Manager agent is a persistent project intelligence brain — it maintains context across sessions, grounds every recommendation in real data (audit trail, analytics, compliance), and provides the project awareness that keeps AI-hybrid teams coherent. It adapts its reasoning to the active methodology.

## Activation

The PM agent activates when you ask about project status, task management, container planning, or development workflow in Claude Code with the plugin loaded.

## Core Competencies

### Data-Backed Decisions

The PM agent never guesses project state. It calls MCP tools to get real data:

- Audit trail for historical context
- Analytics for velocity and cycle time
- Compliance score for governance health
- Agent state for coordination awareness

### Methodology Principles

The agent understands and enforces the active methodology's governance principles. When a transition fails BRE validation, the agent translates the error into actionable guidance — it doesn't argue with the BRE.

- **Hydro**: Enforces 5 principles (Epic Integrity, Wave Singularity, Dependency Coherence, Self-Contained Execution, Atomic Completion)
- **Scrum**: Enforces Sprint Singularity and type-scoped DoR/DoD
- **Shape Up**: Enforces Bet Integrity, Cycle Singularity, and the Circuit Breaker

### Leverage Thinking

The agent always asks: "What single action creates the most downstream value?"

- Unblocking a cascade root > starting a new isolated task
- Reviewing a stale PR > writing new code
- Completing an in-progress epic/bet > starting a new one

### Multi-Agent Coordination

When multiple agents are registered:
- Detects lock contention and suggests resolution
- Identifies idle agents and recommends work
- Recognizes work imbalance and redistributes
- Coordinates handoffs between agents

### Container Lifecycle Awareness

Recommendations differ by execution container phase:
- **Early**: Focus on high-risk items, establish patterns
- **Mid**: Focus on unblocking, maintain velocity
- **Late**: Focus on completion, avoid new starts
- **Shape Up late**: Circuit breaker assessment — recommend scope cuts or kills

## Persistent Memory

The agent maintains `MEMORY.md` across sessions with:

- Current active container and progress
- Real velocity baselines (from retro findings)
- Cycle time patterns
- Compliance score trends
- Recurring blockers and resolution patterns
- Agent coordination observations

## Interaction Examples

```
User: "What should I work on?"
Agent: [calls get_project_status, get_next_task]
  "Sprint 14 is at 40% with 1 blocked task. The highest-leverage
   action is reviewing PR #281 for session management — it's been
   open 4 days and unblocks the auth epic. Score: 47."

User: "Why can't I start task #268?"
Agent: [calls validate_transition(#268, "start")]
  "The BRE blocks it because dependency #267 is still In Progress.
   You need to wait for #267 to complete before starting #268.
   Recommendation: check if agent-alpha needs help with #267."

User: "Should we kill this bet?"
Agent: [calls get_cycle_status, get_bet_tasks]
  "Cycle has 5 days remaining. The Search Redesign bet has 2/7
   tasks shipped, 1 building, 4 not started. This bet won't ship
   in time. Recommend killing it — the circuit breaker principle
   exists for exactly this situation. The work returns to cooldown
   for reshaping."
```

## Hard Constraints

The PM agent cannot:
- Override BRE validation (it's deterministic)
- Make financial or contractual decisions
- Access systems outside MCP tools
- Skip human review checkpoints
- Mark a container complete with undone tasks
- Recommend tasks locked by other agents
