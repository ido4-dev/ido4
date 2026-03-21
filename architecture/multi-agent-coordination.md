# Multi-Agent Coordination — Agent Registration, Task Locking, and Work Distribution

## The Design Decision

ido4 supports multiple AI agents working in parallel on the same project. Three services coordinate this:

- **AgentService**: Identity, registration, heartbeat, and exclusive task locking
- **WorkDistributionService**: Intelligent task recommendation with 4-dimension scoring
- **MergeReadinessService**: Quality gate that composes governance checks into a single pass/fail

The coordination model is **advisory, not prescriptive**. Work recommendations are scored suggestions — agents (or humans) decide whether to follow them. Task locks are the only hard constraint: one agent per task at a time.

## Architecture

```
Agent registers
    │
    ▼
AgentService
    ├── Agent registry (in-memory + file persistence)
    │   ├── agentId, name, role, capabilities
    │   ├── registeredAt, lastHeartbeat
    │   └── Stale threshold: 30 minutes without heartbeat
    │
    ├── Task locks (in-memory + file persistence)
    │   ├── Exclusive: one agent per task
    │   ├── TTL: 30 minutes (auto-expire)
    │   ├── Same agent can extend lock
    │   └── Only lock owner can release
    │
    └── Lock cleanup: expired locks released on every lockTask() call

Agent requests work
    │
    ▼
WorkDistributionService
    ├── Resolves active container
    ├── Filters candidates (actionable status, not locked by others)
    ├── Scores each candidate across 4 dimensions
    ├── Returns top recommendation + 3 alternatives
    └── Emits audited work.recommendation event

Agent completes task
    │
    ▼
WorkDistributionService.completeAndHandoff()
    ├── Approves task (full BRE validation)
    ├── Releases agent's lock
    ├── Identifies newly unblocked tasks
    ├── Suggests which agent should pick up each
    ├── Gets completing agent's next recommendation
    └── Emits audited work.handoff event
```

## Agent Identity

Every governance operation carries actor identity via `ActorIdentity`:

```typescript
type ActorIdentity = {
  type: 'human' | 'ai-agent' | 'system';
  id: string;     // Unique identifier
  name: string;   // Human-readable name
};
```

In the MCP layer, actor identity comes from:
- `IDO4_AGENT_ID` environment variable (for multi-agent setups)
- Falls back to `'mcp-session'` / `'Claude Code'` for single-agent scenarios

The audit trail records which agent performed every transition. This enables:
- Per-agent compliance scoring (`ComplianceService` accepts `actorId` filter)
- Agent performance comparison via analytics
- Accountability in multi-agent scenarios

## Task Locking

Locks prevent two agents from working on the same task simultaneously.

### Semantics

| Operation | Behavior |
|---|---|
| `lockTask(agentId, issueNumber)` | Acquires exclusive lock. Fails if locked by different agent. |
| Same agent locks again | Extends TTL (idempotent) |
| `releaseTask(agentId, issueNumber)` | Releases lock. Only lock owner can release. |
| `getTaskLock(issueNumber)` | Returns lock info or null. Auto-cleans expired locks. |
| `releaseExpiredLocks()` | Scans all locks, removes expired ones. Called on every `lockTask()`. |

### Design Choices

**30-minute TTL**: Locks expire after 30 minutes without renewal. This prevents deadlocks from crashed agents. An active agent should call `heartbeat()` or re-lock to extend.

**Single-process, in-memory**: The current implementation uses in-memory `Map` with file persistence for crash recovery. This is race-condition-free for single-process operation. Multi-process (multiple MCP server instances) would require a shared lock store.

**BRE integration**: `TaskLockValidation` is a validation step in the BRE pipeline. When configured in a profile's pipeline, it checks whether the transitioning agent holds the lock on the task. If `AgentService` is not configured, the step passes through (graceful degradation).

**File persistence**: Agent registrations and locks are persisted to `.ido4/agents.json` on every write operation. On startup, `AgentService` loads persisted state. Expired locks are cleaned on first access.

## Work Distribution — 4-Dimension Scoring

When an agent asks "what should I work on next?", WorkDistributionService scores all candidate tasks:

### Candidate Filtering

A task is a candidate if:
- Status is actionable (ready states or todo-category, not terminal/blocked/active)
- Not locked by a different agent (locked by requesting agent is OK)

### Scoring Dimensions

```
Total score = Cascade + Epic Momentum + Capability Match + Freshness
              (0-40)     (0-25)          (0-20)             (0-15)
              ─────────────────────────────────────────────────────
                                Max: 100
```

**1. Cascade Value (0-40)** — How many downstream tasks does completing this unblock?

Uses BFS over the reverse dependency graph. Depth-weighted:
- Direct dependent (depth 1): 15 points each
- Depth 2: 8 points each
- Depth 3+: 4 points each
- Capped at 40

This makes the highest-leverage tasks bubble up: the ones that unblock the most work downstream.

**2. Epic Momentum (0-25)** — Is this task in an epic that's already in progress?

- Last remaining task in an epic: 25 points (finishing momentum)
- Solo task in epic: 5 points (small bonus)
- Otherwise: proportional to completion ratio (80% done = 20 points)

This prevents epic fragmentation — agents focus on completing what's started rather than scattering across many epics.

**3. Capability Match (0-20)** — Does the agent's declared role match the task?

- Neutral baseline: 10 points (no agent info = neutral, not penalty)
- Role match bonus: coding+feature = +4, coding+bug = +3, review+refinement = +5
- Risk match: critical tasks get small bonus for coding agents (+2)
- Keyword match: agent capabilities vs. task title (+3)

Soft matching — no penalties for mismatch, only bonuses for good fits.

**4. Dependency Freshness (0-15)** — Were this task's dependencies recently completed?

Checks how many of the task's dependencies were completed in the last 24 hours. If dependencies just finished, the task has momentum — pick it up while context is fresh.

### Output

```typescript
interface WorkRecommendation {
  recommendation: TaskRecommendation | null;  // Top pick
  alternatives: TaskRecommendation[];          // Next 3 best
  context: {
    activeContainer: string;
    agentId: string;
    lockedTasks: number[];
    totalCandidates: number;
  };
}

interface TaskRecommendation {
  issueNumber: number;
  title: string;
  reasoning: string;        // Human-readable explanation
  score: number;            // Total score (0-100)
  scoreBreakdown: ScoreBreakdown;
}
```

Every recommendation includes a `reasoning` string explaining *why* this task was recommended. This is critical for transparency — agents and humans can evaluate the recommendation rather than blindly following it.

## Complete-and-Handoff

`completeAndHandoff()` is an atomic operation that chains task completion with work redistribution:

1. **Approve task** — Runs full BRE validation. If it fails, the handoff stops.
2. **Release lock** — Frees the task for other agents. Tolerates missing locks.
3. **Find newly unblocked tasks** — Checks reverse dependency map for tasks whose ALL dependencies are now satisfied.
4. **Suggest agent assignments** — For each newly unblocked task, scores available agents using capability matching.
5. **Get next recommendation** — Calls `getNextTask()` for the completing agent so they immediately know what to do next.
6. **Emit handoff event** — Audited via EventBus, persisted by AuditService.

This enables a continuous flow: agent completes task → governance validates → downstream tasks unblock → agents get recommendations → work continues.

## MergeReadinessService — Quality Gate

The merge readiness gate composes 6 existing capabilities into a single check:

| Check | Source Service | What It Validates |
|---|---|---|
| Workflow compliance | TaskService | Task is in a terminal state (methodology complete) |
| PR review requirement | RepositoryRepository | Linked PR has required number of approving reviews |
| Dependency completion | DependencyService | All upstream dependencies in Done status |
| Epic integrity | EpicService | Wave maintains epic cohesion (Hydro principle) |
| Test/security gates | RepositoryRepository | Commit status checks pass, no open vulnerability alerts |
| Compliance threshold | ComplianceService | Project compliance score above minimum (default: 70) |

### Override Mechanism

Merge readiness supports overrides with audited justification:

```typescript
checkMergeReadiness(issueNumber, {
  overrideReason: "Emergency hotfix — security vulnerability",
  actor: { type: 'human', id: 'pm', name: 'Project Manager' }
});
```

Overrides are recorded in the audit trail. ComplianceService will reflect overrides in the BRE pass rate category — frequent overrides lower the compliance score.

### Configuration

Gates are configurable per call via `MergeGateConfig`:
- `minReviews`: Required approving reviews (default: 1)
- `minComplianceScore`: Minimum project compliance (default: 70)
- `requireWorkflowCompliance`: Check methodology compliance (default: true)
- `requireDependencyCompletion`: Check upstream deps (default: true)
- `requireEpicIntegrity`: Check container integrity (default: true)
- `requireSecurityScan`: Check security alerts (default: true)

## Current Limitations

**Single-process locking**: Task locks are in-memory with file persistence. Multiple MCP server instances (e.g., multiple agents each running their own server) would need a shared lock store (Redis, database, or filesystem-based locking).

**No agent-to-agent communication**: Agents communicate through shared governance state (task statuses, locks, audit trail), not through direct messaging. An agent discovers what others are doing by reading the governance state.

**Advisory recommendations**: Work distribution is advisory. There's no enforcement that agents follow recommendations. A future "assignment mode" could make recommendations binding — but the advisory model is deliberate: it preserves agent autonomy while providing intelligent guidance.

**Heartbeat is manual**: Agents must call `heartbeat()` to prove liveness. There's no automatic heartbeat mechanism — the MCP protocol doesn't provide session heartbeats. Stale detection (30 minutes without heartbeat) is checked on agent list queries, not proactively.

## Key Source Files

- AgentService: `packages/core/src/domains/agents/agent-service.ts`
- AgentStore (file persistence): `packages/core/src/domains/agents/agent-store.ts`
- WorkDistributionService: `packages/core/src/domains/distribution/work-distribution-service.ts`
- Distribution types: `packages/core/src/domains/distribution/types.ts`
- MergeReadinessService: `packages/core/src/domains/gate/merge-readiness-service.ts`
- TaskLockValidation (BRE step): `packages/core/src/domains/tasks/validation-steps/task-lock-validation.ts`
- Actor identity: `packages/mcp/src/helpers/actor.ts`
