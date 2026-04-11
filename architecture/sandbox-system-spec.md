# Sandbox System Specification

> **Status**: IMPLEMENTED (Blocks 1-5) — Algorithmic ScenarioBuilder from ingestion pipeline. See `packages/core/src/domains/sandbox/scenario-builder.ts`.
> **Author**: AI-Hybrid Session (2026-03-21)
> **Scope**: Full sandbox system redesign — enhanced governance scenarios, demo codebase, guided demo, onboarding, interactive exploration, full pipeline demonstration
> **Touches**: @ido4/core (scenarios, types), @ido4/mcp (tools), plugin (skills), new repo (ido4-demo)

---

## 1. Vision & Purpose

### 1.1 What the Sandbox System Is

The sandbox system is ido4's **primary touchpoint** with the outside world. It serves four distinct audiences with one unified infrastructure:

| Audience | Need | What They Experience |
|----------|------|---------------------|
| **Prospects** | "Does this actually work?" | Guided demo — governance discovers violations, BRE blocks invalid transitions, full pipeline from spec to governed code |
| **New Users / Pilot Teams** | "How do I use this?" | Onboarding — progressive discovery of governance concepts through interaction, not documentation |
| **The ido4 Team** | "Does our system work correctly?" | Testing playground — reset-and-replay, exercise every governance path, validate skills against realistic data |
| **Evaluators** | "Can I try this with real work?" | Live environment — real codebase, real decomposition, real agent execution under governance |

### 1.2 What the Sandbox System Is NOT

- Not a tutorial for teaching people how to code
- Not a methodology learning path (Hydro/Scrum/Shape Up are governance profiles, not curricula)
- Not a simulated environment — everything is real: real GitHub projects, real issues, real code, real BRE validation, real audit trails
- Not tied to one methodology — the same demo codebase works with all three profiles

### 1.3 Design Principles

1. **Governance is the star.** The codebase, the project, the issues — they're the stage. Governance is the performance. Every design decision should make governance more visible, more tangible, more compelling.

2. **Real, not simulated.** Seeded data must be indistinguishable from data produced by actual project work. PRs have real code. Context comments reference real files. Audit events have realistic temporal distribution.

3. **One codebase, three methodologies.** Methodology-agnosticism is a key differentiator. The same demo project governed by Hydro, Scrum, or Shape Up — the governance adapts, the engine stays the same.

4. **Self-presenting.** The sandbox should be able to tell its own story. A guided demo skill walks through findings without requiring the user to know which skills to run or what to look for.

5. **Reset is instant.** The entire environment (code + project + issues + audit trail) resets to starting state in seconds. This enables infinite replay for testing, demos, and exploration.

6. **Progressive depth.** First touch is guided and accessible. Deeper exploration is available for those who want it. The full pipeline demonstration is the deepest layer — real decomposition, real agent execution, real governance enforcement.

---

## 2. System Architecture

### 2.1 Two-Layer Model

```
Layer 2: Live Demo Environment (new)
  ├── Demo codebase (ido4-demo repo)
  ├── Strategic spec (ships with repo)
  ├── Full pipeline demonstration
  └── Agent execution against real code

Layer 1: Governance Sandbox (existing, enhanced)
  ├── GitHub Project V2 with governed issues
  ├── Enhanced scenarios with narrative
  ├── Seeded audit trail, agents, PRs
  └── Guided demo + onboarding skills
```

**Layer 1** works standalone — no repo required. Fast creation, lightweight, governance-focused. This is what CI/CD tests use and what quick demos use.

**Layer 2** adds a real codebase on top of Layer 1. This enables the full pipeline: decomposition against real code, agent execution producing real changes, PRs with meaningful diffs. This is what makes demos compelling and what enables real testing.

Both layers share the same sandbox lifecycle tools (`create_sandbox`, `destroy_sandbox`, `reset_sandbox`).

### 2.2 Component Map

```
ido4-demo/                              NEW REPO
├── src/                                Real TypeScript API service
├── specs/
│   └── notification-platform.md        Strategic spec (ido4shape format)
├── sandbox/
│   ├── reset.sh                        Restore codebase to starting state
│   └── README.md                       How to use with ido4
├── package.json
├── tsconfig.json
└── README.md

ido4/packages/core/                 ENHANCED
├── src/domains/sandbox/
│   ├── sandbox-service.ts              Enhanced: repo awareness, richer creation
│   ├── types.ts                        Enhanced: narrative types, repo reference
│   └── scenarios/
│       ├── hydro-governance.ts         Enhanced: narrative, code references
│       ├── scrum-sprint.ts             Enhanced: narrative, code references
│       └── shape-up-cycle.ts           Enhanced: narrative, code references

ido4-dev/ido4dev (standalone repo)
├── skills/
│   ├── sandbox.md                      Enhanced: methodology guidance
│   ├── guided-demo.md                  NEW: Choreographed demo walkthrough
│   ├── onboarding.md                   NEW: First-touch experience
│   └── sandbox-explore.md             NEW: Interactive governance exploration
```

### 2.3 Data Flow

```
User chooses methodology
         │
         ▼
create_sandbox(scenarioId, repository)
         │
         ├── Resolves profile from scenario
         ├── Creates GitHub Project V2 + fields + statuses
         ├── Creates parent issues (epics/bets)
         ├── Creates task issues (referencing real code paths)
         ├── Seeds audit trail, agents, PRs (with real code)
         ├── Writes context comments (referencing real files)
         └── Returns sandbox ready for exploration
         │
         ▼
Guided demo / Onboarding / Free exploration
         │
         ├── Governance discovery (standup, health, compliance)
         ├── Interactive enforcement (try transitions, BRE catches)
         ├── Pipeline demonstration (decompose strategic spec)
         └── Agent execution (real code under governance)
         │
         ▼
reset_sandbox → back to starting state (code + project + issues)
```

---

## 3. Demo Codebase: `ido4-demo`

### 3.1 Domain: Notification Platform API

A TypeScript backend API service for a notification/messaging platform. Chosen because:

- **Recognizable** — every engineer has worked on notification systems
- **Natural dependency chains** — channels depend on delivery, analytics depend on events, integrations depend on channels + auth
- **Multiple domains** — enough complexity for governance to matter
- **Not distracting** — simple enough to understand in a demo without studying the code

### 3.2 Module Structure & Completion State

```
src/
├── auth/                   COMPLETE (~100%)
│   ├── auth-service.ts         User management, API key generation
│   ├── jwt-provider.ts         Token creation and verification
│   ├── permissions.ts          Role-based access control
│   ├── types.ts                Auth domain types
│   └── __tests__/              Full test coverage
│
├── notifications/          PARTIAL (~50%)
│   ├── event-model.ts          COMPLETE — Notification event schema & validation
│   ├── event-bus.ts            COMPLETE — Internal event routing
│   ├── delivery-engine.ts      STUB — Interface defined, core logic started, not functional
│   ├── retry-policy.ts         STUB — Exponential backoff skeleton
│   ├── types.ts                COMPLETE — Notification domain types
│   └── __tests__/              Tests for completed parts only
│
├── templates/              PARTIAL (~40%)
│   ├── template-engine.ts      COMPLETE — Handlebars-based template compilation
│   ├── template-store.ts       COMPLETE — CRUD for templates
│   ├── renderer.ts             STUB — Template → final output, not implemented
│   ├── types.ts                COMPLETE
│   └── __tests__/              Tests for engine and store
│
├── channels/               INTERFACE ONLY (~10%)
│   ├── channel-registry.ts     Interface + registry pattern, no implementations
│   ├── types.ts                Channel types (email, SMS, push, webhook)
│   └── providers/
│       ├── email.ts            EMPTY — provider interface only
│       ├── sms.ts              EMPTY
│       ├── push.ts             EMPTY
│       └── webhook.ts          EMPTY
│
├── analytics/              EMPTY (0%)
│   └── README.md               "Planned — see strategic spec"
│
├── integrations/           EMPTY (0%)
│   └── README.md               "Planned — see strategic spec"
│
├── shared/                 COMPLETE
│   ├── errors.ts               Structured error types
│   ├── logger.ts               Logging infrastructure
│   ├── config.ts               Configuration management
│   └── validation.ts           Input validation utilities
│
├── api/                    PARTIAL (~30%)
│   ├── server.ts               Express setup, middleware chain
│   ├── routes/
│   │   ├── auth.ts             COMPLETE — Auth endpoints
│   │   ├── notifications.ts    STUB — POST /notify endpoint, not connected to delivery
│   │   └── templates.ts        PARTIAL — CRUD routes, missing rendering endpoint
│   └── middleware/
│       ├── auth-middleware.ts   COMPLETE — JWT verification
│       └── rate-limiter.ts     STUB — Interface only
│
└── index.ts                    Entry point
```

### 3.3 Why This Completion Distribution

- **Auth complete (100%)**: Establishes code patterns, conventions, test style. Agents analyzing the codebase learn "how this project does things" from auth.
- **Notifications partial (50%)**: The heart of the project. Enough done to show patterns, enough gaps to decompose and build. The delivery engine is the critical path — multiple things depend on it.
- **Templates partial (40%)**: Shows a module mid-development. Renderer depends on template engine (done) but also on channel types (not done) — dependency tension.
- **Channels interface-only (10%)**: Strategic dependency point. Nothing can be delivered without channels. The registry pattern is defined but no providers exist — decomposition must create them.
- **Analytics/Integrations empty (0%)**: Future capabilities described in the strategic spec. These exist to demonstrate decomposition planning against empty modules.
- **API partial (30%)**: Working server with auth endpoints. Notification endpoint exists but doesn't connect to delivery. Shows integration gaps.

### 3.4 Design Constraints

- **TypeScript, strict mode.** Matches ido4's own stack. Target audience works in TypeScript.
- **Express + no ORM.** Simple, recognizable stack. No framework complexity to explain during demos.
- **No external dependencies beyond basics.** No database, no Redis, no message queue. Uses in-memory stores and file-based persistence. The demo must work without infrastructure setup.
- **Clean architecture patterns.** Service layer + types + tests. Consistent with what agents would see in real enterprise projects.
- **~2,000-3,000 lines of code total.** Enough to be substantive, small enough to navigate in a demo.
- **Vitest for testing.** Consistent with ido4's own test framework.

### 3.5 The Strategic Spec

A full strategic spec (ido4shape format) ships with the repo at `specs/notification-platform.md`. It describes:

- **Problem statement**: "The notification platform API needs to evolve from a partially-built prototype into a production-ready service supporting multi-channel delivery, template-based content, analytics, and third-party integrations."
- **Stakeholders**: Platform team (delivery reliability), product team (analytics visibility), integration partners (webhook/API access)
- **Constraints**: No external infrastructure dependencies, must maintain existing auth API contract, TypeScript strict mode
- **Non-goals**: UI/frontend, real-time WebSocket delivery, message queue infrastructure
- **Cross-cutting concerns**: Error handling patterns (existing in shared/), test coverage expectations, API versioning strategy
- **Capabilities**: 6-8 strategic capabilities mapping to the incomplete modules:
  - Notification Delivery Engine (complete the core)
  - Multi-Channel Provider System (email, SMS, push, webhook)
  - Template Rendering Pipeline (connect template engine to delivery)
  - Notification Analytics (event tracking, delivery metrics)
  - Integration Webhook System (outbound webhooks for third parties)
  - API Completion (rate limiting, notification endpoints, rendering endpoints)

This spec is what `/ido4dev:decompose` runs against. The decomposition pipeline analyzes the real codebase, discovers existing patterns, and produces a technical spec with implementation tasks grounded in actual code.

### 3.6 Reset Infrastructure

```bash
# sandbox/reset.sh
# Restores the demo repo to its starting state

# 1. Git reset to the tagged starting point
git checkout main
git reset --hard sandbox-start

# 2. Clean untracked files (agent-created code)
git clean -fd

# 3. Destroy sandbox project (if exists)
# (User runs destroy_sandbox via ido4 or this script calls it)
```

The `sandbox-start` tag marks the initial state of the codebase. After agents work on it (writing code, creating branches, PRs), reset restores everything.

**For the ido4 side**, `reset_sandbox` already handles the GitHub project cleanup. Combined with the repo reset, you get full environment restoration.

---

## 4. Enhanced Governance Scenarios

### 4.1 Scenario Narrative Structure

Each scenario gains a `narrative` field — a structured story that gives violations context:

```typescript
interface ScenarioNarrative {
  /** One-paragraph project setup — what this team is building and where they are */
  setup: string;

  /** The tension — what's going wrong and why it matters */
  tension: string;

  /** Per-violation context — why this specific violation happened in this story */
  violationContext: Record<string, string>;

  /** What governance should surface — expected findings when skills analyze this */
  expectedFindings: string[];

  /** The resolution path — what fixing the violations looks like */
  resolution: string;
}
```

### 4.2 Hydro Governance Scenario Narrative

**Setup**: "A platform team is 3 weeks into building a notification service. Wave 1 (Foundation) shipped cleanly — auth, event model, and shared infrastructure are done. Wave 2 (Core Delivery) is active with 10 tasks across 5 epics. Two agents (alpha and beta) are assigned."

**Tension**: "The auth epic was supposed to be contained in Wave 1, but a late-discovered requirement for API key rotation pushed one task into Wave 2 — epic integrity is broken. The delivery engine task (T7) has been in progress for 3 days, blocking the retry policy (T8) and channel routing (T9) — a 3-level cascade. Agent alpha is stuck on T7. Meanwhile, T10 (rate limiting) shows 'In Review' but has no PR — someone updated the status manually without doing the work. T12 (session management) has a real PR but zero reviews after 4 days — the review bottleneck is slowing the entire wave."

**Violation Context**:
- `EPIC_INTEGRITY_VIOLATION`: "The API key rotation requirement surfaced during Wave 1 retro. Rather than waiting for Wave 3, someone assigned it to Wave 2 under the auth epic — splitting the epic across waves."
- `CASCADE_BLOCKER`: "The delivery engine (T7) turned out to be more complex than estimated. The retry policy and channel routing both depend on its interfaces. Agent alpha has been working on it but the event model needed changes that weren't anticipated."
- `FALSE_STATUS`: "T10 was moved to In Review during a status sync meeting, but the developer hadn't actually opened a PR. The status was updated optimistically."
- `REVIEW_BOTTLENECK`: "T12's PR was opened 4 days ago. The team's only senior reviewer has been pulled into incident response on another project."

**Expected Findings**: Standup surfaces cascade blocker as highest priority. Compliance shows epic integrity violation. Health shows wave at risk. Work distribution recommends T8 for agent-beta (highest cascade value once T7 unblocks).

**Resolution**: "Fix epic integrity by moving T16 back to Wave 3 (or creating a Wave 2 sub-epic). Unblock T7 by pairing agent-beta on the event model changes. Flag T10's false status for correction. Escalate T12's review bottleneck."

### 4.3 Scrum Sprint Scenario Narrative

**Setup**: "An e-commerce team is mid-Sprint 14. They carry 2 completed tasks from Sprint 13 and have 10 active tasks across 5 work types (stories, bugs, spikes, tech debt, chores). 3 backlog items are being groomed for Sprint 15."

**Tension**: "A product manager pushed a cart abandonment analytics story (T5) into the sprint without acceptance criteria — DoR violation. The order processing refactor (T8, tech debt) has a PR open for 3 days with zero reviews — the team's definition of done requires 2 approvals. A critical auth migration story (T15, XL, CRITICAL risk) is sitting in backlog under pressure from the security team to pull it into the current sprint — scope creep risk. The payment webhook bug fix (T11) is blocked by the payment gateway integration (T3) which is still in progress."

**Violation Context**:
- `DOR_VIOLATION`: "Product pushed T5 in during sprint planning, insisting it was urgent. The team agreed to take it without completing the acceptance criteria, planning to 'figure it out during implementation.' The BRE should have caught this at sprint entry."
- `FALSE_STATUS`: "T10 was marked In Review after a verbal code walkthrough, but no formal PR was created. The team's informal review culture conflicts with the governance requirement."
- `REVIEW_BOTTLENECK`: "T8 is a large refactor touching 15 files. Reviewers are intimidated by the diff size and keep postponing."
- `SCOPE_CREEP_RISK`: "Security audit found a vulnerability in the auth token storage. The fix is XL effort and CRITICAL risk. Stakeholders want it in Sprint 14 but it would blow the sprint commitment."

### 4.4 Shape Up Cycle Scenario Narrative

**Setup**: "A product team is in week 5 of a 6-week cycle (cycle-003-notifications). Three bets were placed at the betting table: push notifications (B1, on track), search redesign (B2, at risk), and onboarding flow (B3, killed at week 4). The cooldown pipeline has 3 raw/shaped ideas waiting for the next betting table."

**Tension**: "The search redesign bet has gone sideways. What started as 3 scopes has ballooned to 6 mid-cycle — scope creep. The search index rebuild (T5) has been 'building' for 3 weeks, blocking autocomplete (T10). Agent alpha is stuck on T5. Search analytics (T9) was added mid-cycle and wasn't in the original pitch — pure scope creep. The caching task (T8) shows QA status but has no PR — false status. With 7 days until the circuit breaker fires, the team needs to decide: partial ship or kill the bet. Meanwhile, T13 (email templates) is assigned to bet-push-notifications but lives in cycle-002-mobile — a cross-cycle integrity violation from a task that was migrated incorrectly."

**Violation Context**:
- `SCOPE_CREEP`: "T9 (search analytics) was added in week 3 when the PM saw the search index work and said 'while we're in there, let's add analytics.' This was never part of the pitch and wasn't bet on."
- `INTEGRITY_VIOLATION`: "T13 was originally in cycle-002's onboarding work. When onboarding was killed, someone moved T13 to the push notifications bet but forgot to update the cycle assignment."
- `FALSE_STATUS`: "T8 was moved to QA after a local demo to the team lead. No PR exists. The developer is still working on it."
- `CASCADE_BLOCKER`: "T5 (search index rebuild) is the critical path. The original estimate was 'a few days.' It's been 3 weeks. The schema migration turned out to be more complex than the pitch anticipated."

### 4.5 Code References in Scenarios

When the demo repo is available, scenario tasks reference real code:

```typescript
// Example: Hydro scenario task referencing demo codebase
{
  ref: 'T7',
  title: 'Notification Delivery Engine',
  body: `## Context
The delivery engine at \`src/notifications/delivery-engine.ts\` has the interface
and basic structure but the core delivery logic is incomplete. The event bus
(\`src/notifications/event-bus.ts\`) and event model (\`src/notifications/event-model.ts\`)
are complete and should be used as the foundation.

## Acceptance Criteria
- Delivery engine processes notification events from the event bus
- Supports pluggable channel providers via the channel registry pattern
- Retry policy integration point exists (T8 will implement the actual policy)
- Delivery status tracking with success/failure/retry states
- Error handling follows patterns established in \`src/shared/errors.ts\`

## Technical Notes
- See \`src/auth/auth-service.ts\` for the service pattern used in this project
- The channel registry at \`src/channels/channel-registry.ts\` defines the provider interface
- Event model types in \`src/notifications/types.ts\` are the contract`,
  // ...
}
```

This connects governance to code. When an agent starts this task, the references point to real files with real patterns.

### 4.6 Scenario-Repo Mapping

The same demo codebase maps to all three methodology scenarios:

| Demo Repo Module | Hydro Epic | Scrum Work Items | Shape Up Bet |
|---|---|---|---|
| `auth/` | E1: Platform Foundation (Wave 1, done) | Sprint 13 carry-over (done) | cycle-002 (completed) |
| `notifications/` | E2: Delivery Pipeline (Wave 2, active) | Sprint 14 stories + tech debt | B1: Push Notifications (active) |
| `templates/` | E4: Content System (Wave 2, active) | Sprint 14 stories | B1: Push Notifications (scope) |
| `channels/` | E2: Delivery Pipeline (Wave 2, active) | Sprint 14 stories | B2: Search Redesign (at risk) |
| `analytics/` | E5: Intelligence (Wave 3, planned) | Backlog (Sprint 15 candidate) | Cooldown (raw idea) |
| `integrations/` | E5: Intelligence (Wave 3, planned) | Backlog (Sprint 15 candidate) | Cooldown (shaped idea) |

The governance violations are methodology-specific (epic integrity vs DoR vs circuit breaker), but the underlying project is the same. This is methodology-agnosticism made tangible.

---

## 5. Guided Demo: `/ido4dev:demo`

### 5.1 Purpose

A choreographed walkthrough that tells the governance story in ~15 minutes. Semi-autonomous — the skill drives the narrative, pauses for effect, and invites interaction at key moments. Designed for: live demos to prospects, recorded walkthroughs, self-service evaluation.

### 5.2 Prerequisites

- Active sandbox (created via `create_sandbox`)
- Any methodology — the demo adapts to the active profile

### 5.3 Flow: Four Acts

#### Act 1: "The Project" (2-3 minutes)

**Purpose**: Set the scene. Establish what the team is building and where they are.

**Flow**:
1. Read the scenario narrative's `setup` field
2. Present the project overview: methodology, container state, task count, agent count
3. Run a quick board view — show task distribution across statuses
4. Highlight the completion state: "Wave 1 is done. Wave 2 is active with 10 tasks. Here's where things get interesting."

**Tone**: Neutral, informational. Building context before revealing problems.

#### Act 2: "What Governance Sees" (4-5 minutes)

**Purpose**: Governance reveals what's wrong. Each finding is contextualized by the narrative.

**Flow**:
1. Run standup analysis — surface all governance findings
2. For each finding, present:
   - **What**: The violation (e.g., "Epic integrity broken — auth epic spans Wave 1 and Wave 2")
   - **Why it matters**: From the narrative's `violationContext` (e.g., "This means the auth feature can't ship atomically with Wave 1")
   - **Evidence**: The specific data — which tasks, which containers, what the audit trail shows
3. Show compliance score — present the overall governance health with category breakdown
4. Show work distribution recommendation — "If you had an available agent right now, governance says they should work on [X] because [reasoning]"

**Tone**: Diagnostic. "The system found these issues. Here's what each one means."

#### Act 3: "Governance in Action" (4-5 minutes)

**Purpose**: Interactive demonstration that governance isn't just detection — it's enforcement.

**Flow**:
1. **Attempt a blocked transition**: Try to start a task whose dependency isn't met. BRE blocks it with clear error: "Cannot start T9 — dependency T7 is not in terminal state." Show the remediation suggestion.
2. **Attempt a container violation** (methodology-specific):
   - Hydro: Try to move a task to a wave that breaks epic integrity
   - Scrum: Try to move a task to In Review without a PR (if git workflow enabled)
   - Shape Up: Show the circuit breaker countdown — "7 days until this bet is automatically killed"
3. **Fix a violation**: Unblock the simplest violation (e.g., update a false status). Run compliance again — show the score tick up.
4. **Show the audit trail**: "Every action we just took — the attempt, the block, the fix — is recorded. Nothing is lost."

**Tone**: Interactive, demonstrative. "Watch what happens when we try this."

#### Act 4: "The Full Pipeline" (3-4 minutes)

**Purpose**: Show ido4's complete value chain from spec to governed implementation.

**Flow**:
1. Present the strategic spec (from the demo repo or inline)
2. Run decomposition: "This is what happens when a strategic spec meets a real codebase"
3. Show the output: tasks with effort, risk, AI suitability — all grounded in code analysis
4. Show how these would become governed GitHub issues
5. Close: "From stakeholder conversation to governed implementation. Every task traceable to a strategic requirement. Every transition validated by deterministic rules. Every action audited."

**Tone**: Culminating. This is the "wow" moment.

**Note**: Act 4 requires the demo codebase (Layer 2). If only Layer 1 is active (governance-only sandbox), this act shows the existing sandbox data and explains what the pipeline would produce.

### 5.4 Methodology Adaptation

The demo skill reads the active profile and adapts:

| Element | Hydro | Scrum | Shape Up |
|---------|-------|-------|----------|
| Act 1 container language | "Waves" | "Sprints" | "Cycles and Bets" |
| Act 2 primary violation | Epic integrity | DoR violation | Circuit breaker |
| Act 3 blocked transition | Dependency in wrong wave | Missing acceptance criteria | Bet scope creep |
| Act 3 enforcement demo | Epic integrity check | Type-scoped pipeline | Circuit breaker countdown |

### 5.5 Output Format

The demo skill produces a structured narrative in markdown, presented section by section with pauses. Each section includes:
- A heading (act name)
- Narrative prose (the story)
- Data presentation (tool outputs, formatted for readability)
- Transition to next section

---

## 6. First-Touch Onboarding: `/ido4dev:onboard`

### 6.1 Purpose

The very first experience a new user has with ido4. Must accomplish in ~10 minutes:
- Understand what ido4 does (governance for AI-hybrid development)
- See governance in action (violations discovered, rules enforced)
- Feel the "aha moment" (try to break a rule, watch BRE catch it)
- Know what to do next (try with your own project)

### 6.2 Flow

#### Step 1: Welcome (30 seconds)

"Welcome to ido4 — the governance layer for AI-hybrid software development. ido4 ensures that AI coding agents follow your development methodology, maintain quality gates, and build with full project understanding."

"Let's see it in action. First, which development methodology does your team use?"

Present three options with one-line descriptions:
- **Hydro** — Wave-based delivery. Ship features whole. Best for: consulting, enterprise delivery.
- **Scrum** — Sprint-based iteration. Different work types, different quality gates. Best for: product teams, diverse work.
- **Shape Up** — Cycle-based betting. Fixed time, variable scope. Best for: product-driven organizations.

(Default recommendation based on nothing: Hydro. Based on user's stated context if available.)

#### Step 2: Sandbox Creation (30 seconds)

Create the sandbox with the chosen methodology. Brief confirmation:

"Created a [methodology] sandbox with [N] tasks across [containers]. This is a real GitHub project with embedded governance violations — let's explore what ido4 finds."

#### Step 3: Guided Discovery (3-4 minutes)

Run governance analysis. Present findings in **beginner-friendly language**:

Instead of: "EPIC_INTEGRITY_VIOLATION: Tasks E3 span wave-002 and wave-003"

Say: "**Feature split across waves.** The Auth feature has tasks in both Wave 1 and Wave 2. In Hydro methodology, all tasks in a feature (epic) must ship together in the same wave. This violation means the Auth feature can't be delivered atomically — some parts would ship in Wave 1, others delayed to Wave 2."

For each finding: What it is (plain language) → Why it matters (governance principle) → What the data shows (specific tasks/containers).

#### Step 4: Try It Yourself (3-4 minutes)

"Now let's see governance enforcement. I'll try to approve a task that has unmet dependencies."

Execute a transition that will fail. Show the BRE response:
- Which validation step blocked it
- Why (the dependency isn't in terminal state)
- How to fix it (remediation suggestion)

Then fix the issue and retry. BRE passes. Show the audit trail entry.

"That's deterministic governance. The BRE is TypeScript code — an AI agent can't convince it to skip a step, hallucinate compliance, or bypass a quality gate."

#### Step 5: What's Next (1 minute)

"You've seen ido4 discover violations, enforce rules, and maintain an audit trail. Here's what to explore next:"

- `/ido4dev:demo` — Full guided demo with all four acts
- `/ido4dev:init` — Initialize ido4 on your own project
- `/ido4dev:standup` — Run a governance standup on the sandbox
- `/ido4dev:compliance` — Deep dive into compliance scoring

"The sandbox stays active until you destroy it. Explore freely — try to break rules, fix violations, run skills. When you're ready to start with your own project, run `/ido4dev:init`."

### 6.3 Tone

Confident but not salesy. Explanatory without being condescending. The system speaks for itself — the onboarding just makes sure the user sees what matters.

---

## 7. Interactive Sandbox Exploration: `/ido4dev:explore`

### 7.1 Purpose

After guided experiences (demo or onboarding), users can explore the sandbox freely. This skill provides structured exploration paths without being prescriptive.

### 7.2 Exploration Paths

The skill presents available exploration paths based on what the user hasn't yet seen:

**Governance Discovery**
- "Run a standup briefing" → `/ido4dev:standup`
- "Check project health" → `/ido4dev:health`
- "Deep dive into compliance" → `/ido4dev:compliance`
- "View the full board" → `/ido4dev:board`

**Governance Enforcement**
- "Try to start a blocked task" → attempts transition, shows BRE response
- "Try to violate container integrity" → methodology-specific violation attempt
- "Fix a governance violation" → guided remediation
- "Watch compliance score change" → before/after comparison

**Multi-Agent Coordination**
- "See agent assignments" → show registered agents and their locks
- "Get a work recommendation" → run work distribution for an available agent
- "Simulate a task handoff" → complete a task, show what unblocks, get next recommendation

**Full Pipeline** (requires demo codebase)
- "Decompose the strategic spec" → run `/ido4dev:decompose` against real code
- "See what an agent would build" → show task execution context assembly
- "Review merge readiness" → run merge readiness gate on a completed task

**Methodology-Specific**
- Hydro: "Check epic integrity across waves"
- Scrum: "Review Definition of Ready compliance"
- Shape Up: "Check circuit breaker status"

### 7.3 State Tracking

The explore skill tracks what the user has already seen (within the session) and highlights unexplored paths. This prevents repetition and encourages comprehensive exploration.

---

## 8. Full Pipeline Demonstration

### 8.1 Purpose

The deepest layer of the sandbox experience. Demonstrates ido4's complete value chain with real code. This is what makes the platform credible for serious evaluation.

### 8.2 Prerequisites

- Demo codebase (`ido4-demo`) cloned locally
- Sandbox created (any methodology)
- Strategic spec available (`specs/notification-platform.md`)

### 8.3 The Pipeline

#### Stage 1: Strategic Spec → Decomposition

```
Input: specs/notification-platform.md (strategic spec)
Tool: /ido4dev:decompose
Process:
  1. parse_strategic_spec extracts capabilities, constraints, cross-cutting concerns
  2. Code analysis agent explores the demo codebase
     - Discovers existing patterns (auth service pattern, error handling, test style)
     - Identifies completion state per module
     - Maps capabilities to code paths
  3. Technical spec writer produces implementation tasks
     - Right-sized tasks grounded in actual code
     - Effort estimates based on codebase complexity
     - Risk assessment based on dependency depth
     - AI suitability based on pattern availability
Output: Technical spec with 15-25 implementation tasks
```

#### Stage 2: Technical Spec → Governed Issues

```
Input: Technical spec from Stage 1
Tool: Ingestion pipeline (spec-parser → spec-mapper → GitHub issues)
Process:
  1. Parse technical spec into structured task definitions
  2. Map capabilities to methodology containers (epics/bets)
  3. Create GitHub issues with full governance metadata
  4. Set dependencies, effort, risk, AI suitability fields
  5. BRE validates all assignments
Output: Governed GitHub issues linked to capabilities
```

#### Stage 3: Agent Execution Under Governance

```
Input: Governed issues from Stage 2
Tools: get_task_execution_data, start_task, context writing
Process:
  1. Work distribution recommends a task for an agent
  2. Agent reads execution context (assembled by ido4)
  3. Agent starts task (BRE validates transition)
  4. Agent writes real code in the demo codebase
  5. Agent writes context comment (approach, decisions, interfaces created)
  6. Agent submits for review (BRE validates, checks PR exists)
  7. Merge readiness gate evaluates
Output: Real code committed, governance trail maintained
```

#### Stage 4: Handoff and Continuation

```
Input: Completed task from Stage 3
Tools: completeAndHandoff
Process:
  1. Approve task (BRE validates)
  2. Release agent lock
  3. Find newly unblocked tasks
  4. Recommend next task (work distribution scores)
  5. Next agent reads context from previous agent's work
  6. Continues building on top of governed foundation
Output: Continuous flow with institutional memory
```

### 8.4 What This Proves

- **Context delivery works**: Agent receives complete context and produces better code because of it
- **Decomposition produces real tasks**: Not generic boilerplate — tasks grounded in actual codebase analysis
- **Governance enables, not restricts**: BRE validates but doesn't slow agents that follow the process
- **Institutional memory compounds**: Each agent's context comments make the next agent more effective
- **The audit trail is complete**: Every decision, every transition, every recommendation — traceable

---

## 9. Reset Infrastructure

### 9.1 Reset Scope

A full reset restores the entire environment to its starting state:

| Component | Reset Action |
|-----------|-------------|
| GitHub Project | `destroy_sandbox` → `create_sandbox` (existing) |
| Demo Codebase | `git reset --hard sandbox-start && git clean -fd` |
| Seeded PRs/Branches | Cleaned up by `destroy_sandbox` (existing) |
| Audit Trail | Removed by `destroy_sandbox` (`.ido4/` cleanup) |
| Agent State | Removed by `destroy_sandbox` (`.ido4/` cleanup) |

### 9.2 Reset Command

Enhanced `reset_sandbox` tool or a new `/ido4dev:sandbox-reset` skill that:
1. Destroys the sandbox project (existing flow)
2. Resets the demo codebase if detected (git reset to tag)
3. Recreates the sandbox (existing flow)
4. Reports reset summary

### 9.3 Reset Speed Target

Full reset (project + code) should complete in under 60 seconds. The GitHub API calls are the bottleneck — issue creation is serial with delays for sub-issue relationships.

---

## 10. Seeded PRs with Real Code

### 10.1 Current State

Seeded PRs currently create branches with dummy `.sandbox/taskRef.md` files. This is visible and unconvincing.

### 10.2 Enhanced Approach

Seeded PRs in the demo codebase contain **real code changes** appropriate to their task:

- **Hydro T12 (Session Management)**: PR adds session timeout configuration to `src/auth/auth-service.ts` — a real, reviewable change. The review bottleneck is visible: real code, no reviewers.
- **Scrum T8 (Order Processing Refactor)**: PR refactors `src/notifications/delivery-engine.ts` to extract a processing pipeline — 15 files touched, intimidating diff. The review bottleneck makes sense: this is a large refactor.
- **Shape Up T2 (Android Push)**: PR adds push notification provider at `src/channels/providers/push.ts` — substantial implementation. In QA status with a real PR.

### 10.3 Implementation

The demo repo's `sandbox-start` tag already includes the "before" state. Seeded PRs are created by:
1. Creating a branch from `sandbox-start`
2. Applying a pre-built patch (stored in the demo repo at `sandbox/patches/`)
3. Committing with a realistic message
4. Creating the PR with proper description

Patches are small, targeted, and methodology-appropriate.

---

## 11. Context Comments with Code References

### 11.1 Current State

Context comments contain temporal language ("started 3 days ago", "waiting on dependency") but reference generic concepts, not real code.

### 11.2 Enhanced Approach

When the demo codebase is present, context comments reference actual code:

```markdown
<!-- ido4:context -->
## Approach
Following the service pattern from `src/auth/auth-service.ts`. Using the event bus
(`src/notifications/event-bus.ts`) as the primary input — delivery engine subscribes
to notification events and routes to channel providers.

## Key Decisions
- Using strategy pattern for channel providers (see `src/channels/channel-registry.ts`)
- Retry logic will be extracted to a separate service (T8) — keeping delivery engine focused
- Error handling follows `src/shared/errors.ts` structured error pattern

## Interfaces Created
- `DeliveryResult` type in `src/notifications/types.ts`
- `deliver()` method signature on `DeliveryEngine` class
- `ChannelProvider.send()` contract that T8 (channels) will implement

## Blocked On
The event model needs a `priority` field for delivery ordering. This wasn't in the
original spec. Filed as a question on #T3 (event model).
<!-- /ido4dev:context -->
```

This demonstrates institutional memory with real substance — the next agent reading this knows exactly what was built, what patterns to follow, and what interfaces to consume.

---

## 12. Implementation Scope & Sequencing

### 12.1 Implementation Blocks

**Block 1: Demo Codebase Repository** — COMPLETE (2026-03-21)
- Published: https://github.com/ido4-dev/ido4-demo (public, v0.1.0 tagged)
- Local: `/Users/bogdanionutcoman/dev-projects/ido4-demo/`
- 1,879 lines of source, 1,193 lines of tests, 132 tests passing
- Modules: shared (100%), auth (100%), notifications (50%), templates (40%), channels (10%), api (30%)
- Strategic spec: `specs/notification-platform.md` — 16 capabilities, 6 groups, 0 parse errors
- Technical spec: `specs/notification-platform-technical.md` — 17 tasks, 6 capabilities, ingestion format
- CLAUDE.md with agent guidance (patterns, conventions, specs, reset info)

**Block 2: Sandbox Rearchitecture (Pipeline + Algorithmic Builder)** — COMPLETE (2026-03-22)
- Rearchitected SandboxService: technical spec → IngestionService → ScenarioBuilder → execution
- **ScenarioBuilder** (pure function, 5 modules): dependency graph analysis → container assignment →
  role identification → state assignment → violation injection → seeding generation
  Input validation, shared utilities, documented constants.
- **ScenarioConfig**: ~30-line configs per methodology (container layout only).
- `projectRoot` parameter added to create_sandbox/destroy_sandbox/reset_sandbox tools —
  enables onboarding skill to point sandbox at cloned demo repo directory
- `groupRef` added to IngestSpecResult task type — builder reads directly, no spec re-parsing
- Old methodology-specific demo skills (sandbox-hydro/scrum/shape-up) deprecated → guided-demo
- Killed groups derived from groupingContainers state, not index coupling
- Context comments and PR seeds include real code file references extracted from task bodies
- Tests: 1,731 total (1,273 core + 458 MCP), all passing

**Block 3: Guided Demo Skill** — COMPLETE (2026-03-22)
- `/ido4dev:guided-demo` skill: four-act walkthrough (project, discovery, enforcement, pipeline)
- Methodology-agnostic: reads active profile, adapts container terminology and violation types
- Act 4 checks for demo codebase availability, graceful degradation if absent

**Block 4: Onboarding Skill** — COMPLETE (2026-03-22)
- `/ido4dev:onboard` skill: zero-friction first touch with auto-clone
- Flow: detect state → welcome → methodology selection → clone demo repo to ~/.ido4/demo/ →
  create sandbox → guided discovery (plain language) → enforcement demo (aha moment) → next steps
- Handles all error cases: existing project, no token, clone failure, tool not registered

**Block 5: Interactive Exploration Skill** — COMPLETE (2026-03-22)
- `/ido4dev:sandbox-explore` skill: 13 exploration paths across 5 categories
- Categories: governance discovery, enforcement, multi-agent coordination, methodology-specific, pipeline
- Tracks explored paths, suggests next steps after 5+ explorations

**Block 6: Full Pipeline Integration**
- Ensure decomposition pipeline works against demo codebase
- Test strategic spec → technical spec → ingestion flow
- Verify agent execution context assembly for demo repo tasks
- End-to-end validation: spec → decompose → ingest → start → execute → handoff

### 12.2 Dependencies

```
Block 1 (Demo Codebase)
  ↓
Block 2 (Enhanced Scenarios) ← depends on demo codebase for code references
  ↓
Block 3 (Guided Demo) ← depends on narratives for Act 2
Block 4 (Onboarding) ← depends on narratives for discovery step
  ↓
Block 5 (Interactive Exploration) ← depends on demo + enhanced scenarios
  ↓
Block 6 (Full Pipeline) ← depends on everything above
```

**Block 1 is the critical path.** Everything else builds on having a real codebase.

**Blocks 3 and 4 are parallelizable** once Block 2 is done.

### 12.3 What Changes Where

| Package | Changes |
|---------|---------|
| **@ido4/core** | `ScenarioNarrative` type, enhanced scenario definitions, conditional code references in task bodies |
| **@ido4/mcp** | Possibly enhanced `create_sandbox` to accept `codebasePath` parameter for repo-aware creation |
| **plugin** | 3 new skills (`guided-demo.md`, `onboarding.md`, `sandbox-explore.md`), enhanced `sandbox.md` |
| **ido4-demo** (new) | Complete TypeScript API service, strategic spec, reset infrastructure, PR patches |

### 12.4 Testing Strategy

| What | How |
|------|-----|
| **Scenario integrity** | Extend existing 113 tests with narrative field validation |
| **Narrative completeness** | New tests: every scenario has setup, tension, violationContext for each governance signal, expectedFindings, resolution |
| **Code references** | New tests: when codebasePath is present, task bodies contain valid file paths |
| **Demo skill flow** | Manual validation against live sandbox (skill output is AI-generated narrative) |
| **Onboarding flow** | Manual validation + structured test script |
| **Pipeline integration** | End-to-end test: decompose strategic spec → verify task count, dependency graph, effort distribution |
| **Reset** | Test: create → modify → reset → verify starting state restored |
| **Demo codebase** | Standard vitest suite: auth tests pass, notification partial tests pass, build succeeds |

---

## 13. Success Criteria

### 13.1 For Demos

- [ ] A prospect can see the full ido4 value proposition in 15 minutes without prior knowledge
- [ ] The guided demo works for all three methodologies with methodology-appropriate narrative
- [ ] Every governance violation is discovered and explained in context
- [ ] At least one interactive enforcement moment (BRE blocks, user fixes, BRE passes)
- [ ] The full pipeline is demonstrable (spec → decompose → governed issues)
- [ ] Reset takes under 60 seconds — demo can be replayed immediately

### 13.2 For Onboarding

- [ ] A new user understands what ido4 does within 10 minutes
- [ ] The "aha moment" (try to violate, watch BRE catch it) happens in every onboarding session
- [ ] Clear next steps are presented — no dead-end experience
- [ ] Methodology selection guidance helps users pick the right profile

### 13.3 For Testing

- [ ] The sandbox can be created and destroyed 10 times in a row without failures
- [ ] All governance skills produce meaningful output against sandbox data
- [ ] The demo codebase builds and tests pass in starting state
- [ ] Decomposition pipeline produces sensible tasks from the strategic spec
- [ ] Seeded PRs have real code that's reviewable

### 13.4 For Evaluation

- [ ] A pilot team can experience the full loop: spec → decompose → execute → govern
- [ ] Agent execution against the demo codebase produces real, working code
- [ ] Context comments written by agents are readable and useful to subsequent agents
- [ ] The audit trail tells a coherent story of what happened and why

---

## 14. Open Questions

### Resolved
1. **Demo repo visibility**: Public under `ido4-dev` org — prospects can fork and try themselves.
2. **Demo repo hosting**: Under `ido4-dev` org (consistent branding).
3. **Multiple starting states**: Start with single `v0.1.0` tag. Add more later if needed.

### Open
4. **Sandbox creation time**: Current creation takes 30-60 seconds due to GitHub API. Is this acceptable for demos, or do we need a "pre-created sandbox" option?

5. **Demo recording**: Should the guided demo skill produce artifacts (markdown report, GIF recording) that can be shared with prospects who weren't in the live demo?

6. **Plugin distribution**: The new skills need to ship with the plugin. How does this affect the install story for `npx @ido4/mcp` (which doesn't include the plugin)?

7. **Codebase distribution model** — IMPLEMENTED (2026-03-22):
   The onboarding skill handles everything automatically. The user never manually clones.
   - `/ido4dev:onboard` detects no project → clones demo repo → creates sandbox with `projectRoot` → guided tour
   - Clone target: `~/.ido4/demo/ido4-demo/`
   - Demo repo is public: https://github.com/ido4-dev/ido4-demo
   - `projectRoot` parameter on sandbox tools ensures `.ido4/` config lives alongside the code
   - GitHub template option available for pilots who want their own copy
