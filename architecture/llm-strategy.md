# LLM Strategy — How ido4 Uses AI Capabilities

## Core Principle: System Carries Knowledge, Not the Agent

AI agents are stateless. Each session starts fresh. An agent doesn't "learn auth" by working on auth tasks — it's a fresh LLM instance every time. The idea of specialized agents that accumulate expertise is anthropomorphism.

What IS real: a fresh agent with the right 100K tokens of context will massively outperform a "specialized" agent with wrong context.

Therefore: **knowledge belongs to the system, not the agent.** ido4's role is to assemble the right context at the right moment and deliver it to any agent — regardless of whether it's Claude, Gemini, Codex, or Cursor. The agent is raw compute. ido4 is the institutional memory.

## The Deterministic/AI Boundary

ido4 draws a sharp line between what must be deterministic and what benefits from AI reasoning:

### Deterministic (the BRE)

Everything that constitutes governance MUST be deterministic code:
- State transition validation
- Dependency checking
- Container integrity enforcement
- Compliance scoring
- Audit trail recording
- Quality gate checks

LLMs skip steps, hallucinate compliance, and don't provide deterministic guarantees. The BRE runs TypeScript code and returns real validation results. An agent cannot convince the BRE to skip a check.

### AI-Assisted (prompts, skills, agents)

Everything that involves interpretation, analysis, or synthesis uses AI reasoning:
- Standup briefings (interpreting governance data)
- Wave/sprint/cycle planning (balancing constraints)
- Retrospectives (finding patterns in data)
- Code analysis for decomposition
- Task description writing
- Context interpretation from upstream dependencies

The pattern: **deterministic tools gather data, AI skills interpret it.**

## Prompt Design Principles

### 1. Data First, Then Reasoning

Every prompt instructs the AI to call MCP tools first, then reason about the results:

```
1. Call get_standup_data
2. Analyze the results for patterns
3. Present findings grounded in evidence
```

Never ask the AI to estimate, assume, or recall. Always point to a tool call result.

### 2. Methodology-Native Terminology

Prompts use the active methodology's terminology. A Hydro user sees "Wave" and "Epic Integrity." A Scrum user sees "Sprint" and "Definition of Done." A Shape Up user sees "Cycle" and "Circuit Breaker."

The prompt generators read the methodology profile and produce methodology-specific content. This isn't localization — it's conceptual alignment. The reasoning framework changes, not just the words.

### 3. Evidence-Grounded Recommendations

Skills never say "things seem slow" — they say "Task #38 has been In Progress for 4.2 days (your wave average is 2.1 days)." Every insight has a data source. Every recommendation has a specific action.

### 4. Context Assembly Over Context Storage

Rather than storing pre-computed context, ido4 assembles context on demand:
- `get_task_execution_data` aggregates upstream deps, siblings, downstream needs, and epic progress in a single call
- Execution prompts guide agents through interpreting this assembled context
- Context comments on GitHub issues form the persistent knowledge store

## The Four AI Touchpoints

### 1. Skills (21)

Claude Code SKILL.md files that compose MCP tools into governance workflows. Skills are structured prompts — they tell Claude what to do, not how to think. Includes onboard, guided-demo, sandbox-explore, decompose, and methodology-specific variants.

### 2. Agents (4)

Claude Code AGENT.md files for specialized roles:
- **PM Agent** — Persistent governance brain with memory across sessions
- **Code Analyzer** — Explores codebases for decomposition
- **Technical Spec Writer** — Produces implementation tasks from canvas
- **Spec Reviewer** — Independent quality review of specs

### 3. Prompts (8)

MCP server prompts portable to any MCP-compatible client. Same content as skills but without Claude Code-specific features (memory, file access). Includes the execute-task prompt for methodology-aware task execution guidance.

### 4. Execution Prompts (per methodology)

Methodology-specific guides for agents executing tasks:
- Phase 1: Specification Comprehension
- Phase 2: Upstream Context Interpretation
- Phase 3: Downstream Awareness
- Phase 4: Pattern Detection
- Phase 5: Work Execution (methodology-specific)
- Phase 6: Escalation Protocol
- Phase 7: Context Capture
- Phase 8: Completion Verification

## Context Delivery Pipeline

When an agent starts a task, the system assembles context from multiple sources:

```
Task spec (GitHub issue body)           --+
Upstream dep context comments            |
Sibling task status + context            +--> get_task_execution_data --> Agent
Downstream dependent specs               |
Epic/bet progress                        |
Execution intelligence (risk flags)     --+
```

The agent receives one structured payload with everything it needs. No manual fetching, no context hunting.

## The Read-Execute-Write Loop

```
Agent reads context (assembled by system)
    |
    v
Agent executes work (guided by methodology prompt)
    |
    v
Agent writes context (structured comments on GitHub issue)
    |
    v
Next agent reads context (system delivers accumulated knowledge)
```

This loop is how institutional memory grows even though individual agents are stateless. Each completed task enriches the knowledge base for downstream work.

## What ido4 Does NOT Use AI For

- **Validation decisions** — Always deterministic BRE code
- **Compliance scoring** — Always deterministic computation from audit data
- **State machine transitions** — Always profile-driven code
- **Audit trail recording** — Always append-only mechanical writing
- **Integrity rule enforcement** — Always declarative rules from profile

The rule: if it constitutes governance, it must be deterministic. If it's wrong, the system is wrong — not "the AI made a mistake."
