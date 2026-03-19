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

**Resolved:** Task descriptions have no length limit. A 500-800 word description with codebase context, stakeholder attributions, file paths, and success conditions is a good living specification, not an overloaded one. If the description feels too long, the task needs splitting (Goldilocks violation) — not a different delivery mechanism. No linking, no separate storage, no retrieval infrastructure.

---

## Gap 2: No Capability-Level Hierarchy in GitHub

### Problem
The strategic spec has three levels: Group → Capability → (decomposes into) Tasks. The ingestion pipeline creates two levels: Group → Tasks. Capabilities (NCO-01) never become GitHub issues. The trace from task NCO-01A back to capability NCO-01 is naming-convention only, not structural.

### What exists
- `IngestionService` creates group issues and task issues with `addSubIssue`
- `findGroupingContainer()` maps groups to the methodology's grouping container (epic in Hydro, bet in Shape Up, nothing in Scrum)
- Methodology profiles define containers: Hydro has 2 (wave, epic), Shape Up has 3 (cycle, bet, scope), Scrum has 1 (sprint)

### Container hierarchy per methodology

| Methodology | Execution Container | Grouping Containers | Notes |
|---|---|---|---|
| **Hydro** | Wave (singularity, all-terminal) | Epic (no parent) | 2 levels |
| **Shape Up** | Cycle (singularity, all-terminal) | Bet (no parent, managed) → Scope (parent: bet, **managed: false**) | 3 levels |
| **Scrum** | Sprint (singularity, all-terminal) | Epic (no parent) — **TO BE ADDED** | Currently 1 level, will be 2 |

### Decisions Made

**Groups are ido4shape's concern, not ido4 MCP's.**
Groups exist for ido4shape's conversation process (discovery, stakeholder priority triage). They carry priority and cluster related capabilities. But ido4 MCP doesn't need them as GitHub issues because:
- Capabilities already provide the grouping structure (NCO-01 parents NCO-01A, NCO-01B)
- Groups add a third level that isn't structurally necessary
- Group priority is redundant when capabilities have their own priority
- The coherence groups represent is already encoded in capability dependencies

ido4 MCP does NOT create group issues in GitHub. However, group knowledge (name, priority, description) flows downstream:
- **Into the technical canvas** — the code-analyzer uses group context when assessing capabilities
- **Into epic/bet issue bodies** — the technical-spec-writer weaves relevant group context into capability descriptions ("Part of Notification Core — the backbone everything depends on")
- **Into task descriptions** — when group coherence affects implementation decisions
- **Into decomposition ordering** — must-have groups' capabilities are decomposed first
- **Into metadata assessment** — group priority informs effort/risk calibration (must-have group → more conservative risk)

Groups dissolve as GitHub artifacts but their knowledge persists in the artifacts that DO become issues.

**Capabilities map to the methodology's grouping container.**
Capabilities are the coherent deliverables — they have success conditions, stakeholder attributions, dependencies. They are analogous to epics (in the enriched, multi-stakeholder sense). The mapping:

| Strategic Spec | Hydro | Shape Up | Scrum |
|---|---|---|---|
| Group | *(decomposition ordering only)* | *(decomposition ordering only)* | *(decomposition ordering only)* |
| Capability | **Epic** (container) | **Bet** (container) | **Epic** (container) |
| Task | Task (assigned to wave) | Task (assigned to cycle) | Task (assigned to sprint) |

**GitHub hierarchy (all methodologies):**
```
NCO-01: Notification Event Model (capability → epic/bet — strategic prose, stakeholder attributions)
  └── NCO-01A: Event Schema (task — code-specific, effort/risk/type/ai)
  └── NCO-01B: Validation Service (task)
NCO-02: Channel Abstraction (capability → epic/bet)
  └── NCO-02A: Channel Interface (task)
```

Two levels in GitHub. Clean. Click any task → see implementation details. Click its parent → see strategic capability with stakeholder context.

**Add Epic to Scrum profile.**
The Scrum profile currently has no grouping container. Adding Epic aligns it with Hydro and gives capabilities a container to map to. The Scrum profile becomes:
```
containers: [
  { id: 'sprint', singularity: true, completionRule: 'all-terminal' },
  { id: 'epic', completionRule: 'none', managed: true }
]
```

**No epic-sprint integrity in Scrum.**
Unlike Hydro (where all tasks in an epic must be in the same wave), Scrum allows epics to span multiple sprints. This matches how every Scrum team actually works. The governance Scrum gets instead:
- Sprint singularity (one active sprint)
- Dependency coherence (task sprint >= dependency sprint)
- Atomic completion (sprint complete when all tasks done)

**Keep Sprint as Sprint.**
No renaming to "Iteration." Each methodology speaks its own language — Waves, Cycles, Sprints. That's the enterprise pitch.

### Shape Up mapping — DECIDED
Capabilities → **Bets**. Scopes remain available (`managed: false`) for teams that want finer-grained tracking within a bet, but not structurally required by the pipeline.

The betting table selects which capabilities to commit to each cycle. Not all capabilities are bet on at once — Shape Up's natural flow handles this.

Note: traditional Shape Up limits bets to 2-3 per cycle — this was a human-era throughput constraint. AI-augmented teams can handle more bets per cycle if they fit naturally. Governance enforces the principles (fixed time, variable scope, circuit breaker), not arbitrary slot counts.

### Final methodology mapping — ALL SETTLED

| Strategic Spec | Hydro | Shape Up | Scrum |
|---|---|---|---|
| Group | *(decomposition ordering only)* | *(decomposition ordering only)* | *(decomposition ordering only)* |
| Capability | **Epic** | **Bet** | **Epic** |
| Task | Task (in wave) | Task (in cycle) | Task (in sprint) |

**One rule: capabilities → the methodology's grouping container.** Uniform across all methodologies.

### Implementation impact

**Ingestion pipeline changes:**
- `findGroupingContainer()` currently maps groups → epic/bet. Needs to map capabilities → epic/bet instead.
- `IngestionService` currently creates group issues then task sub-issues. Needs to create capability issues then task sub-issues. Group issues are no longer created.
- The technical spec format may need adjustment — capabilities as the top-level grouping instead of groups.

**`findGroupingContainer` logic:**
Currently finds containers with `completionRule: 'none'` AND `!parent`. This returns Epic (Hydro), Bet (Shape Up), and now Epic (Scrum). The logic doesn't change — what changes is WHAT maps to it (capabilities instead of groups).

**Performance:** Sub-issue creation has 1000ms delay per call. Two-level hierarchy (capabilities + tasks) for 12 capabilities + 30 tasks = 42 sub-issue calls = ~42 seconds. Similar to current.

---

## Gap 3: Development Context Pipeline — EFFECTIVELY CLOSED

### Reassessment
Upon thorough investigation, the context lifecycle loop is already complete:

**READ side (system delivers context to agents):**
- `get_task_execution_data` MCP tool — single-call assembly of upstream deps (with parsed context comments), siblings, downstream, epic progress, execution intelligence
- Execution prompts — 8-phase agent guide:
  - Phase 1: Specification Comprehension
  - Phase 2: Upstream Context Interpretation (extract interfaces, patterns, decisions, warnings)
  - Phase 3: Downstream Awareness (design for consumers)
  - Phase 4: Pattern Detection (instability signals)
  - Phase 5: Work Execution
  - Phase 6: Escalation Protocol
  - Phase 7: Context Capture (templates for start, decisions, completion)
  - Phase 8: Completion Verification

**WRITE side (agents contribute context back):**
- Every transition tool (`start_task`, `review_task`, `approve_task`, `block_task`, etc.) accepts a `context` parameter
- When provided, the system calls `formatIdo4ContextComment` and writes a structured `<!-- ido4:context -->` comment on the issue
- The execution prompt Phase 7 guides agents on WHAT to write at three touchpoints:
  - At start: approach, interfaces consumed, patterns following
  - At key decisions: what, why, alternatives rejected
  - At completion: interfaces created, patterns established, decisions, edge cases, test coverage

**The loop:** Agent A starts task → writes context at start/decisions/completion → Agent B starts downstream task → `get_task_execution_data` returns Agent A's context comments → execution prompt Phase 2 guides extraction → Agent B builds on Agent A's knowledge.

### What was initially misidentified as missing
- **Context writing MCP tool** — ALREADY EXISTS. Built into every transition tool's `context` parameter.
- **Context enrichment service** — NOT NEEDED. The execution prompts guide AI agents through extraction (Phase 2). AI does this better than a deterministic service.
- **Context snapshot persistence** — ALREADY EXISTS. Context comments on GitHub issues are timestamped, attributed, and permanent. The audit trail IS the comment history.

### Future enhancement (not a gap)
- **Context-aware governance prompts** — standup/board/health prompts could be richer if they included upstream decision summaries ("NCO-01A agent established Zod pattern, downstream should follow"). This is an improvement to working infrastructure, not a missing piece. Must be done with care to not break existing prompt quality.

### Dogfooding spec status
`tests/fixtures/strategic-spec-context-pipeline.md` — kept as a **parser/pipeline mechanics test only**. Its content doesn't represent real planned work (most features already exist or aren't needed). Valid for testing: parser, MCP tool, format compliance, dry run. NOT valid for testing decomposition quality — that requires a real strategic spec from ido4shape targeting real planned work.

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

### Group Knowledge Downstream, Not as Issues
Groups don't become GitHub issues. Their knowledge (priority, description, coherence context) flows into epic/bet bodies, task descriptions, decomposition ordering, and metadata assessment. Cross-cutting concerns become task constraints, not separate tasks.

### Spec-Time Decomposition
Produce complete technical spec upfront. Execution-time can be added later.

### Ref Traceability
NCO-01A traces to strategic capability NCO-01 through the ref pattern.

### System Carries Knowledge
The system assembles context and delivers it. Agents don't manually fetch.

### Methodology Pragmatism
Don't apply human-era methodology constraints (e.g., "2-3 bets per cycle", "5-9 stories per sprint") to AI-augmented teams. Governance enforces principles (fixed time, variable scope, circuit breaker, epic integrity, dependency coherence) — not arbitrary slot counts. The numbers scale with the team's actual capacity.

---

## Open Implementation Questions

### Technical spec format: groups → capabilities
The current technical spec format uses `## Group:` as the top-level grouping. If capabilities replace groups as the structural unit, the format options are:
1. Replace `## Group:` with a capability-level heading — but `spec-parser.ts` expects `## Group:` syntax
2. Keep `## Group:` in the technical spec but populate with capability data (one "group" per capability)
3. Add a new heading pattern for capabilities and update `spec-parser.ts`

This needs resolution before implementation.

### Terminology: "capabilities" collision
"Capabilities" means two things in the codebase:
1. **Agent capabilities** — `agent.capabilities: string[]` (what an agent can do)
2. **Strategic capabilities** — `StrategicCapability` (functional requirements from ido4shape)

Options: rename one, qualify both, or accept the overload. Not yet decided.

---

## Next Steps

1. **Resolve open implementation questions** — Technical spec format, terminology
2. **Add Epic to Scrum profile** — New container, no integrity rule
3. **Update ingestion pipeline** — Capabilities as grouping unit instead of groups
4. **Update agent instructions** — Group knowledge downstream, capability→epic mapping
5. **Validate Gap 4** — Run the pipeline end-to-end
6. **Real validation** — Decompose a real strategic spec from ido4shape
7. *(Future enhancement)* Context-aware governance prompts — improve with care, don't break existing
