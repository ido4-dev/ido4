---
title: "/ido4dev:decompose"
---

The decompose skill orchestrates the strategic-to-technical spec pipeline — transforming a strategic spec (from ido4shape) into a technical spec with implementation tasks grounded in the actual codebase. It doesn't just break down a spec — it explores your codebase to find the right task boundaries and judges effort/risk based on actual code complexity, not guesses.

<details>
<summary>Decomposition Pipeline — full pipeline architecture</summary>

<a href="/diagrams/06-decomposition-pipeline.html" target="_blank" rel="noopener" title="Click to open interactive diagram">

![Decomposition Pipeline](/diagrams/previews/06-decomposition-pipeline.png)

</a>

</details>

## What It Does

`/ido4dev:decompose path/to/strategic-spec.md` runs a four-stage pipeline:

```
Strategic Spec (from ido4shape)
        |
        v
+---------------------------+
|  1. Parse                  |  strategic-spec-parser extracts
|  (deterministic)           |  structured AST from markdown
+---------------------------+
        |
        v
+---------------------------+
|  2. Code Analysis          |  AI agent explores codebase per
|  (AI — codebase access)    |  capability, produces technical canvas
+---------------------------+
        |
        v
+---------------------------+
|  3. Technical Spec Writer  |  AI agent decomposes into tasks,
|  (AI — reasoning)          |  judges effort/risk/type/ai
+---------------------------+
        |
        v
+---------------------------+
|  4. Validation & Ingestion |  Format compliance check, then
|  (deterministic)           |  GitHub issue creation
+---------------------------+
```

## Pipeline Stages

### Stage 1: Parse

The `parse_strategic_spec` tool extracts structured data from the strategic spec markdown:
- Project context (description, stakeholders, constraints, non-goals, open questions)
- Cross-cutting concerns (performance targets, security requirements, observability)
- Groups with priority
- Capabilities with priority, strategic risk, dependencies, descriptions, success conditions

### Stage 2: Code Analysis

The code analysis agent explores the codebase for each capability:
- Finds relevant modules, services, APIs, schemas
- Understands architecture patterns and conventions
- Identifies what exists vs. what's new
- Discovers code-level dependencies not in the strategic spec
- Assesses real complexity (coupling, test coverage, dependency depth)

Output: **Technical canvas** — an intermediate artifact with per-capability codebase analysis.

### Stage 3: Technical Spec Writer

The technical spec writer reads the canvas and produces implementation tasks:
- Decomposes each capability into right-sized tasks (Goldilocks principle)
- Judges effort (S/M/L/XL) grounded in actual code complexity
- Judges risk (low/medium/high/critical) based on coupling and unknowns
- Classifies type (feature/bug/research/infrastructure)
- Assesses AI suitability (full/assisted/pair/human)
- Sets dependencies (functional + code-level)
- Writes task descriptions with specific file paths and patterns
- Writes success conditions that are code-verifiable

Output: **Technical spec** in the standard `## Capability:` / `### PREFIX-NN:` format.

### Stage 4: Validation & Ingestion

The technical spec is validated (`ingest_spec` dry run) and then ingested:
- Capabilities become epic/bet GitHub issues (methodology's grouping container)
- Tasks become sub-issues of their parent capability
- Dependencies are preserved in GitHub issue fields
- All metadata (effort, risk, type, ai) is mapped to GitHub Project fields

## Two-Artifact Architecture

The decompose skill is the ido4 MCP side of a two-system pipeline:

```
ido4shape (conversation) -> strategic spec -> ido4 MCP (/decompose) -> technical spec -> GitHub issues
   Creative AI               The WHAT          Codebase analysis         The HOW         Living specs
```

- **ido4shape** produces strategic specs — multi-stakeholder understanding with minimal metadata
- **ido4 MCP** consumes strategic specs, explores the codebase, and produces technical specs with implementation tasks

## Methodology Mapping

Capabilities map uniformly to the methodology's grouping container:

| Strategic Spec | Hydro | Scrum | Shape Up |
|---|---|---|---|
| Group | *(decomposition ordering only)* | *(decomposition ordering only)* | *(decomposition ordering only)* |
| Capability | **Epic** | **Epic** | **Bet** |
| Task | Task (assigned to Wave) | Task (assigned to Sprint) | Task (assigned to Cycle) |

Groups from the strategic spec provide decomposition context but don't become GitHub issues.

## Usage

```
> /ido4dev:decompose path/to/strategic-spec.md
```

The skill will:
1. Parse and validate the strategic spec
2. Run code analysis (may take a few minutes for large codebases)
3. Present the technical canvas for optional review
4. Generate the technical spec
5. Validate format compliance
6. Optionally ingest (with dry run first for review)

## Task Granularity: The Goldilocks Principle

The technical spec writer follows the Goldilocks principle for task sizing:

- **Too small**: Agent spends more time reading specs than writing code. Governance overhead becomes noise.
- **Too big**: Reviewer can't meaningfully verify the change. Human oversight breaks down.
- **Just right**: One coherent concept that an agent executes end-to-end AND a human can review.

**Split when**: Different agents should own different parts; hard dependency boundary; scope too large to review.
**Don't split when**: Same concept across multiple files; agent would do it in one session.

## Ref Traceability

Technical tasks use suffixed refs from their parent capability:
- Strategic `NCO-01` decomposes into technical `NCO-01A`, `NCO-01B`, `NCO-01C`
- Every technical task traces back to its strategic capability through the ref pattern
