# Development Context Pipeline
> format: strategic-spec | version: 1.0

> AI agents in ido4-governed projects start each task with minimal context —
> they know the rules (BRE, audit, compliance) but not the project. When an
> agent begins task #42, it gets a title and status transition but must
> manually fetch dependency context, sibling decisions, and downstream
> expectations. Most agents skip this and code from the title alone, leading
> to integration failures, duplicated patterns, and missed interfaces.

> We need a context delivery system that assembles the right knowledge at
> the right moment — upstream decisions, sibling patterns, downstream
> expectations — and delivers it to any agent starting or resuming work.

**Stakeholders:**
- Bogdan (Product/Architecture): Defined the "system carries knowledge, not the agent" principle. Agents are stateless — context must be assembled per-session. GitHub issues are living specs that accumulate context over their lifecycle.
- Agent teams (consumers): Need structured context at task start without manual fetching. Current workflow requires 5-8 separate API calls to understand a task's position in the project graph.
- Enterprise users (future): Need audit trail of what context was provided to agents and what decisions they made — accountability requires traceability.

**Constraints:**
- Must work with existing GitHub issue infrastructure — comments, bodies, labels. No external storage.
- Must integrate with existing ServiceContainer and MCP tool architecture — no new server processes.
- Context comments must be parseable by both humans and machines — structured but readable.
- Must not require changes to the BRE validation pipeline — context is additive, not a new gate.

**Non-goals:**
- Real-time collaboration between concurrent agents — context is assembled at task start, not streamed.
- Replacing the task spec (issue body) — context enriches, it doesn't redefine the work.
- Agent-specific formatting — context is delivered in a universal format, not tailored per AI model.

**Open questions:**
- Should context snapshots be cached or assembled fresh each time? Caching is faster but may go stale.
- How much upstream context is too much? Deep dependency chains could overwhelm agent context windows.

---

## Cross-Cutting Concerns

### Performance
Context assembly touches multiple GitHub API endpoints (task details, dependency graph, comments for each dependency). Must batch where possible and parallelize fetches. Target: full context assembly under 5 seconds for a task with 3 dependencies and 5 siblings.

### Data Integrity
Context comments become part of the audit trail. Once written, they should not be edited — append-only pattern. Context must accurately reflect the state at the time of assembly, not a cached or stale view.

### Observability
Every context assembly should be traceable — what was fetched, what was included, what was omitted (and why). This enables debugging when an agent makes a bad decision despite "having context."

---

## Group: Context Assembly
> priority: must-have

The engine that gathers and structures context for a task. Reads the dependency graph, fetches upstream decisions, identifies sibling patterns, and assembles everything into a structured context package that any agent can consume.

### CTX-01: Task Execution Data Aggregator
> priority: must-have | risk: low
> depends_on: -

Consolidate the existing task execution aggregator into a reliable context source. It already fetches upstream dependencies, epic siblings, downstream dependents, and computes execution intelligence (risk flags, critical path, dependency signals). The foundation exists but needs hardening for production use as the primary context delivery mechanism.

**Success conditions:**
- Assembles full task context (upstream + siblings + downstream + epic progress) in a single call
- Handles missing or inaccessible dependencies gracefully without failing the whole assembly
- Returns structured data with clear separation between dependency context, sibling context, and downstream expectations
- Performance: completes within 5 seconds for typical task graphs

### CTX-02: Context Comment Parser
> priority: must-have | risk: low
> depends_on: CTX-01

Parse structured context from GitHub issue comments. Agents write context at key transitions (start, review, complete) using a structured format. The parser extracts these structured blocks from the comment stream, enabling the aggregator to include upstream decisions in downstream task context.

**Success conditions:**
- Parses ido4 context comment format from issue comment bodies
- Extracts transition type, agent identity, timestamp, and structured content
- Handles comments with mixed structured and unstructured content
- Returns ordered context blocks per issue

### CTX-03: Context Enrichment Service
> priority: must-have | risk: medium
> depends_on: CTX-01, CTX-02

The orchestrator that combines raw task data with parsed context comments to produce enriched context packages. For each upstream dependency, includes not just status but the decisions made, interfaces created, and patterns established. For siblings, includes what parallel agents decided so the current agent can align.

**Success conditions:**
- Produces enriched context that includes upstream decisions and interface descriptions
- Cross-cutting concerns from the project spec are woven into relevant task context
- Context package is self-contained — an agent can understand its task without additional API calls
- Handles partial context gracefully (some deps may have no context comments)

---

## Group: Context Delivery
> priority: must-have

How context reaches agents. The MCP tools and prompts that deliver assembled context at the right moment in the task lifecycle.

### CDL-01: Start Task Context Injection
> priority: must-have | risk: medium
> depends_on: CTX-03

When an agent calls `start_task`, automatically assemble and deliver the full context package alongside the task briefing. The agent receives not just "start working on #42" but a complete understanding of what upstream produced, what siblings decided, and what downstream expects.

**Success conditions:**
- `start_task` response includes assembled context alongside task details
- Context is structured for agent consumption (clear sections, not raw JSON)
- Agent can understand task position in the project graph without additional calls
- Existing `start_task` behavior is preserved — context is additive

### CDL-02: Context Writing Tools
> priority: must-have | risk: low
> depends_on: CTX-02

MCP tools for agents to write structured context back to issues at key transitions. When an agent completes a review or makes a design decision, it writes structured context that future agents (working on downstream tasks) can consume.

**Success conditions:**
- MCP tool to write structured context comment on an issue
- Context format includes: transition, agent identity, timestamp, structured content
- Written context is immediately available to the context parser
- Integrates with existing audit trail (context writes are governance events)

### CDL-03: Context-Aware Prompts
> priority: should-have | risk: low
> depends_on: CTX-03, CDL-01

Enhanced MCP prompts (standup, board, health) that leverage assembled context to produce richer, more actionable guidance. A standup that knows what each agent's upstream dependencies decided is more valuable than one that just reports statuses.

**Success conditions:**
- Standup prompt includes upstream decision summaries for in-progress tasks
- Board prompt highlights context gaps (tasks with dependencies that have no context comments)
- Prompts degrade gracefully when context is unavailable
