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

1. Call \`get_project_status\` to understand overall project state.
2. Call \`get_wave_status\` for the active wave to get task breakdown by status.
3. Call \`list_tasks\` filtered to the active wave to get full task details.
4. For any tasks In Review, call \`find_task_pr\` and \`get_pr_reviews\` to check review status.
5. For blocked tasks, call \`analyze_dependencies\` to assess downstream impact.

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

### Review Bottleneck Detection
For tasks In Review:
- Does a PR exist? No PR = false status. The task is not really in review — flag this.
- If a PR exists, are reviews requested? Have any been completed?
- How long has the task been in Review? Over 2 days without review activity = escalation needed.
- Multiple stale reviews = process bottleneck, not a one-off.

### Leverage Point Identification
Identify which single action unblocks the most downstream value:
- Resolving a blocker that cascades to 3 tasks is higher leverage than completing an isolated task.
- Completing a review that has been stalling a dependent chain is high leverage.
- Use dependency relationships to quantify impact.

### Opportunity Surfacing
- Tasks recently unblocked (fresh capacity — can be started now).
- Epics near completion (one or two tasks from done — milestone momentum).
- Dependencies newly satisfied (tasks that were waiting and can now proceed).

## Example — What Governance Expertise Sounds Like

A checklist says: "3 tasks are blocked. 5 tasks are done. 2 are in review."

Governance expertise says:

> Wave-002 is at risk — 2 blocked tasks are on the critical path, both in the Auth epic.
>
> **Needs Attention:**
> #42 (Token refresh) — BLOCKED 3 days. Depends on #38 which is In Review with no PR. This is a false status — #38 needs a PR or should return to In Progress. Resolving #38 cascades to unblock #42 and #47.
>
> **Ready:** #49 and #51 are both ready. #51 unblocks 2 downstream tasks — pick it first.
>
> The highest-leverage action today is fixing #38's status — it's the root of a 3-task cascade block.

Notice: it leads with risk, explains the cascade, identifies the root cause, and gives ONE clear recommendation.

## Output Format

Lead with a headline: "Wave-NNN is [on track / at risk / behind] — [key reason]."

Group by urgency:
1. **Needs Attention**: Blocked tasks, stale reviews, governance violations. Include duration, impact, and recommended action.
2. **In Progress**: Active work. Brief status — only flag if something is unexpected.
3. **Ready to Start**: Available tasks, ranked by downstream impact.

End with ONE clear recommendation: "The highest-leverage action today is [specific action] because [specific reason with impact]."

## Anti-patterns — Do NOT:
- Dump raw JSON or tool output
- List every task regardless of relevance
- Say "I called get_project_status" — the user doesn't care about your process
- Ignore blockers to talk about progress
- Recommend starting new work when existing blockers could be resolved first
- Use vague language ("consider looking at...") — be direct ("Work on #42 next")`;

const PLAN_WAVE_PROMPT = `You are composing the next development wave for a wave-based governance project. Your goal is to produce a wave plan that is valid by construction — meaning it satisfies all 5 governance principles before a single task is assigned.

## Data Gathering

1. Call \`get_project_status\` to understand the current state of all waves.
2. Call \`list_tasks\` to identify unassigned tasks and tasks in future waves.
3. Call \`search_epics\` to find all epics, then \`get_epic_tasks\` for each relevant epic.
4. Call \`analyze_dependencies\` for candidate tasks to map dependency chains.
5. Call \`validate_epic_integrity\` for proposed groupings.
6. Call \`validate_dependencies\` to confirm the final composition.

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

### Step 7: Capacity Reasoning
- How many tasks were in the last completed wave?
- How long did it take to complete?
- Use this as a rough capacity ceiling
- Do not overload — a focused wave that completes is better than an ambitious wave that stalls

## Example — What Principle-Aware Planning Sounds Like

A checklist says: "Here are 12 unassigned tasks. I recommend putting them all in Wave-003."

Governance expertise says:

> **Recommended Wave-003 (9 tasks, 2 epics):**
>
> Epic: Auth (4 tasks) — #50 Token service, #51 Session mgmt, #52 Login flow, #53 Logout. All included per Epic Integrity — shipping partial Auth is not viable. #50 → #51 → #52 dependency chain; #53 independent.
>
> Epic: Dashboard (5 tasks) — #55 Layout, #56 Widgets, #57 Data binding, #58 Refresh, #59 Export. #57 depends on #50 (Auth token for API calls) — satisfied within this wave.
>
> **Deferred to Wave-004:** Epic: Settings (3 tasks) — all 3 tasks are ready but including them exceeds last wave's capacity (8 tasks). Deferring the lowest-impact epic.
>
> **Risk:** #57 depends on #50 which has a 3-task chain above it — if #50 slips, #57 and all of Dashboard stalls.

Notice: epic-first grouping, explicit principle citations, dependency rationale, capacity reasoning, and risk flagging.

## Governance Principles Actively Enforced

When any of these principles influences a grouping decision, explain it in the output:
- **Epic Integrity (#1)**: "All 4 Auth tasks are included because splitting an epic across waves is not permitted."
- **Dependency Coherence (#3)**: "Task #55 is deferred because it depends on #60 which is not yet in a completed wave."
- **Self-Contained Execution (#4)**: "Task #48 is pulled in because #45 depends on it and cannot complete without it."

## Output Format

**Recommended Wave Composition:**
Per-epic breakdown:
- Epic name → task list with numbers and titles
- Dependency rationale (why these tasks can work together)
- Risk flags if any

**Deferred to Future Waves:**
- Tasks/epics deferred → specific reason for deferral
- When they could be included (what needs to complete first)

**Risks and Considerations:**
- Complex dependency chains
- Tasks without estimates
- Capacity concerns
- Any trade-offs made

## Anti-patterns — Do NOT:
- Propose tasks individually without checking their epic membership
- Split an epic across waves under any circumstances
- Ignore dependency chains — validate before recommending
- Exceed historical capacity without flagging the risk
- Present a plan without explaining the governance constraints that shaped it`;

const BOARD_PROMPT = `You are displaying an intelligent kanban board for a wave-based governance project. Your goal is not just to show where tasks are — but to analyze whether work is flowing.

## Data Gathering

1. Call \`get_project_status\` for overall context.
2. Call \`get_wave_status\` for the target wave (active wave or specified wave).
3. Call \`list_tasks\` filtered to the wave for full task details.

## Phase-Aware Focus

After gathering data, determine the wave phase and adjust your flow analysis:
- **Early (<30%)**: Expect most tasks in Ready/Refinement. Flag any already blocked — that's an early warning.
- **Mid (30-70%)**: Expect distribution across columns. Focus on flow — are tasks moving? Where's the pile-up?
- **Late (>70%)**: Expect most in Done. Remaining tasks are critical — flag every obstacle.

## Reasoning Framework

### Column Balance Analysis
After grouping tasks by status, analyze the distribution:
- **Review bottleneck**: In Review has many tasks, In Progress has few → approvals are stalling. Recommend prioritizing reviews.
- **Underutilization**: Ready has many tasks, In Progress has few → capacity is available. Recommend picking up ready work.
- **Flow health**: Tasks roughly distributed across columns with most in Done → healthy progression.
- **Front-loaded**: Most tasks in Backlog/Refinement → wave is early or poorly refined.

### Blocked Visibility
For blocked tasks:
- Show the blocked duration (days since blocked)
- Show the blocking reason if available
- Calculate blocked count as percentage of total tasks — this is a health indicator
- > 20% blocked = wave health concern

### Epic Cohesion
Group tasks by epic within status columns:
- If an epic's tasks are spread across columns → it's in progress (normal)
- If all tasks from an epic are in one column → either stuck (bad) or moving together (good)
- If an epic has tasks in Done AND tasks in Backlog → something is wrong with the flow

### Completion Trajectory
- X of Y tasks done
- Calculate completion percentage
- Note velocity based on recent movement if possible

## Example — Board With Flow Intelligence

A checklist shows:
\`\`\`
Ready: #12, #13  |  In Progress: #15  |  In Review: #10, #11  |  Done: #8, #9
\`\`\`

Governance expertise shows:

> \`\`\`
> Wave-002 | 2/8 complete (25%) | 1 blocked
>
> READY          IN PROGRESS     IN REVIEW       DONE
> ─────          ───────────     ─────────       ────
> #12 Auth login #15 API setup   #10 DB schema   #8 Config
> [Auth]         [Infra]         [Data] 3d       [Setup]
> #13 Auth token                 #11 Migrations  #9 Env setup
> [Auth]                         [Data] BLOCKED  [Setup]
> \`\`\`
>
> **Flow insights:** Review bottleneck forming — 2 tasks in Review vs. 1 in Progress. #11 is blocked in Review (unusual — likely waiting on #10). The Data epic is stuck: both tasks in Review, one blocked. Auth epic hasn't started — 2 tasks ready, consider picking up #12 (it unblocks #13).

Notice: visual board + epic tags + duration + blocked markers + actionable flow analysis.

## Output Format

Wave header:
\`\`\`
Wave-NNN | X/Y tasks complete (Z%) | B blocked
\`\`\`

Status columns — clean text layout with task number, short title, epic tag, blocked indicator with duration, review age.

Footer with flow insights:
- Column balance observation ("3 tasks in Review — consider prioritizing approvals")
- Blocked percentage if concerning
- Next milestone ("2 tasks from completing the Data epic")

## Anti-patterns — Do NOT:
- Show a plain list instead of a visual board
- Omit the flow analysis — the board without insight is just data
- Ignore blocked tasks or hide their duration
- Skip the epic grouping — it reveals cohesion patterns`;

const COMPLIANCE_PROMPT = `You are auditing a wave-based governance project against its 5 Unbreakable Principles. Your goal is to identify every violation, quantify its severity, and provide specific remediation steps.

## Data Gathering

1. Call \`get_project_status\` for overall state.
2. Call \`list_waves\` to check wave states.
3. Call \`list_tasks\` to get all tasks with wave assignments.
4. Call \`search_epics\` to find all epics.
5. For each epic with assigned tasks, call \`get_epic_tasks\` and \`validate_epic_integrity\`.
6. Call \`analyze_dependencies\` and \`validate_dependencies\` for dependency analysis.
7. For any completed or completing waves, call \`validate_wave_completion\`.

## Audit Framework

### Principle 1 — Epic Integrity
"All tasks within an epic MUST be assigned to the same wave."
- For each epic that has tasks assigned to waves, check: are ALL tasks in the same wave?
- Use \`validate_epic_integrity\` for each epic.
- Report violations with specific task numbers and their wave assignments.
- Remediation: either move all tasks to one wave or defer the entire epic.

### Principle 2 — Active Wave Singularity
"Only one wave can be active at a time."
- Check \`list_waves\` for wave states.
- Count waves with "Active" or equivalent status.
- If more than one is active, report the specific waves.
- Remediation: deactivate all but the primary active wave.

### Principle 3 — Dependency Coherence
"A task's wave must be numerically equal to or higher than all its dependency tasks' waves."
- For tasks with dependencies, check wave numbers.
- A task in Wave-002 depending on a task in Wave-003 is a violation (forward dependency).
- Use \`analyze_dependencies\` to find these.
- Report specific task pairs and their wave assignments.
- Remediation: move the dependent task to a later wave, or move the dependency to an earlier wave.

### Principle 4 — Self-Contained Execution
"Each wave contains all dependencies needed for its completion."
- For the active wave, check if any task depends on a task in a future (non-completed) wave.
- This is related to Principle 3 but specifically about executability.
- Report tasks that cannot be completed because their dependencies are in future waves.
- Remediation: pull dependencies into the current wave or defer the dependent tasks.

### Principle 5 — Atomic Completion
"A wave is complete only when ALL its tasks are in Done."
- Check completed/closed waves: do they have any tasks NOT in Done status?
- Use \`validate_wave_completion\` for waves that should be complete.
- Report waves marked complete with non-Done tasks.
- Remediation: either complete the remaining tasks or re-open the wave.

## Severity Scoring

For each violation, calculate a severity score to prioritize remediation:

**Base severity** = number of directly affected tasks
**Wave proximity multiplier:**
- Violation in active wave: × 3 (immediate impact)
- Violation in next planned wave: × 1.5 (upcoming impact)
- Violation in future wave: × 1 (can be fixed during planning)

**Cascade multiplier** = 1 + number of downstream tasks blocked by this violation
**Epic scale** = violations in larger epics (5+ tasks) add +2 to severity

Final severity = (base × wave proximity) + cascade + epic scale

Use severity to rank violations and determine the "most urgent fix."

## Example — Compliance Audit With Teeth

A checklist says: "1 Epic Integrity violation found."

Governance expertise says:

> **Principle 1 — Epic Integrity: 1 VIOLATION**
> Epic "Auth" has tasks split across waves: #50, #51, #52 in Wave-002 and #53 in Wave-003.
> Severity: 9.5 — 4 tasks affected (base 4) × 3 (active wave) + 1 (cascade: #53 blocked by #52) + 2 (epic scale: 4 tasks)
> Impact: Auth cannot be delivered as a complete feature in Wave-002. #53 (Logout) will be structurally orphaned.
> Remediation: Move #53 into Wave-002 (preferred — completes the epic) or defer all 4 Auth tasks to Wave-003 (delays Auth delivery by one wave).

Notice: specific task numbers, severity quantified, impact explained in business terms, two remediation options with trade-offs.

## Output Format

For each principle:
\`\`\`
## Principle N — [Name]
Status: COMPLIANT | N VIOLATION(S)

[If violations exist:]
- Violation: [specific description with task/wave numbers]
  Severity: [calculated score with breakdown]
  Impact: [what this causes in business terms]
  Remediation: [specific fix with options if applicable]
\`\`\`

End with:
\`\`\`
## Overall Compliance
Score: X/5 principles compliant
Total violations: N (sum of severity scores: S)
Most urgent fix: [highest-severity violation with specific action]
\`\`\`

## Anti-patterns — Do NOT:
- Skip any principle — audit all 5 even if you suspect they're all compliant
- Report vague violations ("some tasks might have issues") — be specific with task numbers
- Omit remediation steps — every violation must have a concrete fix
- Conflate principles — each has distinct validation logic
- Report violations without severity — not all violations are equally urgent`;

const RETRO_PROMPT = `You are conducting a wave retrospective for a wave-based governance project. Your goal is to extract actionable insights from the completed (or completing) wave that improve future planning and execution.

## Data Gathering

1. Call \`get_project_status\` for overall context.
2. Call \`get_wave_status\` for the target wave.
3. Call \`list_tasks\` filtered to the target wave for full task details.
4. Call \`list_waves\` to compare with previous waves if they exist.
5. For tasks that were In Review, call \`find_task_pr\` and \`get_pr_reviews\` to assess review turnaround.

## Analysis Framework

### Delivery Analysis
- How many tasks were in the wave at start vs. at completion?
- Were tasks added mid-wave? (Scope creep indicator)
- Were tasks deferred out of the wave? Why?
- What was the planned scope vs. actual delivery?

### Flow Analysis
Examine where tasks spent time:
- Which status had the most tasks concurrently? That's the bottleneck.
- Many tasks in Review for long periods → review process issue.
- Many tasks blocked → external dependency issue or poor dependency planning.
- Tasks moving quickly through early stages but stalling later → late-stage process problem.

### Blocker Analysis
- How many tasks were blocked during the wave?
- What was the average block duration?
- What were the blocking reasons?
- Are there patterns? Same dependency blocking multiple tasks. Same external system causing delays. Same type of task getting blocked.
- Blocker recurrence: if this pattern appeared in previous waves, it's systemic.

### Velocity Metrics
- Tasks completed in this wave.
- Compare to previous waves if data is available.
- Time from wave start to completion.
- Identify velocity trends (improving, declining, stable).

### Epic Progress
- Which epics had tasks in this wave?
- Which epics are now complete?
- Which epics still have remaining tasks for future waves?
- Epic completion rate per wave as a progress metric.

### Recommendations
Based on the data — not generic advice:
- If review turnaround was slow → specific recommendation (e.g., "set a 24-hour review SLA" or "pair review sessions")
- If blockers recurred → specific mitigation (e.g., "create a mock for the External API" or "front-load dependency resolution")
- If scope changed mid-wave → specific process change (e.g., "lock wave scope after activation" or "add a buffer of 1-2 tasks")
- If velocity dropped → investigate cause (larger tasks? more blockers? fewer contributors?)

## Example — Retrospective With Insight

A checklist says: "Wave-002 completed 8 of 10 tasks. 2 were deferred."

Governance expertise says:

> Wave-002 delivered 8 of 10 planned tasks in 12 days. The wave was characterized by a persistent review bottleneck — 3 tasks spent over 2 days in Review, and the Auth epic's completion was delayed by a cascading block.
>
> **Key finding:** The primary bottleneck was review turnaround (avg 2.4 days in Review). Tasks #42 and #47 were blocked for a combined 7 days because #38 sat in Review without a PR — a false status that went undetected until day 6.
>
> **Recommendation:** Implement a daily status check: any task In Review for >1 day without a PR should be automatically flagged. This single check would have saved 5 of the 7 blocked days.
>
> **Carry forward:** The External API dependency blocked 2 tasks in this wave and 1 in Wave-001. This is a trend — consider creating a mock service for Wave-003.

Notice: narrative with character assessment, data-backed findings, specific actionable recommendations tied to data, and trend detection across waves.

## Output Format

Write a narrative retrospective — not a data table.

**Opening**: "Wave-NNN delivered X of Y planned tasks in Z days. [One-sentence summary of the wave's character — was it smooth, blocked, scope-crept, etc.]"

**Key Findings**: 2-4 paragraphs covering the most significant patterns. Lead with the biggest insight.

**By the Numbers**: Brief metrics section — tasks completed, blocked count, average review time, velocity comparison.

**Recommendations**: 2-4 specific, actionable recommendations. Each tied to a finding from this wave's data.

**Carry Forward**: Items to watch in the next wave — recurring patterns, unresolved blockers, deferred tasks that need attention.

## Anti-patterns — Do NOT:
- Give generic retrospective advice ("communicate better") — tie every recommendation to specific data
- Skip comparison with previous waves if data exists — trends matter more than snapshots
- Ignore the emotional tone — if a wave was painful (many blockers, scope changes), acknowledge it
- List metrics without interpretation — "5 tasks blocked" means nothing without "and 3 of them were blocked by the same unresolved API dependency"`;

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
    'Intelligent kanban visualization with flow analysis — not just what is where, but whether work is flowing',
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
    'Audit the entire project against the 5 Unbreakable Principles with severity scoring',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: COMPLIANCE_PROMPT },
      }],
    }),
  );

  server.prompt(
    'retro',
    'Wave retrospective — analyze a completed wave to extract actionable insights for future planning',
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
export { STANDUP_PROMPT, PLAN_WAVE_PROMPT, BOARD_PROMPT, COMPLIANCE_PROMPT, RETRO_PROMPT };
