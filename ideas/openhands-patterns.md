---
date: 2026-04-01
status: exploring
category: platform
---

# Patterns Worth Borrowing from OpenHands

Research findings from deep-diving the OpenHands open-source codebase (v1.6.0, 70K+ GitHub stars, MIT-licensed). OpenHands is an autonomous coding agent platform — it's the "hands" (execution). ido4 is the "brain" (context, governance, coordination). These are complementary, not competing. The patterns below are architectural ideas worth adopting, not code to copy.

**Compound research document.** Contains 5 related patterns from a single source. Individual patterns may be extracted to separate idea files if they mature to `ready` status.

**Source:** https://github.com/OpenHands/OpenHands + https://github.com/OpenHands/software-agent-sdk

---

## 1. MCP Tool Annotations

**Priority: High | Effort: Small | Category: governance**

### What OpenHands Does

Every tool definition carries MCP-standard annotations:

```
readOnly: true       // Safe to run without confirmation
destructive: false   // Won't modify external state
idempotent: true     // Safe to retry
openWorld: false     // Doesn't reach outside the local system
```

MCP clients (Claude Code, etc.) use these annotations to decide which tool calls need human confirmation and which can auto-approve.

### What ido4 Should Borrow

Add annotations to all 54-58 MCP tool registrations. Classification would be:

- **Read-only tools** (get_task, get_board, project_context, task_context, etc.) — `readOnly: true, destructive: false, idempotent: true`
- **Write tools with validation** (transition_task, assign_task, etc.) — `readOnly: false, destructive: false, idempotent: false`
- **Destructive tools** (delete operations, if any) — `readOnly: false, destructive: true, idempotent: false`
- **External-reaching tools** (GitHub issue sync, ingestion) — `openWorld: true`

### Why It Matters

- Zero breaking changes — it's metadata on existing registrations
- MCP clients already understand these annotations
- Strengthens governance positioning: ido4 doesn't just validate workflow state, it classifies the risk of every operation
- Enables smarter auto-approval policies in Claude Code and other MCP hosts
- Part of the MCP spec, so it's a standards-compliant enhancement

### Implementation Notes

Annotations go in the tool registration's `inputSchema` metadata. Check the MCP spec for the exact field (`annotations` or `x-annotations`). Profile-driven tools would inherit annotation defaults from the methodology profile with per-tool overrides.

---

## 2. Context Condensation for Large Projects

**Priority: Medium | Effort: Medium-Large | Category: platform**

### What OpenHands Does

Their "condenser" system is a pluggable pipeline for compressing conversation history:

- **Event-sourced condensation** — History is never mutated. A `CondensationEvent` marks a range of events as "forgotten" and carries a summary. When the "View" (what the LLM sees) is reconstructed, forgotten events are replaced by the summary.
- **Pluggable strategies** chained via `CondenserPipeline`:
  - `NoOpCondenser` — pass-through
  - `RecentEventsCondenser` — keep first N + last M, drop middle
  - `AmortizedForgettingCondenser` — drop middle events without summarizing
  - `LLMSummarizingCondenser` — use an LLM to summarize forgotten events
  - `StructuredSummaryCondenser` — force the LLM to produce a typed Pydantic model via function calling (fields: `completed_tasks`, `pending_tasks`, `files_modified`, `branch_name`, etc.)
  - `ObservationMaskingCondenser` — truncate large tool outputs
- **Trigger mechanisms**: automatic (event count or token count threshold), manual (agent request), on context window error (fallback)

### What ido4 Should Borrow

ido4's composite aggregators (`project_context`, `task_context`) assemble full project state in single MCP calls. For large projects (50+ tasks, deep dependency graphs, long audit trails), this output can be massive. A condensation layer could:

1. **Compressed project context resource** — A new MCP resource that returns pre-condensed project state. Summarizes completed work, expands active/blocked work, compresses dependency chains to relevant paths only.
2. **Tiered context assembly** — Three levels of detail:
   - `summary` — One-paragraph project state (for agent orientation)
   - `working` — Active tasks + direct dependencies + recent audit (for task execution)
   - `full` — Everything (current behavior)
3. **Structured project state model** — Inspired by OpenHands' `StateSummary`, define a typed schema for condensed project state: active container, blocked tasks, pending transitions, dependency bottlenecks, compliance score. Agents with limited context get structured data instead of prose.

### Why It Matters

- Model-agnostic ido4 means non-Claude agents (smaller context windows) will consume ido4 context. They need condensed views.
- Large enterprise projects will exceed useful context sizes. Condensation becomes necessary.
- Structured summaries are more reliable than prose for agent consumption — deterministic fields, not LLM interpretation.

### Design Considerations

- This lives in the MCP layer (context delivery), not core domain logic
- The condensation strategies should be profile-driven (methodology profiles could define what "active work" means)
- Event-sourced approach (never mutate, mark-and-reconstruct) aligns with ido4's existing audit trail philosophy

---

## 3. Stuck Detection for Multi-Agent Coordination

**Priority: Medium | Effort: Medium | Category: platform**

### What OpenHands Does

A `StuckDetector` monitors agent behavior for pathological patterns:

- **Repeated actions** — Same action emitted 3-4 times consecutively
- **Alternating patterns** — Agent bounces between two states
- **Monologuing** — Agent produces text without taking any tool actions
- **Action-observation loops** — Identical action→observation pairs repeating

When stuck is detected, the conversation status changes to `STUCK`, triggering recovery (condensation, user intervention, or delegation to a different agent).

### What ido4 Should Borrow

In multi-agent scenarios, ido4 distributes tasks across agents. If an agent is stuck, ido4 should detect it and act. Detection via audit trail analysis:

- **BRE rejection loops** — Agent attempts the same transition 3+ times, rejected each time by the same validation step. The agent doesn't understand the constraint.
- **Assignment churn** — A task gets reassigned repeatedly without progress (no state transitions, no commits linked).
- **Dependency deadlocks** — Two tasks block each other through circular dependency that wasn't caught at planning time (dynamic dependencies added during implementation).
- **Stale active tasks** — Task has been in `in_progress` state for N hours with no audit events. Agent may have abandoned it.

Actions on detection:
- Surface as a warning in `project_context` ("Task X appears stuck: rejected by BRE 3 times on epic-integrity rule")
- Suggest remediation ("Task X needs to be in the same wave as its epic — currently in Wave 2, epic is in Wave 1")
- Auto-escalate to coordinator agent or human

### Why It Matters

- Multi-agent coordination is ido4's differentiator. Stuck detection is table stakes for reliable coordination.
- The BRE already produces the signal (rejection events in audit trail). Detection is pattern-matching on existing data.
- This is governance the agent platforms can't do — OpenHands detects stuck at the action level; ido4 detects stuck at the workflow/project level.

### Implementation Notes

Natural fit in the analytics domain (`packages/core/src/domains/analytics/`). Could be a new analysis: `StuckAnalysis` that queries audit events for the patterns above and returns findings.

---

## 4. Per-Agent Tool and Permission Profiles

**Priority: Medium | Effort: Medium | Category: platform**

### What OpenHands Does

Each subagent can be configured with its own:
- Model (different LLM per agent role)
- Tool set (subset of available tools)
- MCP servers (additional context sources)
- Permission mode (`always_confirm`, `never_confirm`, `confirm_risky`)
- Hooks (pre/post tool execution)

Agent definitions are markdown files with YAML frontmatter:

```yaml
name: security-reviewer
model: claude-sonnet-4-5-20250929
tools: [GrepTool, FileEditorTool]
mcp_servers:
  semgrep: {command: "semgrep", args: ["--mcp"]}
permission_mode: always_confirm
```

### What ido4 Should Borrow

When ido4 distributes tasks to multiple agents, each agent's role implies a tool and permission profile:

- **Implementer** — Full write access to task transitions, code context, dependency queries
- **Reviewer** — Read-only project context, transition limited to `review` and `approve`/`return`
- **Coordinator** — Full access to distribution, assignment, container management
- **Observer** — Read-only everything, used for compliance monitoring

ido4 could expose a `get_agent_profile` tool or resource that returns the appropriate tool subset and permission hints for a given role. The MCP client (Claude Code, OpenHands, etc.) would use this to configure the agent session.

### Why It Matters

- Principle of least privilege applied to AI agents — an implementer shouldn't be able to approve their own work
- Maps naturally to ido4's existing actor identity system
- Reduces the tool surface area per agent, making each agent more focused and less likely to misuse tools
- Enterprise customers will expect role-based access control for agents

### Design Considerations

- The actor identity system already tracks who is doing what. This extends it to prescribe what each actor *can* do.
- Profile-driven: methodology profiles could define role→tool mappings
- This is a recommendation layer, not enforcement (MCP doesn't support server-side tool hiding based on caller identity — yet)

---

## 5. Tailored Context Views per Agent/Task

**Priority: Low-Medium | Effort: Large | Category: platform**

### What OpenHands Does

The `View` abstraction separates "what happened" (full event log) from "what the agent sees" (filtered, condensed projection). Views are reconstructed from the event stream each time, respecting condensation markers. The same event history produces different views depending on which condensation events have been applied.

### What ido4 Should Borrow

For multi-agent scenarios, each agent working on a task needs different context:

- **Task-focused view** — The agent's assigned task expanded in full (description, success criteria, dependencies, linked issues, relevant audit history). Sibling tasks in the same epic/capability summarized. Unrelated work omitted.
- **Dependency-focused view** — For tasks with upstream dependencies: expand the dependency chain, show status of each dependency, surface blockers. Collapse everything else.
- **Review-focused view** — For reviewers: the task's implementation context (commits, PRs), the success criteria, the BRE validation results. Omit planning history.

This is a generalization of ido4's existing `task_context` — instead of one context shape, multiple projections of the same project state optimized for different agent roles and activities.

### Why It Matters

- Context quality > context quantity. An agent drowning in irrelevant project state performs worse than one with a focused view.
- Different phases of work need different context shapes. Planning needs the big picture. Implementation needs the focused task. Review needs the verification criteria.
- This scales multi-agent coordination — each agent gets O(relevant) context instead of O(project).

### Design Considerations

- Could be implemented as view parameters on existing context tools: `project_context(view="task-focused", task_id="T-123")`
- View definitions could be profile-driven (methodology profiles define what "review context" means for that methodology)
- Start with 2-3 predefined views, not a generic view query language

---

## Decided Against Borrowing

These OpenHands patterns were evaluated and deliberately excluded:

| Pattern | Why Not |
|---------|---------|
| **Docker sandbox runtime** | ido4's sandbox is a demo/learning environment for experiencing the platform. OpenHands' sandbox is an execution environment for running code. Different purposes — ido4 doesn't need execution isolation. |
| **Agent execution loop** | ido4 provides context and governance via MCP. The agent loop is the MCP client's responsibility (Claude Code, OpenHands, etc.). Adding an execution loop would violate ido4's architectural boundary. |
| **litellm multi-model routing** | ido4 is model-agnostic by design — it's an MCP server. Any MCP client with any model connects to it. A model routing layer would be redundant and architecturally wrong. |
| **Task tracker tool** | OpenHands' task tracker is an LLM calling a tool to track its own work. ido4's task management is the core domain — deterministic, BRE-validated, methodology-driven. Borrowing a simple tracker would be a regression. |
| **Plugin system (GitHub-based loading)** | ido4dev already has the marketplace pattern with `ido4-plugins`. OpenHands' approach is similar but Python-specific and less structured. |
| **Security risk prediction per tool call** | OpenHands asks the LLM to predict security risk level for each tool call. This is probabilistic. ido4's BRE validation is deterministic. Adding LLM-predicted risk alongside deterministic validation would muddy the governance story. Tool annotations (item 1) achieve risk classification without LLM guessing. |

---

## Relationship: ido4 + OpenHands Integration

Beyond borrowing patterns, OpenHands is a natural integration partner:

- **OpenHands as ido4 consumer** — OpenHands agents could connect to ido4 MCP for task context, governance, and coordination. OpenHands provides the hands; ido4 provides the brain.
- **ido4 as OpenHands MCP server** — Already possible today. An OpenHands agent configured with ido4 MCP as a server gets full project understanding.
- **Multi-agent bridge** — OpenHands' parallel agent execution + ido4's task distribution and governance = coordinated multi-agent development at scale.

This integration requires zero code changes in ido4 — it's the MCP protocol doing its job.

**Connects to:** pluggable-quality-gates (tool annotations as governance metadata), governance-maturity-levels (stuck detection maps to Level 2-3), event-driven-state-sync (context condensation shares event-sourced approach), governance-not-execution (per-agent profiles enforce boundary), external-auditors (observer role in agent profiles), signal-provider-abstraction, claude-code-leak-analysis (overlapping items: tool annotations, role-aware responses, response budgets)
