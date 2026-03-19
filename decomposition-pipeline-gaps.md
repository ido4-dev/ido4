# Decomposition Pipeline — Gaps, Decisions & Next Steps

Working document for the initiative to close architectural gaps in the decomposition pipeline. Updated as discussions progress and decisions are made.

**Last updated:** 2026-03-19

---

## Vision Anchor

**North star:** Multiple AI agents working in parallel — each understanding the full picture of what's being built, how their task connects to others, what "done" means, and how to verify it.

**Key principle:** The system carries the knowledge, not the agent. AI agents are stateless — each session starts fresh. A fresh agent with the right 100K tokens of context will outperform a "specialized" agent with wrong context. ido4's role is to assemble the right context at the right moment.

**GitHub issues are living specifications:** Not tickets. They're context carriers encoding intent, acceptance criteria, dependencies, and position in the larger architecture. The issue body is intent; the comments are reality.

**Demo bar:** Largest consultancy firms and software service companies that build at scale. The hierarchy, traceability, and context delivery must be visually compelling and architecturally sound.

---

## Current State (v0.3.0)

The decomposition pipeline is functionally complete:

| Stage | Component | Status |
|-------|-----------|--------|
| Parse | Strategic spec parser (`@ido4/core`) | Built, 41 tests |
| Parse | `parse_strategic_spec` MCP tool | Built |
| Analyze | Code analysis agent (`code-analyzer.md`) | Built, untested end-to-end |
| Write | Technical spec writer (`technical-spec-writer.md`) | Built, untested end-to-end |
| Validate | `ingest_spec` dry run | Existing infrastructure |
| Ingest | `IngestionService` | Existing infrastructure |
| Orchestrate | `/ido4:decompose` skill | Built |
| Test | Dogfooding fixture (`tests/fixtures/strategic-spec-context-pipeline.md`) | Created |

**Pipeline flow:**
```
ido4shape → strategic spec → parse → code-analyze → technical canvas → write technical spec → validate → ingest → GitHub issues
```

**What already existed before this initiative (important for context):**

Context assembly infrastructure:
- `task-execution-aggregator.ts` — assembles context for task execution (upstream deps with comments, siblings with status, downstream dependents, epic progress, execution intelligence with risk flags and critical path)
- `context-comment-parser.ts` — parses structured `<!-- ido4:context -->` blocks from issue comments
- `context-comment-formatter.ts` — produces structured context comments
- `get_task_execution_data` MCP tool — single-call context assembly for agents
- Execution prompts (hydro, scrum, shape-up) — 5-phase agent execution guide:
  - Phase 1: Specification Comprehension (read issue body, acceptance criteria)
  - Phase 2: Upstream Context Interpretation (extract interfaces, patterns, decisions from dependency context comments)
  - Phase 3: Downstream Awareness (design interfaces for consumers)
  - Phase 4: Pattern Detection (instability signals, coordination needs)
  - Phase 5: Work Execution (methodology principles, context writing)

Ingestion infrastructure:
- `IngestionService` — creates GitHub issues with two-level hierarchy (groups → tasks as sub-issues)
- `addSubIssue` infrastructure — GitHub sub-issue API support (1000ms delay between calls for API stability)
- `findGroupingContainer()` — finds methodology container with `completionRule: 'none'` AND `!parent` (epic in Hydro, bet in Shape Up, null in Scrum)

Agent infrastructure:
- `WorkDistributionService` — scores agent-task fit using `agent.capabilities` (keyword matching, e.g. `['backend', 'auth']`)
- `AgentStore` — agent registration with `capabilities?: string[]` field

Transition tools:
- `start_task` is NOT a separate tool — transition tools (start, review, approve, etc.) are dynamically generated from the methodology profile. Context delivery happens through `get_task_execution_data` which agents call separately.

**Terminology note:** "Capabilities" has two meanings in the codebase:
1. **Agent capabilities** — `agent.capabilities: string[]` in WorkDistributionService (what an agent can do: `['backend', 'auth']`)
2. **Strategic capabilities** — `StrategicCapability` in the strategic spec parser (functional requirements like NCO-01)

These are different concepts. May need distinct terminology to avoid confusion.

---

## Gap 1: Context Compression

### Problem
The technical canvas contains rich codebase knowledge per capability: relevant modules, patterns, architecture context, code-level dependencies, complexity assessments. The technical-spec-writer compresses this into task descriptions. When an agent picks up a GitHub issue, it gets a task description with file paths and success conditions, but NOT the full canvas analysis.

### What exists
- `get_task_execution_data` already assembles runtime context (upstream decisions, sibling status, downstream expectations)
- Execution prompts already tell agents: "call `get_task_execution_data` — this returns ALL context you need"
- The task execution aggregator parses context comments from upstream dependencies

### Decision: Embed canvas knowledge into task descriptions
Rather than creating new infrastructure (canvas storage, retrieval, indexing), the technical-spec-writer should produce task descriptions rich enough to be self-contained execution briefs. The canvas knowledge (specific modules, patterns, architecture context) is baked into the task description at write time.

The canvas file persists for human review and auditability, but executing agents don't need to read it — the relevant parts are in their task spec.

**Rationale:** This requires no changes to `start_task`, `get_task_execution_data`, or the execution prompts. The existing context pipeline already delivers the issue body. The technical-spec-writer just needs to be thorough.

**Open question:** Is a task description always sufficient? For complex capabilities, the canvas section might be 500+ words of analysis. Should all of that go into the task description, or should particularly rich context be linked?

---

## Gap 2: No Capability-Level Hierarchy in GitHub

### Problem
The strategic spec has three levels: Group → Capability → (decomposes into) Tasks. The ingestion pipeline creates two levels: Group → Tasks. Capabilities (NCO-01) never become GitHub issues. The trace from task NCO-01A back to capability NCO-01 is naming-convention only, not structural.

### What exists
- `IngestionService` creates group issues and task issues with `addSubIssue`
- `findGroupingContainer()` maps groups to the methodology's grouping container (epic in Hydro, bet in Shape Up, nothing in Scrum)
- Methodology profiles define containers: Hydro has 2 (wave, epic), Shape Up has 3 (cycle, bet, scope), Scrum has 1 (sprint)

### Current container hierarchy per methodology

| Methodology | Execution Container | Grouping Containers | Notes |
|---|---|---|---|
| **Hydro** | Wave (singularity, all-terminal) | Epic (no parent) | 2 levels total |
| **Shape Up** | Cycle (singularity, all-terminal) | Bet (no parent, managed) → Scope (parent: bet, **managed: false**) | 3 levels — scope is "independently deliverable piece within a bet." Scope is NOT actively managed by the system. |
| **Scrum** | Sprint (singularity, all-terminal) | *(none)* | 1 level total |

### Current ingestion mapping

```
Strategic Spec          GitHub Issues
──────────────          ─────────────
Group                 → Parent issue (mapped to epic/bet container)
  Capability          → (LOST — not created as an issue)
    → decomposed into → Tasks (sub-issues of group)
```

### The overlap question (OPEN)
If capabilities become GitHub issues, they overlap with groups in the hierarchy. What does each level mean?

**Groups** in the strategic spec:
- Organizational clusters of related capabilities
- Have: priority, description
- Example: "Notification Core" (contains 4 capabilities)

**Capabilities** in the strategic spec:
- Functional requirements with clear deliverables
- Have: priority, risk, dependencies, description, success conditions, stakeholder attributions
- Example: "NCO-01: Notification Event Model"

**Key insight:** Capabilities are the coherent deliverables (they have success conditions). Groups are organizational (they cluster related deliverables). The methodology's grouping container (epic/bet) semantically aligns more with capabilities than with groups — an epic should be "a coherent deliverable," not "an organizational cluster."

### Proposed methodology mapping (UNDER DISCUSSION)

| Strategic Spec | Hydro | Shape Up | Scrum |
|---|---|---|---|
| Group | Epic (container) | Bet (container) | *(label only)* |
| Capability | Sub-issue of epic (no container) | Scope (container, parent: bet) | *(label only)* |
| Task | Task (assigned to wave) | Task (assigned to cycle) | Task (assigned to sprint) |

**Implications:**
- In Hydro: capabilities are structural parents (sub-issues of epics) carrying strategic prose, but not governance containers. Epic integrity still means "all tasks in the same epic in the same wave." No BRE changes.
- In Shape Up: capabilities naturally map to scopes (already a container with `parent: 'bet'`). The existing three-level container hierarchy is a perfect fit.
- In Scrum: both groups and capabilities are labels/references only — tasks stand alone in sprints.

**Technical detail — `findGroupingContainer` logic:**
The function finds containers with `completionRule: 'none'` AND `!parent`. In Shape Up: bet matches (no parent), scope does NOT (parent: bet). This means the current mapper maps groups → bets. If we want capabilities → scopes, the mapper needs a second pass for child grouping containers.

**Performance note:** Sub-issue creation has a 1000ms delay per call (GitHub API stability). A three-level hierarchy (groups + capabilities + tasks) for a spec with 4 groups, 12 capabilities, 30 tasks = 46 sub-issue wiring calls = ~46 seconds. Acceptable but worth noting.

**Open questions:**
1. Should groups → epics/bets (current behavior), or should capabilities → epics/bets?
2. If groups → epics, what governance applies to capabilities? Just structural parenting?
3. If capabilities → epics, what happens to groups? Are they GitHub issues at all?
4. Does the BRE need changes for any of these mappings?
5. For Hydro, should we add a scope-like container level to support three-level hierarchy?
6. Shape Up scopes are `managed: false` — what does this mean for governance if capabilities map to scopes?

### Desired end state for demo
A consultant opens GitHub and sees:
```
Notification Core (epic/bet)
  └── NCO-01: Notification Event Model (capability — strategic prose, stakeholder attributions)
      └── NCO-01A: Event Schema (task — code-specific, effort/risk/type/ai)
      └── NCO-01B: Validation Service (task)
  └── NCO-02: Channel Abstraction (capability)
      └── NCO-02A: Channel Interface (task)
```

Click any task → see implementation details. Click its parent → see the strategic capability with stakeholder context. Click up again → see the group with its scope and priority.

---

## Gap 3: Development Context Pipeline Not Built

### Problem
The development context pipeline — enriching task execution with upstream decisions, sibling patterns, and downstream expectations — is partially built. The infrastructure exists but the enrichment layer is missing.

### What exists (already built)
- **Task execution aggregator** (`packages/mcp/src/aggregators/task-execution-aggregator.ts`) — assembles upstream deps, siblings, downstream dependents, execution intelligence. Already used by `get_task_execution_data`.
- **Context comment parser** (`packages/core/src/shared/utils/context-comment-parser.ts`) — parses structured `<!-- ido4:context -->` blocks.
- **Context comment formatter** (`packages/core/src/shared/utils/context-comment-formatter.ts`) — produces structured context comments.
- **Execution prompts** — guide agents through context consumption (Phase 1: spec comprehension, Phase 2: upstream interpretation, etc.)

### What's missing
- **Context enrichment service** — combines task execution data with parsed context comments to produce enriched packages with upstream decisions, not just statuses.
- **Context writing MCP tool** — exposes `formatIdo4ContextComment` as an MCP tool so agents can write structured context back to issues.
- **Context snapshot persistence** — audit trail of what context was provided to an agent at task start.
- **Context-aware prompts** — standup/board/health prompts that leverage assembled context.

### Relationship to Gap 1
Gap 1 (context compression) is about decomposition-time knowledge reaching executing agents. Gap 3 is about runtime context (upstream decisions, sibling patterns) reaching executing agents. They're complementary:
- Gap 1 solution: embed canvas knowledge in task descriptions → agents get codebase context from the issue body
- Gap 3 solution: build context enrichment → agents get runtime context from `get_task_execution_data`

Both flow through the existing execution prompt framework. No new delivery mechanism needed.

### Strategic spec for this feature
A dogfooding strategic spec exists: `tests/fixtures/strategic-spec-context-pipeline.md` (5 capabilities across 2 groups). It accurately reflects what exists vs what's new.

---

## Gap 4: Pipeline Not Validated End-to-End

### Problem
The decomposition pipeline has all stages built, but they haven't been run together. The code analysis agent and technical-spec-writer are markdown instructions — their quality depends on output review, not unit tests.

### Validation plan
1. Run `/ido4:decompose tests/fixtures/strategic-spec-context-pipeline.md`
2. Review the technical canvas — is the codebase analysis accurate?
3. Review the technical spec — are tasks right-sized? Are effort/risk realistic?
4. Run `ingest_spec` dry run — does it parse clean?
5. (Later) Create real issues and review in GitHub

### Dependencies
- Gap 2 decisions affect how ingestion works. Validate after hierarchy decisions are settled.
- A real strategic spec from ido4shape (targeting this codebase) would be the ultimate validation.

---

## Contract Verification (All Touching Points)

| # | Producer → Consumer | Contract Type | Status |
|---|---|---|---|
| 1 | ido4shape → strategic spec parser | Format spec (mechanical) | **Strong** |
| 2 | Parser → MCP tool → code-analyzer | JSON output (full content) | **Strong** (fixed — body + success conditions included) |
| 3 | Code-analyzer → canvas → technical-spec-writer | Markdown format (AI-to-AI) | **Soft** — no mechanical validation |
| 4 | Technical-spec-writer → spec-parser → IngestionService | Technical spec markdown (mechanical) | **Strong** — validated by dry run |
| 5 | IngestionService → GitHub API | GraphQL mutations (typed) | **Strong** |

Touch point #3 is inherently soft (AI-to-AI handoff). Accepted as architectural tradeoff — Claude handles format variation well.

---

## Technical Canvas Structure

The canvas is the intermediate artifact between code analysis and technical spec writing. Defined in `code-analyzer.md` agent instructions:

```markdown
# Technical Canvas: [Project Name]
> Source: [strategic spec file path]
> Analyzed: [date]

## Project Context
[Problem restatement + constraints]

## Codebase Overview
[Architecture, modules, patterns, conventions, tech stack]

## Cross-Cutting Concern Mapping
### [Concern] → Codebase Reality
[What exists, what's missing, integration points]

## Capability: [REF] — [Title]
### Strategic Context
[Carried forward from strategic spec — verbatim]
### Cross-Cutting Constraints
[Which concerns affect this capability, mapped to code]
### Codebase Analysis
- Relevant modules (file paths)
- Patterns found (with line references)
- Architecture context
- What exists vs what's new
### Code-Level Dependencies Discovered
[Dependencies not in strategic spec]
### Complexity Assessment
[Honest assessment referencing code patterns, coupling, test coverage]
```

The canvas persists as `[name]-canvas.md` alongside the strategic spec. The technical-spec-writer reads it; executing agents don't (its knowledge is embedded in task descriptions).

---

## Design Principles (Already Decided)

### Goldilocks Task Granularity
Task size constrained by three forces:
- Too small → specs fatigue (agent reads more than it codes)
- Too big → human oversight lost (reviewer can't verify)
- Just right → one coherent concept, one agent session, one reviewable output

### Group Preservation
Keep strategic groups from ido4shape (preserves traceability). Use `depends_on` for technical ordering. Cross-cutting concerns become task constraints, not separate tasks.

### Spec-Time Decomposition
Produce complete technical spec upfront. Execution-time can be added later.

### Ref Traceability
NCO-01A traces to strategic capability NCO-01 through the ref pattern.

### System Carries Knowledge
The system assembles context and delivers it. Agents don't manually fetch.

---

## Next Steps

1. **Resolve Gap 2** — Settle the hierarchy and methodology mapping questions
2. **Update ingestion pipeline** — Implement the decided hierarchy model
3. **Validate Gap 4** — Run the pipeline end-to-end
4. **Address Gap 3** — Build the context enrichment service and context writing tool
5. **Real validation** — Decompose a real strategic spec from ido4shape
