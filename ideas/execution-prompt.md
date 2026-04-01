---
date: 2026-03-21
status: ready
category: experience
---

# Execution Prompt — Teach Agents the Work Loop

The 8th methodology prompt that teaches agents HOW to work with ido4. Fully designed in `architecture/context-delivery.md` (sections 6.1-6.4) but 0% implemented in prompt generators.

**Why it matters:** Agents receive full context via `get_task_execution_data` but no guidance on how to use it. Without this, agents get the data but don't know: read upstream context for interfaces → verify against acceptance criteria → write structured completion context. This is the single biggest gap between "governance platform" and "AI-hybrid development platform."

**What it teaches:**
- Read the spec and acceptance criteria first
- Load upstream dependency context — understand what was built and what interfaces to consume
- Check sibling patterns — follow established conventions
- Know who depends on your output — build with downstream consumers in mind
- Develop against success conditions, not just "make it work"
- Write structured completion context so the next agent inherits your knowledge

**Implementation:** Add `execute-task` prompt to `hydro-prompts.ts`, `scrum-prompts.ts`, `shape-up-prompts.ts`. Uses `get_task_execution_data` output structure. Profile-driven terminology (wave/sprint/cycle).

**Effort:** M — prompt content is designed, needs implementation + tests.
**Depends on:** Nothing — can be built now.
**Connects to:** context-comment-schema
