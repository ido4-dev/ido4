# ido4 MCP — Strategic Spec Integration Plan

Building ido4 MCP's capability to consume strategic specs from ido4shape and produce technical specs for the existing ingestion pipeline.

**This is the ido4-MCP side of a two-project change.** For the ido4shape side (format redesign, skill rewrites, conversation flow), see `/Users/bogdanionutcoman/dev-projects/ido4shape/references/strategic-spec-adaptation-plan.md`.

## Context

The two-artifact architecture (decided 2026-03-18) establishes a pipeline:
```
ido4shape (conversation) → strategic spec → ido4 MCP decomposition → technical spec → existing ingestion → GitHub issues
```

- **Strategic spec format:** Designed by ido4shape — `references/strategic-spec-format.md` in ido4shape repo
- **Technical spec format:** Unchanged — same format `spec-parser.ts` already consumes
- **Existing ingestion pipeline:** Unchanged — parser, mapper, toposort, GitHub issue creation all stay as-is

## Phase 0: Receive Transferred Assets from ido4shape — COMPLETE (2026-03-19)

Implementation-level instructional content from ido4shape has been adapted as MCP plugin assets:

**Created:**
- `packages/plugin/skills/spec-quality/SKILL.md` — effort/risk/AI suitability definitions with governance implications (how values affect BRE decisions, methodology mapping awareness)
- `packages/plugin/skills/spec-validate/SKILL.md` — pre-ingestion validation skill for technical specs (format compliance, content quality, dependency graph, verdict report)
- `packages/plugin/agents/spec-reviewer.md` — independent two-stage review agent (format compliance + quality assessment + governance implications check)

**Source material (from ido4shape, before rewrite):**
- `skills/quality-guidance/SKILL.md`, `skills/validate-spec/SKILL.md`, `agents/spec-reviewer.md`

**Adaptation:** Framing changed from "discovery/conversation" to "governance/execution." Definitions stay the same, audience is MCP users reviewing or producing technical specs. Added governance-specific sections (BRE implications, methodology mapping awareness).

ido4shape has since rewritten its versions for strategic spec purposes. Both sides now own their respective concerns.

---

## Phase 1: Strategic Spec Reader

Build the capability to parse and understand strategic specs.

### 1.1 Strategic spec parser/reader
The strategic spec uses the same heading patterns as the technical spec (`# Project`, `## Group:`, `### PREFIX-NN:`) but different metadata and richer prose content.

**Options:**
- **Extend existing parser** with a format-detection mode (`format: strategic-spec` in project metadata triggers different metadata expectations)
- **New dedicated reader** — since the consumer is an AI agent (not the ingestion pipeline), a full state-machine parser may be overkill. The reader needs to extract structure (groups, capabilities, dependencies) and pass prose content through intact.

**What the reader must extract:**
- Project context (description, stakeholders, constraints, non-goals, open questions)
- Cross-cutting concerns (full prose content, organized by concern type)
- Groups with priority
- Capabilities with priority, strategic risk, depends_on, descriptions, success conditions
- Dependency graph (for decomposition ordering)

### 1.2 Strategic spec validation
Validate structural integrity before decomposition:
- `format: strategic-spec | version: 1.0` present
- All `depends_on` references exist
- No circular dependencies
- Priority values from allowed set
- Capabilities have success conditions

Content quality is NOT validated here — the strategic spec was already validated by ido4shape.

---

## Phase 2: Codebase-Aware Decomposition Agent

The core new capability. An AI reasoning step that reads a strategic spec capability + explores the codebase + produces technical implementation tasks.

### 2.1 Decomposition intelligence
**Input:** One strategic spec capability (description, success conditions, cross-cutting concerns, stakeholder context)
**Process:**
1. Read the capability description and success conditions
2. Read relevant cross-cutting concerns (performance targets, security requirements, etc.)
3. Explore the codebase — find relevant modules, services, APIs, schemas
4. Understand the architecture — how modules connect, what patterns are used, what conventions exist
5. Identify what needs to change — new files, modified services, migrations, tests
6. Assess real complexity — coupling, test coverage, dependency depth

**Output:** Implementation tasks in the technical spec format:
- `effort: S|M|L|XL` — grounded in actual code complexity
- `risk: low|medium|high|critical` — grounded in coupling, unknowns, module maturity
- `type: feature|bug|research|infrastructure` — correct classification per task
- `ai: full|assisted|pair|human` — based on code patterns and test coverage
- `depends_on` — code-level dependencies (may add new ones not in strategic spec)
- Rich task descriptions with specific file paths, service names, API endpoints
- Success conditions that are code-verifiable

### 2.2 Cross-cutting concern integration
The decomposition agent must factor cross-cutting concerns into every technical task:
- Performance targets → affects architecture choices, data structure decisions
- Security requirements → adds auth checks, encryption, input validation tasks
- Accessibility → adds specific UI requirements to frontend tasks
- Observability → adds logging, metrics, alerting to service tasks

These don't map 1:1 to tasks — they're constraints that shape how every task is implemented.

### 2.3 Dependency enrichment
The strategic spec has functional dependencies. The technical spec needs code-level dependencies:
- Functional: "notification delivery before notification preferences" (from strategic spec)
- Technical: "database migration before API endpoint" (discovered from code)
- Both are preserved. Technical dependencies are ADDED, not replacing functional ones.

### 2.4 Parent-child linking
Each strategic spec capability becomes the parent of its technical tasks:
- Strategic capability → parent issue (or epic-level container)
- Technical tasks → sub-issues under the parent
- Existing infrastructure supports this: `TaskService.createTask` handles sub-tasks, sub-issue API wires relationships

---

## Phase 3: Technical Spec Producer

### 3.1 Technical spec writer
Assemble decomposed tasks into a technical spec artifact in the existing format:
- Same heading patterns `spec-parser.ts` expects
- Same metadata fields (effort, risk, type, ai, depends_on)
- Task descriptions reference specific code paths and architecture
- Success conditions are implementation-verifiable
- Groups may differ from strategic spec groups (technical grouping based on code modules, not functional capabilities)

### 3.2 Technical spec validation
Run the existing validation (or the new spec-validation skill from Phase 0) before ingestion:
- Parser compatibility check
- Dependency graph validation
- Quality gates (200-char bodies, success conditions, metadata values)

### 3.3 Ingestion
Feed the validated technical spec into the existing pipeline. Nothing changes here — `ingest_spec` works as it always has.

---

## Design Decisions Still Open

### Decomposition timing: spec-time vs execution-time
**Spec-time:** Decompose all capabilities up front, produce a complete technical spec, then ingest.
**Execution-time:** Decompose just-in-time when someone picks up a capability for implementation.

Leaning toward execution-time — codebases change, and pre-planned technical tasks go stale. But spec-time gives a complete picture for planning and resource allocation.

Could support both: quick decomposition at spec-time for planning estimates, detailed decomposition at execution-time for actual work.

### Where does the decomposition agent live?
Options:
- New MCP tool: `decompose_capability` — takes strategic spec + capability ref, returns technical tasks
- New service: `DecompositionService` in `@ido4/core` — orchestrates the analysis
- New agent: Dedicated agent definition in the plugin that has codebase access

### How does the agent explore the codebase?
The decomposition agent needs to read files, search code, understand architecture. Options:
- Uses MCP tools (Read, Grep, Glob) within Claude Code context
- Has direct filesystem access via Node.js (if running as a service)
- Uses existing code intelligence tools (LSP, tree-sitter) for deeper analysis

---

## Work Order

1. **Phase 0** — Receive transferred assets (coordinate with ido4shape timing)
2. **Phase 1** — Strategic spec reader (can start independently)
3. **Phase 2** — Decomposition agent (core work, largest effort)
4. **Phase 3** — Technical spec producer and integration

Phase 2 is the hard part — genuine AI reasoning about codebases. Phases 1 and 3 are more mechanical.

---

## What This Plan Does NOT Cover

- **ido4shape side:** Format redesign, skill rewrites, conversation flow changes. See `/Users/bogdanionutcoman/dev-projects/ido4shape/references/strategic-spec-adaptation-plan.md`.
- **Ingestion pipeline changes:** None needed — the technical spec format is unchanged.
- **BRE changes:** None needed — BRE validates technical tasks the same way regardless of their origin.
