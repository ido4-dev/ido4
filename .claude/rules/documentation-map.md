---
paths:
  - "packages/core/src/**"
  - "packages/mcp/src/**"
  - "packages/spec-format/src/**"
  - "architecture/**"
  - "docs/**"
---

# Documentation Map

When changing code in these areas, check and update the affected documentation:

| Code Area | Affected Docs | Affected Diagrams |
|---|---|---|
| `packages/core/src/domains/tasks/` (BRE, validation) | `architecture/validation-extensibility.md`, `docs/src/content/docs/concepts/business-rule-engine.md` | `diagrams/04-bre-pipeline.html` |
| `packages/core/src/domains/audit/`, `analytics/`, `compliance/` | `architecture/event-sourced-governance.md`, `docs/src/content/docs/concepts/audit-compliance.md` | `diagrams/03-event-sourcing.html` |
| `packages/core/src/domains/agents/`, `distribution/`, `gate/` | `architecture/multi-agent-coordination.md`, `docs/src/content/docs/concepts/multi-agent.md` | `diagrams/07-multi-agent.html` |
| `packages/core/src/container/service-container.ts` | `architecture/technical-stack.md` | `diagrams/08-service-container.html` |
| `packages/core/src/profiles/` | `architecture/methodology-runner.md` | `diagrams/05-profile-generation.html` |
| `packages/spec-format/src/` | `architecture/decomposition-pipeline.md`, `architecture/two-artifact-pipeline.md` | `diagrams/06-decomposition-pipeline.html` |
| `packages/core/src/domains/ingestion/` | `architecture/decomposition-pipeline.md` | `diagrams/06-decomposition-pipeline.html` |
| `packages/mcp/src/` | `architecture/vision-and-roadmap.md` | `diagrams/01-system-overview.html`, `diagrams/02-request-flow.html` |
