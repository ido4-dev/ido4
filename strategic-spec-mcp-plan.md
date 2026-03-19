# ido4 MCP — Strategic Spec Decomposition Plan

Building ido4 MCP's capability to consume strategic specs from ido4shape and produce technical specs for the existing ingestion pipeline.

**This is the ido4-MCP side of a two-project change.** For the ido4shape side (format redesign, skill rewrites, conversation flow — COMPLETE), see `/Users/bogdanionutcoman/dev-projects/ido4shape/references/strategic-spec-adaptation-plan.md`.

## Context

The two-artifact architecture (decided 2026-03-18) establishes a pipeline:
```
ido4shape (conversation) → strategic spec → ido4 MCP decomposition → technical spec → existing ingestion → GitHub issues
```

- **Strategic spec format:** Designed by ido4shape — `references/strategic-spec-format.md` in ido4shape repo
- **Technical spec format:** Unchanged — same format `spec-parser.ts` already consumes
- **Existing ingestion pipeline:** Unchanged — parser, mapper, toposort, GitHub issue creation all stay as-is

## Architecture: Multi-Stage Pipeline

The decomposition is NOT a single-agent operation. It's a four-stage pipeline with separation of concerns:

```
Strategic Spec (from ido4shape)
        │
        ▼
┌─────────────────────────┐
│  Code Analysis Agent     │  Explores codebase, maps capabilities
│  (AI — codebase access)  │  to modules, discovers patterns,
│                          │  assesses complexity
└──────────┬──────────────┘
           │
           ▼
   Technical Canvas (intermediate artifact)
   Strategic understanding + codebase knowledge
           │
           ▼
┌─────────────────────────┐
│  Issue Writing Agent     │  Decomposes into tasks, judges effort/
│  (AI — reasoning)        │  risk/type/ai, sets dependencies,
│                          │  writes technical spec markdown
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Deterministic           │  Format compliance, field validation,
│  Validation              │  dependency graph, quality gates
│  (Code — spec-validate)  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Ingestion Pipeline      │  spec-parser → spec-mapper →
│  (Code — existing)       │  GitHub issues (unchanged)
└─────────────────────────┘
```

**Why multi-stage:**
- Each stage has one clear job — code analysis doesn't format specs, issue writing doesn't navigate code
- The intermediate artifact (technical canvas) is reviewable — catches code analysis errors before they become bad GitHub issues
- Mirrors the ido4shape pipeline: conversation → canvas → synthesize → artifact

## Design Decisions (Settled)

### Decomposition timing: spec-time
Produce a complete technical spec upfront from the full strategic spec. This gives a complete picture for planning, wave composition, and dependency analysis. Execution-time (just-in-time per capability) can be added later as an optimization for large teams where codebases evolve between planning and execution.

### Where the agents live: plugin skills
The decomposition agents are Claude Code plugin skills/agents. They structure Claude's own reasoning — Claude Code already knows how to explore codebases, assess complexity, and plan implementations. The skills guide that process, they don't replicate it.

### Codebase exploration: Claude Code's native tools
The code analysis agent uses Read, Grep, Glob within the Claude Code context. No separate filesystem access or code intelligence tools needed. Claude Code is already the best tool for understanding codebases.

### Group strategy: preserve strategic groups
Keep ido4shape's groups as the primary structure (preserves traceability). Use `depends_on` for technical ordering (infrastructure tasks before feature tasks). Extract a shared infrastructure group ONLY when multiple strategic groups depend on the same foundation work. Cross-cutting concerns become task constraints, not separate tasks or groups.

### Task granularity: Goldilocks principle
Task size is constrained by three forces:
- **Too small → specs fatigue**: Agent spends more time reading specs than writing code. Governance overhead per line of code becomes noise.
- **Too big → human oversight lost**: Reviewer can't meaningfully verify the change. Human-in-the-loop principle breaks down.
- **Just right**: One coherent concept that an agent executes end-to-end AND a human can review, test, or observe the result.

**Split when:** Different agents should own different parts; hard dependency boundary; scope so large a reviewer can't grok it.
**Don't split when:** Same concept across multiple files; agent would do it in one session; spec overhead exceeds coordination benefit.

The issue writing agent asks: "Could a human reviewer look at this task's output and say yes/no without context-switching across unrelated concerns?"

### Ref pattern: preserves traceability
Technical tasks use suffixed refs from their parent capability. Strategic NCO-01 decomposes into NCO-01A, NCO-01B, etc. You can always trace a technical task back to its strategic capability.

---

## Phase 0: Receive Transferred Assets — COMPLETE (2026-03-19)

Implementation-level instructional content from ido4shape has been adapted as MCP plugin assets:

**Created:**
- `packages/plugin/skills/spec-quality/SKILL.md` — effort/risk/AI suitability definitions with governance implications
- `packages/plugin/skills/spec-validate/SKILL.md` — pre-ingestion validation skill for technical specs
- `packages/plugin/agents/spec-reviewer.md` — independent two-stage review agent

These validate the OUTPUT of decomposition (technical specs), not the input (strategic specs).

---

## Phase 1: Strategic Spec Reader

Build the capability to parse and understand strategic specs in `@ido4/core`.

### 1.1 Strategic spec parser
The strategic spec uses the same heading patterns as the technical spec (`# Project`, `## Group:`, `### PREFIX-NN:`) but different metadata and richer prose content. The `format: strategic-spec` marker in the project header distinguishes it.

**Approach:** New dedicated parser. The consumer is an AI agent (not the ingestion pipeline), so it needs to extract structure and pass prose content through intact, not normalize values for GitHub issue creation.

**What the parser must extract:**
- Project context (description, stakeholders, constraints, non-goals, open questions)
- Cross-cutting concerns (full prose content, organized by concern type)
- Groups with priority
- Capabilities with priority, strategic risk, depends_on, descriptions, success conditions
- Dependency graph (for decomposition ordering — topological sort reusable from spec-mapper)

**Output type:** `ParsedStrategicSpec` — typed AST similar to `ParsedSpec` but with strategic metadata.

### 1.2 Strategic spec validation
Validate structural integrity before decomposition:
- `format: strategic-spec | version: 1.0` present
- All `depends_on` references exist
- No circular dependencies
- Priority values from allowed set (`must-have`, `should-have`, `nice-to-have`)
- Risk values from allowed set (`low`, `medium`, `high`)
- Capabilities have success conditions

Content quality is NOT validated here — ido4shape already validated it.

---

## Phase 2: Code Analysis Agent

The first AI stage. Explores the codebase in the context of each strategic capability and produces the technical canvas.

### 2.1 Code analysis agent (plugin)
**Input:** Parsed strategic spec + codebase access

**Process per capability (ordered by priority + dependency):**
1. Read the capability description and success conditions
2. Read relevant cross-cutting concerns (performance targets, security requirements, etc.)
3. Explore the codebase — find relevant modules, services, APIs, schemas
4. Understand the architecture — how modules connect, what patterns are used, what conventions exist
5. Identify what needs to change — new files, modified services, migrations, tests
6. Assess real complexity — coupling, test coverage, dependency depth
7. Discover code-level dependencies not visible in the strategic spec

**Output:** Technical canvas — an intermediate artifact with per-capability sections:
- Strategic context (carried forward from ido4shape)
- Cross-cutting constraints (mapped to code reality)
- Codebase analysis (relevant modules, patterns, architecture context)
- Code-level dependency discoveries
- Complexity assessment

### 2.2 Cross-cutting concern integration
The code analysis agent maps cross-cutting concerns to code reality:
- Performance targets → which modules are on the hot path, what patterns exist
- Security requirements → where auth/encryption/validation already exists, what's missing
- Observability → existing tracing/logging infrastructure, integration points

These become constraints in the technical canvas, not separate tasks. They shape how the issue writing agent formulates every task.

---

## Phase 3: Issue Writing Agent

The second AI stage. Reads the technical canvas and produces the technical spec markdown.

### 3.1 Issue writing agent (plugin)
**Input:** Technical canvas

**Process:**
1. For each capability (with codebase knowledge from canvas):
   - Decompose into right-sized tasks (Goldilocks principle)
   - Judge effort (S/M/L/XL) grounded in actual code complexity from canvas
   - Judge risk (low/medium/high/critical) grounded in coupling and unknowns from canvas
   - Classify type (feature/bug/research/infrastructure)
   - Assess AI suitability (full/assisted/pair/human) based on code patterns from canvas
   - Set dependencies (functional from strategic spec + code-level from canvas)
   - Write task descriptions with specific file paths, service names, patterns
   - Write success conditions that are code-verifiable
2. Assemble into complete technical spec markdown (same format `spec-parser.ts` expects)

### 3.2 Dependency enrichment
- Functional dependencies from strategic spec are preserved
- Code-level dependencies discovered by the code analysis agent are added
- Both coexist. Technical dependencies are ADDED, not replacing functional ones
- Topological ordering must be valid across the combined dependency graph

### 3.3 Parent-child linking
Each strategic capability maps to its technical tasks via the ref pattern:
- Strategic NCO-01 → Technical NCO-01A, NCO-01B, NCO-01C
- Existing sub-issue infrastructure supports this relationship

---

## Phase 4: Validation & Ingestion

### 4.1 Deterministic validation
Run the technical spec through validation before ingestion:
- Format compliance — `spec-parser.ts` can parse it without errors
- Field validation — metadata values in allowed sets
- Dependency graph — no circular dependencies, all refs exist
- Quality gates — description length, success conditions present

Uses existing `spec-validate` skill and `ingest_spec` dry run.

### 4.2 Ingestion
Feed the validated technical spec into the existing pipeline. Nothing changes — `ingest_spec` works as it always has.

---

## Phase 5: Orchestration Skill

### 5.1 Decompose skill
`/ido4:decompose path/to/strategic-spec.md` — the orchestrating skill that runs the full pipeline:
1. Parse strategic spec (Phase 1)
2. Run code analysis agent (Phase 2)
3. Present technical canvas for optional review
4. Run issue writing agent (Phase 3)
5. Validate (Phase 4.1)
6. Optionally ingest (Phase 4.2) — with dry run first

---

## Work Order

| Phase | Name | Status | Dependencies |
|-------|------|--------|-------------|
| 0 | Transferred assets | COMPLETE | None |
| 1 | Strategic spec parser | NOT STARTED | None — can start now |
| 2 | Code analysis agent | NOT STARTED | Phase 1 (needs parsed spec) |
| 3 | Issue writing agent | NOT STARTED | Phase 2 (needs technical canvas) |
| 4 | Validation & ingestion | NOT STARTED | Phase 3 (needs technical spec) — mostly existing |
| 5 | Orchestration skill | NOT STARTED | Phases 1-4 |

Phase 2 and 3 are the core work — AI reasoning about codebases and judgment about task decomposition. Phase 1 is mechanical. Phase 4 is mostly existing infrastructure. Phase 5 is orchestration glue.

**First real validation:** Decompose a real strategic spec (produced by ido4shape) against a real codebase. The synthetic notification example is useful for parser testing but can't validate decomposition quality.

---

## What This Plan Does NOT Cover

- **ido4shape side:** Format redesign, skill rewrites, conversation flow changes — COMPLETE. See `/Users/bogdanionutcoman/dev-projects/ido4shape/references/strategic-spec-adaptation-plan.md`.
- **Ingestion pipeline changes:** None needed — the technical spec format is unchanged.
- **BRE changes:** None needed — BRE validates technical tasks the same way regardless of their origin.
- **Execution-time decomposition:** Future optimization. Spec-time is the first implementation.
