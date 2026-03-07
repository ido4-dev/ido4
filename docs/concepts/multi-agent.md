# Multi-Agent Governance

ido4 is built for teams deploying multiple AI coding agents on the same codebase. Without coordination, multiple agents produce duplicate work, conflicting changes, and cascade failures. ido4 provides the governance layer that makes multi-agent development safe and efficient.

## Agent Registration

Each AI agent registers with a unique identity, role, and capability profile:

```
register_agent("agent-alpha", "Alpha", role: "coding", capabilities: ["backend", "data", "etl"])
register_agent("agent-beta", "Beta", role: "coding", capabilities: ["frontend", "auth", "security"])
```

Agent profiles are used for:
- **Audit trail** — Every action is attributed to a specific agent
- **Task locking** — Exclusive access to prevent conflicts
- **Work distribution** — Capability-matched recommendations
- **Coordination** — Awareness of what other agents are doing

## Task Locking

Before an agent starts working on a task, it acquires an exclusive lock:

```
lock_task(#42, agentId: "agent-alpha")
→ Lock acquired. Expires in 30 minutes.
```

Locks prevent duplicate effort:
- Only one agent can hold a lock on a task
- Locks expire after 30 minutes (configurable)
- Agents can heartbeat to extend locks
- The `TaskLockValidation` BRE step warns when a task is locked by another agent

## Intelligent Work Distribution

The `get_next_task` tool recommends the highest-leverage task for each agent. It scores candidates across 4 dimensions:

### Cascade Value (0-40 points)

How many downstream tasks does completing this task unblock? A task that unblocks 3 others has higher cascade value than a task with no dependents.

```
#273 Data export → unblocks #274 Batch processing
cascade = 15 (1 dependent at depth 1)
```

### Epic Momentum (0-25 points)

Is the task's epic close to completion? Finishing in-progress epics is more valuable than starting new ones.

```
Epic "Data Pipeline": 2 of 7 tasks done (28%)
epic momentum = 7
```

### Capability Match (0-20 points)

Does the agent's declared role and capabilities match the task?

```
agent-beta capabilities: [auth, security]
Task: "OAuth integration"
capability match = 13 (title contains "OAuth" → auth match)
```

### Dependency Freshness (0-15 points)

Was a dependency recently completed? Tasks whose dependencies just finished have momentum — the context is fresh, the patterns are established.

```
Task #273 depends on #266 (Data ingestion)
#266 was approved 6 hours ago
freshness = 15 (within 24-hour window)
```

### Scoring Example

```
get_next_task("agent-alpha")

#273 Data export       score:50  cascade:15 epic:7  cap:13 fresh:15
#274 Batch processing  score:17  cascade:0  epic:7  cap:10 fresh:0
#271 OAuth integration score:10  cascade:0  epic:0  cap:10 fresh:0
```

Every score is deterministic — computed from dependency graphs, epic completion ratios, agent capability vectors, and audit trail timestamps. No LLM reasoning involved.

## Complete-and-Handoff

When an agent finishes a task, `complete_and_handoff` performs an atomic operation:

1. **Approves** the task through full BRE validation
2. **Releases** the agent's lock
3. **Identifies** newly-unblocked downstream tasks
4. **Recommends** which agent should pick up each unblocked task
5. **Suggests** the completing agent's next task

This eliminates the gap between completion and next assignment.

## Coordination State

`get_coordination_state` provides the full multi-agent picture:

```json
{
  "agents": [
    { "id": "agent-alpha", "status": "working", "currentTask": "#267" },
    { "id": "agent-beta", "status": "available", "currentTask": null }
  ],
  "recentEvents": [
    { "type": "task.transition", "issueNumber": 266, "transition": "approve", "ago": "6h" }
  ],
  "recommendations": {
    "agent-beta": { "task": "#273", "score": 47, "reasoning": "..." }
  }
}
```

Agents can poll this endpoint to stay aware of what other agents are doing and coordinate effectively.

## Governance Hooks

Two PostToolUse hooks monitor governance impact:

1. **State Transition Hook** — After any task transition, checks: Did this unblock something? Did this create a new blocker? Is this a wave milestone?

2. **Wave Assignment Hook** — After assigning a task to a wave, checks: Does this create an epic integrity issue? Does this introduce dependency problems?

## Anti-Patterns ido4 Prevents

| Anti-Pattern | How ido4 Prevents It |
|---|---|
| Two agents working on the same task | Task locking with exclusive access |
| Agent starts a task with incomplete dependencies | DependencyValidation BRE step |
| Agent bypasses code review | StatusTransitionValidation enforces the workflow |
| Agent ignores epic integrity | EpicIntegrityValidation blocks split assignments |
| No visibility into agent activity | Full audit trail with per-agent attribution |
| Agents working on low-value tasks | Work distribution recommends highest-leverage work |
