# ido4 — Vision, Architecture, and Roadmap

**Status**: Living Document (updated March 2026)
**Current Version**: v0.4.0

---

## Part 1: The Vision

### What We're Building

ido4 is the **platform that makes AI-hybrid software development work at scale** — enabling small, senior-led teams to deliver enterprise-grade software by giving AI agents shared understanding, institutional memory, and deterministic quality enforcement.

The platform runs natively inside Claude Code (and any MCP-compatible AI coding environment) as an MCP server, providing context assembly, task intelligence, institutional memory, and methodology enforcement. Every AI session starts with full project understanding. Every action is validated. Every outcome is recorded so the next session is smarter.

### The Problem We Solve

AI coding agents can now execute development tasks autonomously. But execution without governance is chaos:

- Multiple agents making conflicting decisions with no shared understanding
- No enforcement of development methodology — agents skip steps, bypass quality gates
- No audit trail — "the AI did it" is not an acceptable compliance response
- No institutional memory — each agent session starts fresh, losing accumulated knowledge

No existing tool enforces development methodology programmatically inside the coding environment.

### The Solution: The New Way of Working

**2 senior humans (PM + Tech Architect) + AI agents + ido4 = the output of a 10-person team at a fraction of the cost.**

- The **PM** provides product vision, stakeholder management, and strategic decisions
- The **Tech Architect** provides system design, code quality oversight, and technical judgment
- **AI agents** provide execution capacity — coding, testing, documentation
- **ido4** provides the **platform** — context intelligence that gives every agent full project understanding, institutional memory that compounds knowledge across sessions, task distribution that maximizes leverage, and deterministic governance that ensures quality

This isn't a better project management tool. It's the infrastructure that makes AI-hybrid software development a real, scalable way of working.

---

## Part 2: Current State (v0.4.0)

### What's Built

| Component | Status | Details |
|---|---|---|
| **@ido4/core** | Complete | 1,273 tests. BRE (34 steps), ServiceContainer (9 layers), profile-driven state machine, algorithmic ScenarioBuilder |
| **@ido4/mcp** | Complete | 458 tests. Dynamic tool/resource/prompt generation from profile. Sandbox tools with projectRoot parameter |
| **Plugin** | Complete | 21 skills (incl. onboard, guided-demo, explore), 4 agents, 2 hooks |
| **Methodology Runner** | Complete | Profile-driven engine. Hydro (57 tools), Scrum (56), Shape Up (53) |
| **Decomposition Pipeline** | Complete | Strategic spec parser, code-analyzer, technical-spec-writer, /ido4:decompose |
| **Capability Hierarchy** | Complete | Capabilities -> epic/bet, two-level GitHub issue hierarchy |
| **Sandbox System** | Complete (Blocks 1-5) | Demo codebase ([ido4-demo](https://github.com/ido4-dev/ido4-demo)), pipeline-based creation, zero-friction onboarding. See `architecture/sandbox-system-spec.md` |

### Architecture (Implemented)

```
+--------------------------------------------------------------+
|  Layer 3: Experience (packages/plugin)                        |
|  21 Skills, 4 Agents, 2 Hooks                                |
+--------------------------------------------------------------+
|  Layer 2: MCP Server (packages/mcp -- @ido4/mcp)             |
|  58 Tools (Hydro), 9 Resources, 7 Prompts, 5 Aggregators     |
+--------------------------------------------------------------+
|  Layer 1: Core Domain (packages/core -- @ido4/core)           |
|  ServiceContainer, 12 Domain Services, BRE (34 steps)        |
|  Profile-driven state machine, GitHub GraphQL with resilience |
+--------------------------------------------------------------+
|  External: GitHub Projects V2 / Issues / Pull Requests        |
+--------------------------------------------------------------+
```

### Key Capabilities

**Governance Engine**
- 34-step Business Rule Engine with profile-driven pipeline configuration
- Per-methodology validation pipelines (including type-scoped overrides for Scrum)
- Full audit trail (append-only JSONL)
- Deterministic compliance scoring (5-category, 0-100)

**Multi-Methodology Support**
- Hydro: Wave-based with epic integrity, 5 principles, 7 states, 9 transitions
- Scrum: Sprint-based with type-scoped DoR/DoD, 6 states, 8 transitions
- Shape Up: Cycle-based with circuit breaker, 8 states, 10 transitions
- Profile inheritance for custom methodologies

**Context Delivery**
- `get_task_execution_data` assembles full context in one call
- 8-phase execution prompts guide agents through specification-driven work
- Structured context comments accumulate institutional knowledge
- Context flows: upstream deps -> current task -> downstream dependents

**Multi-Agent Coordination**
- Agent registration with capabilities
- 4-dimension task scoring for work distribution
- Task locking with TTL
- Atomic complete-and-handoff

**Decomposition Pipeline**
- Two-artifact architecture: ido4shape (strategic spec) -> ido4 MCP (technical spec) -> GitHub issues
- Multi-stage pipeline: parse -> code-analyze -> write -> validate -> ingest
- Capabilities become methodology's grouping container (epic/bet)

---

## Part 3: Completed Phases

### Phase 0-2: Foundation, Core Extraction, MCP Server

Fixed all P0/P1 bugs from the CLI era. Extracted `@ido4/core` with zero CLI dependencies. Built `@ido4/mcp` with STDIO transport.

### Phase 3: Experience Layer

Skills, hooks, PM agent. Governance intelligence with composite aggregators. Governed sandbox with methodology-specific variants.

### Phase 4: Enterprise Governance

Audit trail, analytics service, agent teams, quality gates (PR review, test coverage, security scan), configurable BRE. 1,507 tests at phase completion.

### Phase 5: Methodology Runner

Profile-driven engine. Three built-in profiles. Dynamic tool/prompt/pipeline generation. Profile inheritance for custom methodologies. All methodology-specific code eliminated from the engine.

### Phase 6: Active Governance

Work distribution service (4-dimension scoring), coordination service, merge readiness gate (6-check). Multi-agent orchestration.

### Decomposition Pipeline (v0.3.0-v0.4.0)

Strategic spec parser (41 tests), `parse_strategic_spec` MCP tool, code analysis agent, technical spec writer agent, `/ido4:decompose` orchestration skill. Capability-based hierarchy: capabilities become epic/bet, tasks become sub-issues.

---

## Part 4: What's Next

### Near-Term: Validation & Polish

- **End-to-end validation**: Run the decomposition pipeline with a real strategic spec from ido4shape
- **Documentation expansion**: Multi-methodology GitBook docs, foundational architecture documents
- **Profile edge cases**: Custom profile validation, profile migration tooling

### Medium-Term: Multi-Agent Scale

- **Agent memory**: Persistent agent memory across sessions (beyond PM agent)
- **Parallel execution**: Multiple agents executing tasks simultaneously with coordination
- **Context-aware governance prompts**: Standup/board prompts enriched with upstream decision summaries
- **Performance**: Session startup optimization, tool response time profiling

### Long-Term: Platform

- **Multi-environment**: Support beyond Claude Code (Cursor, Gemini CLI, Codex)
- **Multi-project**: Enterprise teams managing multiple projects from one governance instance
- **Open-core**: Community edition + enterprise features
- **Plugin marketplace**: Third-party methodology profiles, validation steps, quality gates

---

## Part 5: Key Architectural Decisions

### Why MCP Server (not just Skills/CLAUDE.md)

Skills and CLAUDE.md rely on LLM reasoning to follow rules. LLMs skip steps, hallucinate compliance, and don't provide deterministic guarantees. The BRE must run as real code — not as instructions to an LLM.

### Why STDIO Transport

STDIO is the recommended transport for local development tools in Claude Code. No network overhead, no port management. HTTP transport can be added later for multi-user deployment.

### Why Profile-Driven (not hardcoded methodologies)

The engine must not grow per methodology. Adding SAFe should require a new profile file and possibly custom validation steps — zero changes to engine code. This is proven: Hydro, Scrum, and Shape Up all run on the same engine.

### Why GitHub as the Persistence Layer

GitHub Projects V2 provides: native issue tracking, sub-issues, labels, custom fields, GraphQL API, and the collaboration infrastructure teams already use. ido4 adds governance on top, not alongside.

### Why "Development Governance" (not "AI Project Management")

"AI Project Management" positions ido4 against Linear, Jira, and Notion — tools with massive budgets. "Development Governance" is a new category: "How do we ensure our AI agents follow our development methodology?"

---

## Part 6: Success Metrics

### Technical (Achieved)

| Metric | Target | Actual |
|---|---|---|
| Test coverage | >90% | 1,767 tests |
| Zero `any` types in core | 100% | Achieved |
| Zero `@ts-ignore` | 100% | Achieved |
| BRE validation time | <500ms | Achieved |
| Profile count | 3+ | 3 built-in + inheritance |

### Business (Pilot Phase)

| Metric | Target |
|---|---|
| Tasks managed per engagement | 50+ |
| Methodology compliance rate | >95% |
| BRE override rate | <5% |
| Time to first transition | <5 minutes after setup |

### Market (6 Months Post-Launch)

| Metric | Target |
|---|---|
| npm weekly downloads | 500+ |
| GitHub stars | 500+ |
| Enterprise pilot engagements | 2-3 |
| Community contributions | 10+ PRs |

---

*This document is the north star for ido4 development. Every decision, every PR, every architecture choice should be evaluated against the vision described here.*
