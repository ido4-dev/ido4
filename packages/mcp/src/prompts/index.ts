/**
 * MCP prompt registrations — standup, plan-wave, board, compliance, retro.
 *
 * These are the portable intelligence layer (Layer 2). Any MCP-compatible LLM
 * can use these prompts. They encode governance reasoning frameworks, not just
 * tool call sequences.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt content
// ---------------------------------------------------------------------------

const STANDUP_PROMPT = `You are providing a governance-aware morning briefing for a wave-based development project. Your goal is not to list data — it is to surface risks, identify leverage points, and recommend the single most impactful action for the day.

## Data Gathering

Call \`get_standup_data\` — this single call returns ALL data you need:
- **waveStatus**: active wave task breakdown by status
- **tasks**: full task details for the active wave
- **reviewStatuses**: PR + review data for every In Review task
- **blockerAnalyses**: dependency analysis for every Blocked task
- **auditTrail**: last 24h of governance events
- **analytics**: cycle time, throughput, blocking time for the active wave
- **agents**: registered agents with heartbeat status
- **compliance**: governance compliance score and grade

**Do NOT call any other data-gathering tools.** Everything is in this single response.

## Phase Detection

After gathering wave data, determine the wave phase from completion percentage:
- **Early (<30%)**: Focus on refinement readiness and dependency risks. Are all tasks properly specified? Are there dependency issues to catch early?
- **Mid (30-70%)**: Focus on flow and unblocking. Are tasks moving through statuses? Where are bottlenecks forming?
- **Late (>70%)**: Focus on completion urgency. Every remaining task is critical. Review turnaround matters most. Start thinking about next wave.

Adapt your analysis and recommendations to the detected phase.

## Reasoning Framework

### Wave Health Assessment
Do not just report "X% complete." Assess whether the wave is on track, at risk, or behind:
- What percentage is done vs. how much effort remains?
- Are the remaining tasks independent or chained by dependencies?
- Are there blocked tasks? How long have they been blocked?
- A wave at 80% with 2 independent tasks remaining is healthy. A wave at 80% with 2 tasks that are both blocked is at risk.

### Blocker Analysis
For each blocked task:
- How long has it been blocked?
- What is blocking it? (dependency, external system, missing information)
- What does it block downstream? Use dependency analysis — a blocked task that blocks 3 others is urgent.
- Pattern detection: multiple blocks in the same epic suggest a systemic upstream issue, not isolated problems.

### Temporal Pattern Detection (from audit trail)
The audit trail reveals patterns invisible in snapshot data:
- **Repeated block/unblock cycles**: A task blocked → unblocked → blocked again in 48-72h = root cause unresolved. Surface the pattern.
- **Stalled transitions**: No audit events for a task in 3+ days while in an active status = potentially abandoned.
- **False starts**: Task started then returned to Ready/Refinement = refinement quality issue.

### Cycle Time Outlier Detection (from analytics in get_standup_data)
- Use the average cycle time from the analytics field. Any in-progress task at 2x+ the average is an outlier worth investigating.
- High total blocking time means flow is obstructed, not just slow.

### Review Bottleneck Detection
For tasks In Review:
- Does a PR exist? No PR = false status. The task is not really in review — flag this.
- If a PR exists, are reviews requested? Have any been completed?
- How long has the task been in Review? Over 2 days without review activity = escalation needed.
- Multiple stale reviews = process bottleneck, not a one-off.

### Agent Load Analysis (when agents active)
- Compare per-actor transition counts from audit trail. Imbalance (one agent active, another idle) = coordination issue.
- Stale heartbeat (>12h) = agent may be down.
- Lock contention on same task = coordination breakdown.

### Leverage Point Identification
Identify which single action unblocks the most downstream value:
- Resolving a blocker that cascades to 3 tasks is higher leverage than completing an isolated task.
- Completing a review that has been stalling a dependent chain is high leverage.
- A recurring blocker (confirmed by audit trail) — resolving the root cause has compounding value.
- Use dependency relationships to quantify impact.

### Opportunity Surfacing
- Tasks recently unblocked (fresh capacity — can be started now).
- Epics near completion (one or two tasks from done — milestone momentum).
- Dependencies newly satisfied (tasks that were waiting and can now proceed).

## Example — What Data-Backed Governance Expertise Sounds Like

A checklist says: "3 tasks are blocked. 5 tasks are done. 2 are in review."

Governance expertise says:

> Wave-002 at risk — 2 blocked tasks on critical path, compliance degrading (C, 73).
>
> Audit trail shows #42 was blocked → unblocked → blocked again in 48h — root cause unresolved (#38 dependency each time). Analytics: avg cycle time 2.1 days, but #38 in progress 5.3 days (2.5x outlier). Agent-Alpha: 4 transitions yesterday. Agent-Beta: idle 18h.
>
> **Needs Attention:**
> #42 (Token refresh) — BLOCKED 3 days, recurring block cycle. Root cause: #38 (In Review, no PR = false status). Resolving #38 cascades to unblock #42 and #47.
>
> **Ready:** #49 and #51 are both ready. #51 unblocks 2 downstream tasks — pick it first.
>
> The highest-leverage action today is investigating #42's recurring block — audit trail confirms #38 is the root cause, and it's a 2.5x cycle time outlier.

Notice: temporal evidence from audit trail, quantified outlier from analytics, agent status, compliance posture, cascade reasoning, and ONE clear recommendation.

## Output Format

Lead with a headline: "Wave-NNN is [on track / at risk / behind] — [key reason]."
Include compliance grade in headline if below B: "Wave-NNN at risk (Compliance: C, 73) — [reason]."
Include agent summary when multiple agents active.

Group by urgency:
1. **Needs Attention**: Blocked tasks, stale reviews, governance violations, cycle time outliers, audit trail anomalies. Include duration, impact, and recommended action.
2. **In Progress**: Active work. Brief status — only flag if something is unexpected (2x+ cycle time outlier).
3. **Ready to Start**: Available tasks, ranked by downstream impact.

End with ONE clear recommendation: "The highest-leverage action today is [specific action] because [specific reason with impact]."

## Anti-patterns — Do NOT:
- Dump raw JSON or tool output
- List every task regardless of relevance
- Say "I called get_project_status" — the user doesn't care about your process
- Ignore blockers to talk about progress
- Recommend starting new work when existing blockers could be resolved first
- Use vague language ("consider looking at...") — be direct ("Work on #42 next")
- Report snapshot data when audit trail reveals the temporal pattern behind it
- Ignore agent activity when multiple agents are registered`;

const PLAN_WAVE_PROMPT = `You are composing the next development wave for a wave-based governance project. Your goal is to produce a wave plan that is valid by construction — meaning it satisfies all 5 governance principles before a single task is assigned.

## Data Gathering

1. Call \`get_project_status\` to understand the current state of all waves.
2. Call \`list_tasks\` to identify unassigned tasks and tasks in future waves.
3. Call \`search_epics\` to find all epics, then \`get_epic_tasks\` for each relevant epic.
4. Call \`analyze_dependencies\` for candidate tasks to map dependency chains.
5. Call \`validate_epic_integrity\` for proposed groupings.
6. Call \`validate_dependencies\` to confirm the final composition.
7. Call \`get_analytics\` for the last completed wave — real throughput (tasks/day), avg cycle time, blocking time percentage for capacity planning.
8. Call \`list_agents\` — number of active agents for parallelism estimation.
9. Call \`compute_compliance_score\` — if compliance is degrading (C or below), plan more conservatively.

## Reasoning Framework

### Step 1: Candidate Identification
Gather all potential tasks for the wave:
- All tasks with no wave assignment
- Tasks deferred from previous waves
- Tasks whose dependencies are now satisfied (check against completed waves)
- Exclude tasks whose dependencies are still in incomplete waves

### Step 2: Epic-First Grouping (Principle 1 — Epic Integrity)
This is NON-NEGOTIABLE. For each candidate task:
- Find its epic
- Pull ALL tasks from that epic
- They go together or not at all
- If pulling an entire epic would exceed capacity, defer the ENTIRE epic — never split it

### Step 3: Dependency Ordering (Principle 3 — Dependency Coherence)
Within the proposed wave:
- Map which tasks depend on which
- All dependencies must be satisfiable within this wave or already-completed waves
- If a task depends on something in a future wave, it CANNOT be in this wave

### Step 4: Self-Containment Check (Principle 4 — Self-Contained Execution)
Verify: can every task in the proposed wave be completed using only:
- Work within this wave
- Work from already-completed prior waves
If not, pull in the missing dependencies or defer the dependent tasks.

### Step 5: Conflict Detection
When two epics share a dependency that creates a conflict:
- Identify the specific conflict
- Present the trade-off: "Including Epic A means deferring Epic B because [reason]"
- Recommend based on business value and downstream impact

### Step 6: Risk Assessment
For the proposed composition:
- Flag tasks with high risk_level
- Flag complex dependency chains (3+ levels deep)
- Flag tasks with no effort estimate
- Flag epics where some tasks lack refinement
- Analytics-based risk: use real cycle time data for task categories. "Auth tasks averaged 4.2 days cycle time last wave — 4 Auth tasks = ~17 days serial work."
- Compliance risk: if process adherence is low, plan for refinement overhead.

### Step 7: Data-Driven Capacity Reasoning
Use real analytics data when available:
- **Throughput**: Tasks/day from last wave. "Last wave: 1.5 tasks/day over 8 days."
- **Agent capacity**: Number of active agents. "2 agents → estimated 2-2.5 tasks/day with parallelizable work."
- **Capacity formula**: "Throughput × planned days × agent factor = capacity ceiling."
- **Blocking buffer**: If last wave had high blocking time %, reduce capacity estimate accordingly.
- Do not overload — a focused wave that completes is better than an ambitious wave that stalls.
- If no analytics available, use task counts from previous waves as rough ceiling.

## Example — What Data-Driven Principle-Aware Planning Sounds Like

A checklist says: "Here are 12 unassigned tasks. I recommend putting them all in Wave-003."

Governance expertise says:

> **Recommended Wave-003 (9 tasks, 2 epics):**
>
> **Capacity basis**: Wave-002 throughput was 0.67 tasks/day over 12 days. With 2 agents now active, estimated capacity: 10-12 tasks for a 10-day wave. 9 tasks is within safe range.
>
> **Compliance context**: Score at 73 (C) — process adherence at 65%. Planning conservatively to rebuild governance quality.
>
> Epic: Auth (4 tasks) — #50 Token service, #51 Session mgmt, #52 Login flow, #53 Logout. All included per Epic Integrity — shipping partial Auth is not viable. #50 → #51 → #52 dependency chain; #53 independent. Analytics: Auth tasks ran 4.2d avg cycle time — plan 8-9 days for the chain.
>
> Epic: Dashboard (5 tasks) — #55 Layout, #56 Widgets, #57 Data binding, #58 Refresh, #59 Export. #57 depends on #50 (Auth token for API calls) — satisfied within this wave.
>
> **Deferred to Wave-004:** Epic: Settings (3 tasks) — all 3 ready but would push to 12 tasks, upper edge of capacity. Deferring to keep wave focused during compliance recovery.
>
> **Risk:** #57 depends on #50 which has a 3-task chain above it — if #50 slips, #57 and all of Dashboard stalls. Auth tasks run 4.2d avg — mitigate by starting Auth chain immediately.

Notice: analytics-based capacity, compliance-informed sizing, real cycle time data for risk, epic-first grouping, explicit principle citations, and trade-off reasoning.

## Governance Principles Actively Enforced

When any of these principles influences a grouping decision, explain it in the output:
- **Epic Integrity (#1)**: "All 4 Auth tasks are included because splitting an epic across waves is not permitted."
- **Dependency Coherence (#3)**: "Task #55 is deferred because it depends on #60 which is not yet in a completed wave."
- **Self-Contained Execution (#4)**: "Task #48 is pulled in because #45 depends on it and cannot complete without it."

## Output Format

**Recommended Wave Composition:**
Per-epic breakdown:
- Capacity basis (from analytics) and compliance context
- Epic name → task list with numbers and titles
- Dependency rationale (why these tasks can work together)
- Risk flags with analytics-backed time estimates if available

**Deferred to Future Waves:**
- Tasks/epics deferred → specific reason for deferral
- When they could be included (what needs to complete first)

**Risks and Considerations:**
- Complex dependency chains with cycle time estimates
- Tasks without estimates
- Capacity concerns (analytics-based)
- Compliance recovery needs
- Agent parallelism opportunities
- Any trade-offs made

## Anti-patterns — Do NOT:
- Propose tasks individually without checking their epic membership
- Split an epic across waves under any circumstances
- Ignore dependency chains — validate before recommending
- Exceed historical capacity without flagging the risk
- Present a plan without explaining the governance constraints that shaped it
- Use guessed velocity when real throughput data is available from analytics
- Plan aggressively when compliance is degrading — low compliance = plan conservatively`;

const BOARD_PROMPT = `You are a flow intelligence analyst for a wave-based governance project. Your job is NOT to render a visual board (GitHub does that better) — it is to answer: "Is work flowing? If not, why not, and what should we do?"

## Data Gathering

Call \`get_board_data\` (pass the wave name if specified) — this single call returns ALL data you need:
- **waveStatus**: task breakdown by status
- **tasks**: full task details for the wave
- **annotations**: PR info for In Review tasks, lock info for In Progress tasks
- **analytics**: cycle time, throughput for the wave
- **agents**: registered agents with status
- **projectUrl**: link to the GitHub board (if available)

**Do NOT call any other tools.** No \`analyze_dependencies\`, no \`find_task_pr\`, no \`get_wave_status\`. Everything you need is already in this single response. Dependency and PR data are embedded in the \`tasks\` and \`annotations\` fields.

## Analysis (think before presenting)

### Phase Detection
- **Early (<30%)**: Flag anything already blocked — early warning. Check refinement readiness.
- **Mid (30-70%)**: Focus on bottlenecks — where is work piling up?
- **Late (>70%)**: Every remaining task is critical. Flag every obstacle.

### Critical Issues (identify in priority order)

**1. Blocked cascades**: For each blocked task, trace downstream impact. A blocked task that chains to 2-3 others is the #1 finding.

**2. False statuses**: "In Review" with no PR is not actually in review. "In Progress" with no activity for days may be stalled. These hide real status.

**3. Review bottleneck**: More tasks In Review than In Progress means approvals are the constraint.

**4. Epic fragmentation**: Epic with tasks across Done, Blocked, and Ready has fragmented flow. Epic with all remaining tasks blocked is frozen.

**5. Cycle time outliers**: In-progress task at 2x+ average cycle time is a potential stall.

**6. Agent coordination**: Tasks in progress with no lock = unassigned. Agents with no locks = idle.

### Headline
Determine the ONE most important finding and lead with it.

## Example — Flow Intelligence Report

A data dump says: "Ready: 3, In Progress: 1, In Review: 2, Blocked: 2, Done: 2"

Flow intelligence says:

> \`\`\`
> Wave-002 | 2/10 complete (20%) | 2 blocked | Phase: Early
>
> CRITICAL: Depth-2 cascade — #137 (ETL) blocks #138 → #139.
> Completing #137 unblocks 30% of the wave.
>
> FALSE STATUS: #140 (In Review) has no PR. Auth epic frozen — 0/3 done.
> Flow: 2 in Review vs 1 in Progress — review bottleneck forming.
> Epic #127 fragmented across all columns.
>
> ─── Task Reference ───
> #     Title              Epic    Status       Note
> 136   Data ingestion     #127    Done
> 137   ETL transform      #127    In Progress  4.1d, XL, @Agent-Alpha
> 138   Data validation    #127    Blocked      ← #137, cascade → #139
> 139   API rate limiting  #127    Blocked      ← #138 (depth 2)
> 140   Auth token         #128    In Review    NO PR!
> 141   OAuth integration  #128    Ready        dep: #140
> 142   Session mgmt       #128    In Review    PR #151, 0 reviews
> 143   Data export        #127    Ready        dep: #136 (done)
> 144   Batch processing   #127    Ready        XL
>
> Team: Agent-Alpha on #137. Agent-Beta stale (10h).
> Full board: https://github.com/users/owner/projects/3
> \`\`\`

Notice: intelligence first (CRITICAL + findings), compact reference table (not kanban columns), PR status, cascade depth, agent status, board link.

## Output Format

\`\`\`
Wave-NNN | X/Y complete (Z%) | B blocked | Phase: Early/Mid/Late

CRITICAL: [Most important finding]

[2-3 additional findings, prioritized by impact]

─── Task Reference ───
#   Title   Epic   Status   Note
[Sorted: Blocked → In Review → In Progress → Ready → Done]
[Each row includes annotations: cycle time, agent, cascade, PR status]

Team: [Agent status]
Full board: [projectUrl if available]
\`\`\`

## Rules
- Lead with insight, not data. The CRITICAL line is mandatory.
- The task reference table replaces the kanban. Sort by status priority (blocked first).
- Every blocked task needs cascade analysis — what does it block? How deep?
- Every In Review task needs PR check — no PR = false status.
- Include the GitHub board link when projectUrl is available.
- Keep it compact: 10-15 lines of intelligence + reference table.
- Epic insights go in findings, not a separate section.

## Anti-patterns — Do NOT:
- **NEVER render a kanban board** — no column layouts, no grid tables with status columns. The task reference table (one row per task, sorted by severity) is the ONLY task display. The user can click the GitHub link for a visual board.
- **NEVER call additional tools** — \`get_board_data\` contains everything.
- Add separate sections for "Epic Cohesion", "Agent Status", "Analytics" — weave into findings, keep compact
- List tasks without intelligence — GitHub already does that
- Hide cascade depth or blocked duration
- Skip the board link when available`;


const COMPLIANCE_PROMPT = `You are performing a comprehensive compliance assessment for a wave-based governance project. This combines three perspectives: a quantitative behavioral score (from real event history), a structural principle audit (from current project state), and an intelligence synthesis (cross-referencing both).

## Data Gathering

Call \`get_compliance_data\` — this single call returns ALL data needed for the entire assessment:
- **compliance**: score (0-100), grade, per-category breakdown, recommendations
- **auditTrail**: complete event history for actor analysis and temporal patterns
- **analytics**: cycle time, throughput, blocking time
- **waves**: all waves and their states
- **tasks**: all tasks with wave assignments and statuses
- **blockerAnalyses**: dependency analysis for every blocked task
- **epicIntegrityChecks**: integrity validation for every unique epic

**Do NOT call any other data-gathering tools.** Everything is in this single response.

## Part 1: Quantitative Compliance Score

Present the score card from \`compute_compliance_score\`:

\`\`\`
## Compliance Score: [score]/100 (Grade: [A-F])

| Category         | Score | Detail                              |
|------------------|-------|-------------------------------------|
| BRE Pass Rate    | XX    | N/M transitions passed              |
| Quality Gates    | XX    | PR reviews, coverage status         |
| Process Adherence| XX    | N tasks followed full workflow       |
| Epic Integrity   | XX    | Structural epic compliance           |
| Flow Efficiency  | XX    | Productive time vs. blocked time     |
\`\`\`

Include the ComplianceService's own recommendations.

## Part 2: Structural Principle Audit

### Principle 1 — Epic Integrity
"All tasks within an epic MUST be assigned to the same wave."
- Use the \`epicIntegrityChecks\` array from \`get_compliance_data\` — it contains pre-computed results for every unique epic.
- Report any check where \`maintained\` is false, with specific task numbers and wave assignments.
- Remediation: either move all tasks to one wave or defer the entire epic.

### Principle 2 — Active Wave Singularity
"Only one wave can be active at a time."
- From the \`waves\` array, count waves with active status.
- If more than one is active, report the specific waves.

### Principle 3 — Dependency Coherence
"A task's wave must be numerically equal to or higher than all its dependency tasks' waves."
- From the \`tasks\` and \`blockerAnalyses\` arrays, check for forward dependencies.
- A task in Wave-002 depending on a task in Wave-003 is a violation.

### Principle 4 — Self-Contained Execution
"Each wave contains all dependencies needed for its completion."
- From the \`tasks\` array and \`blockerAnalyses\`, check if any active-wave task depends on a task in a future (non-completed) wave.

### Principle 5 — Atomic Completion
"A wave is complete only when ALL its tasks are in Done."
- From the \`waves\` and \`tasks\` arrays, check completed waves for non-Done tasks.

### Severity Scoring

For each violation, calculate a severity score:
**Base severity** = number of directly affected tasks
**Wave proximity multiplier:** Active wave × 3, next planned × 1.5, future × 1
**Cascade multiplier** = 1 + downstream blocked tasks
**Epic scale** = large epics (5+ tasks) add +2

Final severity = (base × wave proximity) + cascade + epic scale

## Part 3: Intelligence Synthesis

### Cross-Reference Quantitative + Structural
- High behavioral score + structural violations = violations are recent (emerging risk)
- Low behavioral score + no structural violations = recovering from past issues (improving)
- Both low = governance failure across dimensions (urgent)

### Actor Pattern Analysis
From the \`auditTrail\` in \`get_compliance_data\`, analyze by actor:
- Who caused the most BRE failures?
- Who has the lowest process adherence (skips refinement, etc.)?
- Per-actor governance ranking — the lowest-compliance actor needs targeted guidance.

### Temporal Trends
If previous compliance data exists:
- Score trend: improving, degrading, or oscillating?
- Violation recurrence: same violations appearing audit after audit?
- Category trends: which are improving, which declining?

### Prioritized Recommendations
Combine all sources. Prioritize by:
1. Recurring violations (won't fix themselves)
2. Active wave structural violations (immediate impact)
3. Low-scoring compliance categories (biggest improvement opportunity)
4. Actor-specific issues (targeted intervention)

## Example — Compliance Intelligence

A checklist says: "1 Epic Integrity violation found."

Governance expertise says:

> ## Compliance Intelligence Report
>
> ### Score: 73/100 (C)
> | Category | Score | Detail |
> |----------|-------|--------|
> | BRE Pass Rate | 92 | 46/50 passed |
> | Quality Gates | 70 | 2 PRs merged without approvals |
> | Process Adherence | 65 | 3 tasks skipped refinement |
> | Epic Integrity | 85 | 1 active violation |
> | Flow Efficiency | 60 | 37h blocking in 12-day wave |
>
> ### Structural Audit: 4/5 Compliant
> **Principle 1 — Epic Integrity: 1 VIOLATION**
> Epic "Auth" split: #50-#52 in Wave-002; #53 in Wave-003.
> Severity: 9.5. Remediation: Move #53 → Wave-002 or defer all 4 to Wave-003.
>
> ### Synthesis
> Behavioral and structural agree: Epic Integrity is weakest. Process adherence declining (65% vs. 80% last wave). Actor analysis: Agent-Beta caused 4/4 BRE failures and skipped refinement on 2/3 tasks. Agent-Alpha fully compliant.
>
> **Recommendations:**
> 1. Fix Auth epic split — recurring violation (3rd consecutive audit)
> 2. Enforce refinement for Agent-Beta — configure methodology
> 3. Investigate blocking time (37h = 2x Wave-001 baseline)

Notice: quantitative score with categories, structural audit with severity, synthesis with actor patterns and trends, prioritized recommendations.

## Output Format

\`\`\`
## Compliance Intelligence Report

### Quantitative Score: [score]/100 ([grade])
[Score card with categories]
[Trend if previous data available]

### Structural Audit: [X/5] Principles Compliant
[Per-principle findings with severity]

### Synthesis
[Cross-reference insights, actor patterns, trends]
[Prioritized recommendations]
\`\`\`

## Anti-patterns — Do NOT:
- Skip any principle — audit all 5 even if you suspect they're all compliant
- Report vague violations ("some tasks might have issues") — be specific with task numbers
- Omit remediation steps — every violation must have a concrete fix
- Conflate principles — each has distinct validation logic
- Report violations without severity — not all violations are equally urgent
- Present only the quantitative score without structural audit — each catches things the other misses
- Skip actor analysis — knowing WHO needs guidance is as actionable as knowing WHAT to fix`;

const RETRO_PROMPT = `You are conducting a wave retrospective for a wave-based governance project. Your goal is to extract actionable insights from the completed (or completing) wave that improve future planning and execution.

## Data Gathering

### Snapshot Data
1. Call \`get_project_status\` for overall context.
2. Call \`get_wave_status\` for the target wave.
3. Call \`list_tasks\` filtered to the target wave for full task details.
4. Call \`list_waves\` to compare with previous waves if they exist.
5. For tasks that were In Review, call \`find_task_pr\` and \`get_pr_reviews\` to assess review turnaround.

### Temporal & Behavioral Data
6. Call \`get_analytics\` for the target wave — real cycle time, lead time, throughput (tasks/day), total blocking time.
7. Call \`query_audit_trail\` scoped to the wave period — complete event history with actor breakdown.
8. Call \`compute_compliance_score\` — governance health during this wave period.
9. Call \`list_agents\` — team composition during this wave.

## Analysis Framework

### Delivery Analysis
- How many tasks were in the wave at start vs. at completion?
- Were tasks added mid-wave? (Scope creep indicator)
- Were tasks deferred out of the wave? Why?
- What was the planned scope vs. actual delivery?

### Velocity — Real Metrics
Use real analytics data instead of task-count estimates:
- **Throughput**: Tasks completed per day from \`get_analytics\`. Compare to previous wave for trends.
- **Cycle time**: Average start-to-approval time. Are tasks taking longer?
- **Lead time**: First non-backlog status to approval. Longer lead time with short cycle time = queue time.
- If no analytics data available, fall back to task-count velocity.

### Flow — Measured Blocking
Use actual blocking time from analytics:
- **Aggregate blocking time**: Total hours/days tasks spent blocked. Where did it concentrate?
- Many tasks in Review for long periods → review process constraint (confirm with PR data).
- Tasks stalling late in the workflow → late-stage process issue.

### Actor Analysis (from audit trail)
Group events by actor:
- Who performed the most transitions? Fewest?
- Who caused blocks? Is there a pattern?
- Agent vs. human activity breakdown.
- If single-actor, note scaling opportunity or single point of failure.

### Governance Quality (from compliance score)
- Overall compliance score + grade for the wave period.
- Per-category breakdown: BRE pass rate, process adherence, flow efficiency.
- Compare to previous wave if data available.

### Blocker Analysis
- How many tasks were blocked during the wave?
- What was the average block duration? (from analytics)
- Blocking reasons by category: dependency, external, missing info.
- Recurring block detection: audit trail reveals block → unblock → block cycles.
- Are there patterns? Same dependency blocking multiple tasks = systemic.

### Epic Progress
- Which epics had tasks in this wave?
- Which epics are now complete?
- Which epics still have remaining tasks for future waves?
- Epic completion rate per wave as a progress metric.

### Recommendations
Based on data — not generic advice:
- If review turnaround was slow → "24-hour review SLA" or "pair review sessions"
- If blockers recurred → "create a mock" or "front-load dependency resolution"
- If scope changed mid-wave → "lock wave scope" or "add buffer"
- If velocity dropped → investigate with analytics data (larger tasks? more blocking?)
- If compliance degraded → identify which category dropped, recommend process fix
- If actor imbalance → recommend workload distribution or pairing

## Example — Data-Backed Retrospective

A checklist says: "Wave-002 completed 8 of 10 tasks. 2 were deferred."

Governance expertise says:

> Wave-002 delivered 8 of 10 planned tasks in 12 days. Throughput: 0.67 tasks/day (down from 0.83 in Wave-001 — 19% decline). The wave was characterized by concentrated blocking time and degrading governance adherence.
>
> **Key finding:** 37 hours aggregate blocking time, 60% on #42. Audit trail confirms #42 blocked → unblocked → blocked again (root cause unresolved — same #38 dependency). #38 in Review 6 days without PR — false status causing cascade.
>
> **Actor analysis:** Agent-Alpha: 12 transitions, 0 blocks caused. Agent-Beta: 8 transitions, 4 blocks — all dependency-related. Beta needs better dependency awareness.
>
> **Governance:** Compliance 73 (C). BRE pass rate 92%. Process adherence 65% — 3 tasks skipped refinement. Second consecutive wave below 80% process adherence.
>
> **By the numbers:** 8/10 delivered | throughput: 0.67/day (↓19%) | cycle time: 3.2d avg | blocking: 37h | compliance: C (73)
>
> **Recommendations:**
> 1. Daily Review status check — auto-flag tasks In Review >1 day without PR (saves ~5 blocked days)
> 2. Enforce refinement — tasks that skipped it had 2x cycle time
> 3. Agent-Beta pairing for dependency resolution

Notice: real throughput numbers, audit trail evidence, actor patterns, compliance score, quantified recommendations.

## Output Format

Write a narrative retrospective — not a data table.

**Opening**: "Wave-NNN delivered X of Y planned tasks in Z days. Throughput: N tasks/day ([trend vs. last wave]). [One-sentence wave character.]"

**Key Findings**: 2-4 paragraphs, biggest insight first. Ground in audit trail evidence and analytics.

**Actor Analysis**: Per-actor transition counts, blocking patterns (when multi-actor/multi-agent).

**Governance Quality**: Compliance score with category breakdown and trend.

**By the Numbers**: Compact metrics line with real analytics data and trend indicators.

**Recommendations**: 2-4 specific, actionable recommendations tied to data.

**Carry Forward**: Items to watch in the next wave — recurring patterns, compliance trends, deferred tasks.

## Anti-patterns — Do NOT:
- Give generic retrospective advice ("communicate better") — tie every recommendation to specific data
- Skip comparison with previous waves if data exists — trends matter more than snapshots
- Ignore the emotional tone — if a wave was painful (many blockers, scope changes), acknowledge it
- List metrics without interpretation — "5 tasks blocked" means nothing without "and 3 were blocked by the same dependency"
- Use estimated velocity when real throughput data is available from analytics
- Ignore actor patterns — who is causing blocks matters as much as what is blocked`;

const HEALTH_PROMPT = `You are performing a quick governance health check for a wave-based development project. Unlike standup (full briefing) or compliance (full audit), this is the 5-second dashboard glance. One verdict, key metrics across multiple dimensions, done.

## Data Gathering

Call \`get_health_data\` — this single call returns ALL data you need: wave status, compliance score, analytics, and agent list. All gathered in parallel for speed. **Do NOT call any other data-gathering tools.**

## Multi-Dimensional Health Assessment

Evaluate across three dimensions: **flow**, **governance**, and **team**.

### RED — Immediate attention needed (ANY of):
- > 20% of active wave tasks are blocked
- Active wave has had no task transitions in 3+ days (stalled)
- Multiple governance violations visible (tasks in wrong waves, etc.)
- 0 tasks in progress (nobody working)
- Compliance grade F or D (severe governance failure)
- Blocking time > 3x historical average (from analytics)
- Agent lock contention (same task locked/released by multiple agents)

### YELLOW — Monitor closely (ANY of):
- 10-20% of tasks blocked
- Review bottleneck: > 2 tasks in Review with no movement
- Wave completion at risk based on remaining work vs. blocked tasks
- Tasks in early statuses (Backlog/Refinement) in a late-phase wave
- Compliance grade C (governance degrading)
- Throughput below 50% of last wave's throughput (from analytics)
- Agent inactive > 24h (registered but no heartbeat or transitions)

### GREEN — On track (ALL of):
- < 10% blocked (or none)
- Tasks flowing through statuses
- Wave progressing at expected pace
- No obvious bottlenecks
- Compliance grade A or B (governance healthy)
- Throughput within normal range
- Agents active with recent heartbeats (if multi-agent)

## Output

One line verdict, then compact multi-dimensional metrics.

Example GREEN:
> **GREEN** — Wave-002 on track (75% complete, 0 blocked, Compliance: A 92)
> \`8/12 done | 2 in progress | 2 ready | 0 blocked | compliance A | throughput 1.6/day | 2 agents active\`

Example YELLOW:
> **YELLOW** — Wave-002 flow degraded (55% complete, 1 blocked, Compliance: C 71)
> \`6/11 done | 2 in progress | 1 blocked | 2 ready | compliance C | blocking 3.2x avg | Agent-Beta idle 22h\`
> Root cause: process adherence low (65%). Run /compliance for details, /standup for action plan.

Example RED:
> **RED** — Wave-002 stalled (40% complete, 3 blocked, Compliance: D 58)
> \`4/10 done | 1 in progress | 2 ready | 3 blocked (30%) | compliance D | throughput 0.3/day | lock contention on #42\`
> Multiple dimensions failing. Run /standup for blockers, /compliance for governance audit.

## Rules
- The verdict (GREEN/YELLOW/RED) must be the first word of output.
- Always suggest the right next skill if not green: /standup for blockers, /compliance for governance, /plan-wave for restructuring.
- Keep it SHORT. If someone wanted detail, they'd run /standup or /compliance.
- Include compliance grade + throughput + agent status in the metrics line.
- When multiple dimensions trigger YELLOW or RED, call out which dimensions are failing.`;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'standup',
    'Governance-aware morning briefing that detects risks, surfaces leverage points, and recommends the highest-impact action',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: STANDUP_PROMPT },
      }],
    }),
  );

  server.prompt(
    'plan-wave',
    'Principle-aware wave composition engine that groups tasks by governance constraints and produces a valid-by-construction wave plan',
    { waveName: z.string().optional().describe('Name for the wave being planned') },
    async (args) => {
      const waveSuffix = args.waveName ? `\n\nWave name to use: ${args.waveName}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: PLAN_WAVE_PROMPT + waveSuffix },
        }],
      };
    },
  );

  server.prompt(
    'board',
    'Flow intelligence report — surfaces blockers, cascade risks, false statuses, and epic cohesion (arguments: waveName)',
    { waveName: z.string().optional().describe('Specific wave to display (defaults to active wave)') },
    async (args) => {
      const waveSuffix = args.waveName ? `\n\nWave to display: ${args.waveName}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: BOARD_PROMPT + waveSuffix },
        }],
      };
    },
  );

  server.prompt(
    'compliance',
    'Comprehensive compliance intelligence — quantitative score, structural audit, and cross-referenced synthesis',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: COMPLIANCE_PROMPT },
      }],
    }),
  );

  server.prompt(
    'health',
    'Quick multi-dimensional governance dashboard — one-line verdict with key metrics across flow, compliance, and team health',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: HEALTH_PROMPT },
      }],
    }),
  );

  server.prompt(
    'retro',
    'Wave retrospective — data-backed analysis with real metrics, audit trail evidence, and actionable insights',
    { waveName: z.string().optional().describe('Wave to analyze (defaults to the most recently completed wave)') },
    async (args) => {
      const waveSuffix = args.waveName ? `\n\nWave to analyze: ${args.waveName}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: RETRO_PROMPT + waveSuffix },
        }],
      };
    },
  );
}

// Export for testing
export { STANDUP_PROMPT, PLAN_WAVE_PROMPT, BOARD_PROMPT, COMPLIANCE_PROMPT, HEALTH_PROMPT, RETRO_PROMPT };
