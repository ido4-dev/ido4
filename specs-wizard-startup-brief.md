# Specs-Wizard Startup Brief

## What This Document Is

This brief provides full context for continuing work on **specs-wizard** — the creative specification decomposition tool that feeds into ido4's governance engine. It covers both sides: what specs-wizard produces, and how ido4 consumes it.

---

## The Big Picture: Two-Tool Architecture

```
specs-wizard (methodology-agnostic)  →  spec artifact (.md)  →  ido4 (methodology-specific)
    Creative AI                          The contract              Governance Engine
    concept → scope → decomposition                               ingest_spec → methodology mapping
    → dependencies → risks → acceptance                           → GH issue creation
                                                                  → container assignment
                                                                  → BRE validation
```

**specs-wizard** handles creative decomposition: taking a vague project idea and, through a structured conversation, breaking it down into a well-organized dependency graph of tasks with effort estimates, risk annotations, AI suitability classifications, and verifiable success conditions.

**ido4** handles the "last mile": taking that spec artifact, applying the active methodology profile (Hydro, Scrum, or Shape Up), and creating fully-governed GitHub issues with proper fields, containers, dependency chains, and sub-issue relationships.

The **spec artifact** is the contract between them — a structured markdown file. This contract is fully defined, implemented, and live-tested.

---

## Architecture Decisions (Already Made)

### 1. Separate repository
- `ido4-dev/specs-wizard` — independent product, independent value
- specs-wizard is for PMs, founders, tech leads doing creative decomposition
- ido4 is for developers/agents executing governed work
- Different sessions, different mindsets, possibly different people

### 2. NOT an MCP server
- specs-wizard's core value is a guided conversation, not tool execution
- It doesn't need to read files, run commands, or call APIs during the creative process
- MCP adds infrastructure overhead for what is essentially a structured dialogue
- Lighter form factor = wider audience
- Could be: a Claude Project with a system prompt, a CLI conversation tool, a web app, or a well-crafted prompt template

### 3. Methodology-agnostic output
- specs-wizard NEVER asks "are you using Scrum or Shape Up?"
- It captures universal signals: task groupings, dependency graph, effort, risk, AI suitability, acceptance criteria
- All methodology mapping is ido4's job at ingestion time

### 4. "Confidently imperfect"
- specs-wizard doesn't need to produce perfect specs
- ido4's BRE refinement pipeline catches gaps during human review transitions
- Dependencies are a starting point, not gospel — humans adjust during refinement

### 5. Open source
- specs-wizard is free forever in the open-core model
- It's an adoption driver — PMs love it, want the governance pipeline, which leads them to ido4

---

## The ido4 Side (COMPLETE — What Specs-Wizard Must Produce)

### Spec Artifact Format v1

The spec artifact is a single markdown file describing a project as a dependency graph of tasks organized into logical groups.

#### Hierarchy

```
# Project Name          → project
## Group: Group Name    → logical grouping (becomes epic/bet/feature per methodology)
### PREFIX-NN: Title    → individual task (becomes GitHub issue)
```

#### Project Header

```markdown
# Project Name

> One-paragraph description of what we're building and why.
> This is the project's north star — every task should trace back to this.

**Constraints:**
- Hard constraints that scope the work

**Non-goals:**
- What we're explicitly NOT doing

**Open questions:**
- Unresolved decisions that may affect scope or approach
```

#### Group

```markdown
## Group: Group Name
> size: M | risk: medium

Description of the group — what it delivers as a unit,
why these tasks belong together, what value it provides
when complete.
```

#### Task

```markdown
### PREFIX-NN: Task Title
> effort: M | risk: low | type: feature | ai: full
> depends_on: PREFIX-NN, PREFIX-NN

Substantive description of what this task does and how.
This becomes the GitHub issue body — it must be rich enough
for an agent to execute against (≥200 chars, structured content).

Include approach hints, technical context, patterns to follow,
and integration points.

**Success conditions:**
- Specific, verifiable condition that defines "done"
- Another condition — each should be independently testable

**Technical notes:**
Optional implementation guidance.

**Open questions:**
- Optional unresolved items at task level.
```

#### Metadata Reference

| Field | Values | Where | Notes |
|-------|--------|-------|-------|
| `size` | S, M, L, XL | Group only | Overall group magnitude |
| `effort` | S, M, L, XL | Task only | S=hours, M=1-2 days, L=3-5 days, XL=1-2 weeks |
| `risk` | low, medium, high, critical | Both | low=well-understood, critical=could derail |
| `type` | feature, bug, research, infrastructure | Task only | Informs methodology mapping |
| `ai` | full, assisted, pair, human | Task only | AI execution suitability |
| `depends_on` | Comma-separated IDs, or `-` | Task only | `-` = no dependencies |

#### AI Suitability

| Value | Meaning | ido4 mapping |
|-------|---------|-------------|
| `full` | AI can execute autonomously | `ai-only` |
| `assisted` | AI executes, human reviews | `ai-reviewed` |
| `pair` | AI and human collaborate | `hybrid` |
| `human` | Human only — judgment required | `human-only` |

When omitted, ido4 defaults to `assisted`.

#### Parsing Rules

1. `#` = project title. First `>` block = project description.
2. `## Group:` = group start. Prefix derived from group name initials.
3. `### PREFIX-NN:` = task. Prefix matches parent group.
4. `>` lines immediately after any heading = metadata (pipe-separated key-value pairs).
5. Body = everything between metadata and next heading or `---`.
6. `**Success conditions:**` = acceptance criteria list (bulleted).
7. `**Technical notes:**` = optional implementation guidance.
8. `**Open questions:**` = optional unresolved items.
9. `---` between groups = visual separator (optional).
10. `depends_on: -` = explicitly no dependencies.

#### Methodology Mapping (ido4 handles this, not specs-wizard)

| Artifact concept | Hydro | Scrum | Shape Up |
|-----------------|-------|-------|----------|
| Group | Epic | Feature group | Bet |
| Task effort | Effort field (S→Small, M→Medium, L/XL→Large) | Story points (S→1, M→3, L→5, XL→8) | — |
| Task risk | Risk field | Spike candidate if high/critical | Rabbit hole flag |
| Task type: research | Task with risk=high | Spike (relaxed pipeline) | Research scope |
| Task ai | AI Suitability field | Same | Same |
| Success conditions | Acceptance Criteria | Definition of Done | "Done means" |

---

## The ido4 Ingestion Engine (COMPLETE)

The ido4 side is fully implemented, tested (1726 tests), and live-verified against a real GitHub repository:

### What Exists

```
packages/core/src/domains/ingestion/
  types.ts              — All types (ParsedSpec, MappedSpec, IngestSpecResult, etc.)
  spec-parser.ts        — parseSpec(markdown): ParsedSpec — line-by-line state machine
  spec-mapper.ts        — mapSpec(parsed, profile): MappedSpec — profile-aware transformer
  ingestion-service.ts  — IngestionService.ingestSpec(options): Promise<IngestSpecResult>
  index.ts              — Barrel exports

packages/mcp/src/tools/ingestion-tools.ts   — ingest_spec MCP tool
packages/mcp/src/schemas/ingestion-schemas.ts — Zod schema
```

### MCP Tool: `ingest_spec`

```
ingest_spec(specContent: string, dryRun?: boolean)
```

- Takes the full markdown content of the spec artifact
- `dryRun=true` → parse + validate + map, show what would be created
- `dryRun=false` → parse + validate + map + create GitHub issues
- Returns: parsed summary, created issues (with URLs), failed items, warnings, suggestions

### What It Does

1. **Parses** the markdown into a structured AST (groups, tasks, metadata, dependencies)
2. **Maps** through the active methodology profile (effort→field values, groups→containers, initial status)
3. **Topologically sorts** tasks by dependency graph (Kahn's algorithm, detects cycles)
4. **Creates group issues** first (epic/bet parent issues)
5. **Creates tasks** in dependency order (resolves refs to `#N` GitHub issue numbers)
6. **Wires sub-issue relationships** (tasks become children of their group issue)
7. **Isolates errors** — a failed task skips its dependents but doesn't block unrelated tasks

### Live Test Results (verified on b-coman/ido4-test)

- Input: 4 groups, 12 tasks (the "Real-time Notification System" example)
- Created: 16 GitHub issues (4 group + 12 task), 12 sub-issue relationships
- All tasks entered at Backlog status (Hydro profile)
- Dependencies correctly resolved: `NCO-01 → NCO-02 → NCO-03 → NCO-04` chain preserved
- Fields set: epic, dependencies, ai_suitability, task_type
- 0 failures, 0 warnings

---

## The Specs-Wizard Side (CURRENT STATE)

### Existing Codebase

Location: `/Users/bogdanionutcoman/dev-projects/specs-wizard/`

The current implementation is an older version with:
- **6-stage conversation pipeline**: concept → discovery → requirements → architecture → epics → tasks
- **Template-driven**: Each stage has a markdown template that guides the conversation
- **Shell scripts**: `bin/start-specs.sh`, `bin/init-project.sh`, etc.
- **Knowledge base**: Case studies, methodology docs, template design rationale
- **JSON validation**: `ajv`-based issue validation

The current templates and output format **predate** the spec artifact format. They produce JSON-based GitHub issues, not the spec artifact markdown. The conversation stages need updating to produce output matching the v1 artifact format.

### What Needs to Happen

specs-wizard needs to be rethought to:

1. **Output the spec artifact format** defined above — structured markdown, not JSON
2. **Be methodology-agnostic** — the current version has some methodology-specific language
3. **Capture the right signals** — effort, risk, AI suitability, dependencies, success conditions are all fields the artifact format expects
4. **Produce substantive task bodies** — ido4's SpecCompletenessValidation requires ≥200 chars with structured content markers. The conversation engine must guide users to produce rich enough descriptions.
5. **Handle the dependency graph** — task prefixes, inter-group dependencies, `depends_on` references

### Key Quality Bar

The artifact must pass through ido4's ingestion without errors:
- Every `### PREFIX-NN:` header matches `/^### ([A-Z]{2,5}-\d{2,3}):\s*(.+)$/`
- Metadata blockquotes use exact key names: `effort`, `risk`, `type`, `ai`, `depends_on`
- Metadata values are from the allowed sets (e.g., effort: S/M/L/XL, not "small"/"medium")
- Success conditions are bulleted under `**Success conditions:**`
- Task bodies are substantive (≥200 chars for ido4's quality gates)
- `depends_on` references match actual task refs defined in the document
- Groups use `## Group: Name` format (not `## Name`)

---

## Full Example: Spec Artifact

The complete example ("Real-time Notification System") is in the ido4 repo at:
`/Users/bogdanionutcoman/dev-projects/ido4-MCP/spec-artifact-format.md`

This is the reference artifact — 4 groups, 12 tasks, full dependency graph, all metadata fields populated. It has been successfully ingested by ido4 in both dry-run and live modes across all 3 methodology profiles.

---

## Context Links

| Resource | Location |
|----------|----------|
| Spec artifact format | `/Users/bogdanionutcoman/dev-projects/ido4-MCP/spec-artifact-format.md` |
| ido4 ingestion engine | `/Users/bogdanionutcoman/dev-projects/ido4-MCP/packages/core/src/domains/ingestion/` |
| ido4 MCP tool | `/Users/bogdanionutcoman/dev-projects/ido4-MCP/packages/mcp/src/tools/ingestion-tools.ts` |
| specs-wizard repo | `/Users/bogdanionutcoman/dev-projects/specs-wizard/` |
| ido4 monorepo | `/Users/bogdanionutcoman/dev-projects/ido4-MCP/` |
| Multi-agent platform vision | ido4 memory: `multi-agent-platform-vision.md` |
