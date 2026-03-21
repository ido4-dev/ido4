---
date: 2026-03-21
status: ready
category: platform
---

# Context Comment Schema — Structured Institutional Memory

Define a structured template for what agents write when they complete work. Currently freeform — agents can write anything or nothing. A schema makes institutional memory parseable, searchable, and machine-readable.

**Why it matters:** The read-execute-write loop is the core of institutional memory. But if agents write unstructured prose, the "read" side can't reliably extract interfaces, decisions, or edge cases. Structured comments make the next agent's context assembly dramatically better.

**Proposed schema:**
```markdown
<!-- ido4:context transition=approve agent=agent-alpha timestamp=2026-03-21T14:30:00Z -->

## What Was Built
[Required: interfaces created, endpoints, services, key files changed]

## Decisions
[Required: key decision + rationale, trade-offs considered]

## Edge Cases
[Optional: discovered edge cases, workarounds, known limitations]

## For Downstream
[Optional: what consumers of this work need to know — API contracts, expected inputs/outputs]
```

**Implementation:**
1. Define schema as a template in core
2. Add `ContextCompletenessValidation` BRE step (warn or error on closing transition if context missing or doesn't follow schema)
3. Update `get_task_execution_data` aggregator to parse structured sections from upstream context
4. Update execution prompt to teach agents to write in this format

**Effort:** M — schema design + BRE step + aggregator update + prompt update.
**Depends on:** execution-prompt (ideally ships together, but can be independent).
