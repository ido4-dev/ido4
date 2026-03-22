# Two-Artifact Pipeline — ido4shape ↔ ido4 MCP Connection

## Overview

The two-artifact pipeline is how ideas become executable work for AI agents. ido4shape captures multi-stakeholder understanding (the WHAT), ido4 MCP decomposes it against the codebase (the HOW), and the result is GitHub issues that carry full context — not just task titles, but specifications that AI agents can execute against with understanding of intent, dependencies, and success criteria.

```
ido4shape (conversation)  →  strategic spec  →  ido4 MCP (decomposition)  →  technical spec  →  ingestion  →  GitHub issues
    Creative AI                The WHAT              Codebase analysis           The HOW          Mechanical      Living specs
```

**ido4shape** produces strategic specs — rich prose capturing what stakeholders need, why, and what "done" looks like. Minimal metadata (priority, strategic risk, functional dependencies). No implementation assumptions.

**ido4 MCP** consumes strategic specs, analyzes the codebase, and produces technical specs — implementation tasks with code-grounded metadata (effort, risk, type, AI suitability, code-level dependencies).

## The Contract: Strategic Spec Format

The strategic spec is the interface between the two systems. It's defined and owned by ido4shape:

- Format: `references/strategic-spec-format.md` in ido4shape repo
- Example: `references/example-strategic-notification-system.md` in ido4shape repo
- Format marker: `> format: strategic-spec | version: 1.0`

**Structure:**
```markdown
# Project Name
> format: strategic-spec | version: 1.0

[Problem statement, stakeholders, constraints, non-goals, open questions]

## Cross-Cutting Concerns
### [Concern Name]
[Performance targets, security requirements, observability needs]

## Group: [Capability Cluster Name]
> priority: must-have|should-have|nice-to-have

### PREFIX-NN: [Capability Name]
> priority: must-have|should-have|nice-to-have | risk: low|medium|high
> depends_on: PREFIX-NN, PREFIX-NN | -

[Rich description with stakeholder attributions]

**Success conditions:**
- [Product-level, independently verifiable]
```

**Key elements:**
- **Groups**: Organizational clusters with priority. Used by ido4 MCP for decomposition ordering and context, but do NOT become GitHub issues.
- **Capabilities**: Functional requirements. Become epic/bet GitHub issues in ido4 MCP.
- **No implementation metadata**: No effort, type, or AI suitability — these require codebase knowledge.

## How ido4 MCP Consumes Strategic Specs

The decomposition pipeline (`/ido4dev:decompose` skill):

1. **Parse** — `parseStrategicSpec()` extracts structured AST from the markdown
2. **Analyze** — Code analysis agent explores the codebase per capability, produces a technical canvas
3. **Write** — Technical spec writer produces `## Capability:` sections with implementation tasks
4. **Validate** — `ingest_spec` dry run checks format compliance
5. **Ingest** — Creates GitHub issues: capabilities as epics/bets, tasks as sub-issues

## The Contract: Technical Spec Format

The technical spec is the interface between the decomposition pipeline and the ingestion engine. Defined in `architecture/spec-artifact-format.md`.

**Structure:**
```markdown
# Project Name — Technical Spec
> [Description]

## Capability: [Name]
> size: S|M|L|XL | risk: low|medium|high|critical

### PREFIX-NNA: [Task Title]
> effort: S|M|L|XL | risk: low|medium|high|critical | type: feature|bug|research|infrastructure | ai: full|assisted|pair|human
> depends_on: PREFIX-NNA, PREFIX-NNB | -
```

## Methodology Mapping

Capabilities map uniformly to the methodology's grouping container:

| Strategic Spec | Hydro | Shape Up | Scrum |
|---|---|---|---|
| Group | *(decomposition ordering only)* | *(decomposition ordering only)* | *(decomposition ordering only)* |
| Capability | **Epic** | **Bet** | **Epic** |
| Task | Task (in wave) | Task (in cycle) | Task (in sprint) |

## System Boundaries

ido4shape and ido4 MCP are independent systems connected by the strategic spec contract.

- **Changes inside ido4 MCP** (e.g., multi-stage pipeline architecture, capability-based ingestion) do NOT affect ido4shape — the contract is unchanged.
- **Changes inside ido4shape** (e.g., conversation flow, canvas structure) do NOT affect ido4 MCP — as long as the output format is preserved.
- **Format changes** require coordination between both systems.

## Related Files

- Strategic spec parser: `packages/core/src/domains/ingestion/strategic-spec-parser.ts`
- `parse_strategic_spec` MCP tool: `packages/mcp/src/tools/ingestion-tools.ts`
- Code analysis agent: `[ido4dev](https://github.com/ido4-dev/ido4dev) agents/code-analyzer.md`
- Technical spec writer: `[ido4dev](https://github.com/ido4-dev/ido4dev) agents/technical-spec-writer.md`
- Decompose skill: `[ido4dev](https://github.com/ido4-dev/ido4dev) skills/decompose/SKILL.md`
- Technical spec format: `architecture/spec-artifact-format.md`
- ido4shape repo: `/Users/bogdanionutcoman/dev-projects/ido4shape/`
