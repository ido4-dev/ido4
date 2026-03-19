# Glossary

Key terms used across ido4 documentation, organized by concept area.

## Methodology Concepts

| Term | Definition |
|---|---|
| **Methodology Profile** | A data structure defining a complete development methodology: states, transitions, containers, integrity rules, pipelines, principles, and compliance scoring. Built-in profiles: Hydro, Scrum, Shape Up. |
| **State Machine** | The valid workflow states and transitions for a methodology. Each profile defines its own state machine. |
| **Transition** | A change from one workflow state to another (e.g., `start`, `approve`, `ship`). Every transition is validated by the BRE. |
| **Principle** | A named governance rule enforced by the BRE. Principles define the non-negotiable boundaries of a methodology. |

## Container Concepts

| Term | Definition |
|---|---|
| **Container** | A methodology-specific unit that groups or schedules work. The engine is container-agnostic — profiles define container types. |
| **Execution Container** | A container that schedules when work happens. Has singularity (only one active). Examples: Wave, Sprint, Cycle. |
| **Grouping Container** | A container that organizes related work for coherence. Examples: Epic, Bet. |
| **Sub-grouping Container** | An optional finer-grained container within a grouping container. Example: Scope (within a Bet). |
| **Singularity** | The constraint that only one execution container can be active at a time. |
| **Integrity Rule** | A declared relationship between container types (e.g., all tasks in the same epic must be in the same wave). |

## Hydro Terms

| Term | Definition |
|---|---|
| **Wave** | Hydro's execution container. A self-contained unit of delivery with strict ordering. Named `wave-001-auth-system`. |
| **Epic** | Hydro's grouping container. Related tasks that must ship together. Subject to Epic Integrity. |
| **Epic Integrity** | The principle that all tasks in an epic must be in the same wave. Prevents partial feature delivery. |

## Scrum Terms

| Term | Definition |
|---|---|
| **Sprint** | Scrum's execution container. A time-boxed iteration. Named `Sprint 14`. |
| **Epic** | Scrum's grouping container. Unlike Hydro, Scrum epics span sprints (no integrity rule). |
| **User Story** | Scrum's primary work item type. Has specific DoR (acceptance criteria, effort estimation). |
| **Spike** | A research task in Scrum with relaxed DoD (no PR approval required). |
| **Type-Scoped Pipeline** | Scrum's mechanism for different validation rules per work item type. |
| **DoR / DoD** | Definition of Ready / Definition of Done — implemented as type-scoped BRE pipelines. |

## Shape Up Terms

| Term | Definition |
|---|---|
| **Cycle** | Shape Up's execution container. A fixed-time period (default 6 weeks). Named `cycle-001-notifications`. |
| **Bet** | Shape Up's grouping container. A committed pitch with defined appetite. Subject to Bet Integrity. |
| **Scope** | An optional sub-grouping within a bet. Emerges during building. Not managed by the system. |
| **Appetite** | The amount of time a bet is worth. In Shape Up, time is fixed, scope is variable. |
| **Circuit Breaker** | The principle that unfinished bets are killed at cycle end. No extensions. |
| **Cooldown** | The period between cycles for shaping new pitches and reflecting. |
| **Betting Table** | The decision point where shaped pitches are selected for a cycle. |
| **Shaping** | The process of defining a pitch: problem, appetite, solution, rabbit holes, no-gos. |
| **Shipped** | Shape Up's successful terminal state (equivalent to Done). |
| **Killed** | Shape Up's unsuccessful terminal state — circuit breaker triggered. |

## BRE Concepts

| Term | Definition |
|---|---|
| **BRE** | Business Rule Engine — the composable validation pipeline that evaluates every state transition against deterministic rules. |
| **Validation Step** | A single check in the BRE pipeline. 32 built-in steps. Steps are parameterized and composable. |
| **Pipeline** | An ordered sequence of validation steps configured for a specific transition type. |
| **Dry Run** | Running the BRE pipeline without executing the transition. Shows what would pass/fail. |
| **Skip Validation** | Bypassing BRE checks. Recorded in audit trail. Impacts compliance score. |

## Governance Concepts

| Term | Definition |
|---|---|
| **Audit Trail** | Immutable record of every governance action. Append-only JSONL. |
| **Compliance Score** | A deterministic 0-100 score computed from audit trail data across 5 weighted categories. |
| **Actor Identity** | The identity of who performed a transition — human (username) or AI (agent ID). |
| **Quality Gate** | A BRE validation step that checks code quality indicators (PR reviews, test coverage, security). |
| **Merge Readiness** | A 6-check gate that evaluates whether a task's output is ready to merge. |

## Agent Concepts

| Term | Definition |
|---|---|
| **Agent** | A registered AI coding agent with an ID, role, and capability profile. |
| **Task Lock** | An exclusive 30-minute lock preventing multiple agents from working on the same task. |
| **Work Distribution** | 4-dimension scoring that recommends optimal task assignments for agents. |
| **Cascade Value** | A scoring dimension: how many downstream tasks does completing this task unblock? |

## Pipeline Concepts

| Term | Definition |
|---|---|
| **Strategic Spec** | A specification produced by ido4shape — multi-stakeholder understanding of WHAT to build. |
| **Technical Spec** | A specification produced by ido4 MCP's decomposition pipeline — implementation tasks with HOW details. |
| **Capability** | A functional requirement from a strategic spec. Becomes an epic/bet in GitHub. |
| **Technical Canvas** | An intermediate artifact from the code analysis agent — codebase knowledge per capability. |
| **Ingestion** | The process of creating GitHub issues from a technical spec. |
| **Goldilocks Principle** | Task sizing constraint: not too small (specs fatigue), not too big (can't review), just right. |
