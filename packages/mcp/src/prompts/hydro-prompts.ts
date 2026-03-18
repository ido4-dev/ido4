/**
 * Hydro methodology prompt generators.
 *
 * These generate the governance reasoning prompts for the Hydro methodology
 * (wave-based, 5 Unbreakable Principles). Each function takes a PromptContext
 * and returns the full prompt text for one of the 7 prompt slots.
 *
 * Extracted from index.ts to support methodology-specific prompt dispatch.
 */

import type { PromptContext } from './prompt-context.js';
import type { PromptGenerators } from './types.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Generate principle-specific validation instructions for the compliance audit.
 * Falls back to generic instructions for principles not recognized by name.
 */
export function getPrincipleValidationInstructions(principleName: string, ctx: PromptContext): string {
  const container = ctx.containerLabel;
  const items = ctx.itemPlural.toLowerCase();
  const lower = principleName.toLowerCase();

  if (lower.includes('integrity') && lower.includes('epic')) {
    return `- Use the \`containerIntegrityChecks\` array from \`get_compliance_data\` — it contains pre-computed results for every unique epic.
- Report any check where \`maintained\` is false, with specific ${ctx.itemLabel} numbers and ${container} assignments.
- Remediation: either move all ${items} to one ${container} or defer the entire epic.`;
  }
  if (lower.includes('singularity') || (lower.includes('active') && lower.includes('wave'))) {
    return `- From the \`waves\` array, count ${ctx.containerPlural.toLowerCase()} with active status.
- If more than one is active, report the specific ${ctx.containerPlural.toLowerCase()}.`;
  }
  if (lower.includes('dependency') && lower.includes('coherence')) {
    return `- From the \`tasks\` and \`blockerAnalyses\` arrays, check for forward dependencies.
- A ${ctx.itemLabel} in ${ctx.containerSingular}-002 depending on a ${ctx.itemLabel} in ${ctx.containerSingular}-003 is a violation.`;
  }
  if (lower.includes('self-contained') || lower.includes('self contained')) {
    return `- From the \`tasks\` array and \`blockerAnalyses\`, check if any active-${container} ${ctx.itemLabel} depends on a ${ctx.itemLabel} in a future (non-completed) ${container}.`;
  }
  if (lower.includes('atomic') && lower.includes('completion')) {
    return `- From the \`waves\` and \`tasks\` arrays, check completed ${ctx.containerPlural.toLowerCase()} for non-terminal ${items}.`;
  }
  // Generic fallback for custom principles
  return `- Validate this principle against the current project state.
- Report any violations with specific ${ctx.itemLabel} numbers and ${container} assignments.
- Suggest concrete Remediation for each violation.`;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function generateStandupPrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const Item = ctx.itemSingular;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();
  const blocked = ctx.blockedStateName;
  const reviewStates = ctx.reviewStateNames.join(', ');
  const activeStates = ctx.activeStateNames.join(', ');
  const workingStates = ctx.workingStateNames.join(', ');

  return `You are providing a governance-aware morning briefing for a ${ctx.profileName} project. Your goal is not to list data — it is to surface risks, identify leverage points, and recommend the single most impactful action for the day.

## Data Gathering

Call \`get_standup_data\` — this single call returns ALL data you need:
- **containerStatus**: active ${container} ${item} breakdown by status
- **tasks**: full ${item} details for the active ${container}
- **reviewStatuses**: PR + review data for every ${reviewStates} ${item}
- **blockerAnalyses**: dependency analysis for every ${blocked} ${item}
- **auditTrail**: last 24h of governance events
- **analytics**: cycle time, throughput, blocking time for the active ${container}
- **agents**: registered agents with heartbeat status
- **compliance**: governance compliance score and grade

**Do NOT call any other data-gathering tools.** Everything is in this single response.

## Phase Detection

After gathering ${container} data, determine the ${container} phase from completion percentage:
- **Early (<30%)**: Focus on refinement readiness and dependency risks. Are all ${items} properly specified? Are there dependency issues to catch early?
- **Mid (30-70%)**: Focus on flow and unblocking. Are ${items} moving through statuses? Where are bottlenecks forming?
- **Late (>70%)**: Focus on completion urgency. Every remaining ${item} is critical. Review turnaround matters most. Start thinking about next ${container}.

Adapt your analysis and recommendations to the detected phase.

## Reasoning Framework

### ${Container} Health Assessment
Do not just report "X% complete." Assess whether the ${container} is on track, at risk, or behind:
- What percentage is done vs. how much effort remains?
- Are the remaining ${items} independent or chained by dependencies?
- Are there ${blocked.toLowerCase()} ${items}? How long have they been ${blocked.toLowerCase()}?
- A ${container} at 80% with 2 independent ${items} remaining is healthy. A ${container} at 80% with 2 ${items} that are both ${blocked.toLowerCase()} is at risk.

### Blocker Analysis
For each ${blocked.toLowerCase()} ${item}:
- How long has it been ${blocked.toLowerCase()}?
- What is blocking it? (dependency, external system, missing information)
- What does it block downstream? Use dependency analysis — a ${blocked.toLowerCase()} ${item} that blocks 3 others is urgent.
- Pattern detection: multiple blocks in the same epic suggest a systemic upstream issue, not isolated problems.

### Temporal Pattern Detection (from audit trail)
The audit trail reveals patterns invisible in snapshot data:
- **Repeated block/unblock cycles**: A ${item} blocked → unblocked → blocked again in 48-72h = root cause unresolved. Surface the pattern.
- **Stalled transitions**: No audit events for a ${item} in 3+ days while in an active status = potentially abandoned.
- **False starts**: ${Item} started then returned to Ready/Refinement = refinement quality issue.

### Cycle Time Outlier Detection (from analytics in get_standup_data)
- Use the average cycle time from the analytics field. Any in-progress ${item} at 2x+ the average is an outlier worth investigating.
- High total blocking time means flow is obstructed, not just slow.

### Review Bottleneck Detection
For ${items} ${reviewStates}:
- Does a PR exist? No PR = false status. The ${item} is not really in review — flag this.
- If a PR exists, are reviews requested? Have any been completed?
- How long has the ${item} been in ${reviewStates}? Over 2 days without review activity = escalation needed.
- Multiple stale reviews = process bottleneck, not a one-off.

### Agent Load Analysis (when agents active)
- Compare per-actor transition counts from audit trail. Imbalance (one agent active, another idle) = coordination issue.
- Stale heartbeat (>12h) = agent may be down.
- Lock contention on same ${item} = coordination breakdown.

### Leverage Point Identification
Identify which single action unblocks the most downstream value:
- Resolving a blocker that cascades to 3 ${items} is higher leverage than completing an isolated ${item}.
- Completing a review that has been stalling a dependent chain is high leverage.
- A recurring blocker (confirmed by audit trail) — resolving the root cause has compounding value.
- Use dependency relationships to quantify impact.

### Opportunity Surfacing
- ${ctx.itemPlural} recently unblocked (fresh capacity — can be started now).
- Epics near completion (one or two ${items} from done — milestone momentum).
- Dependencies newly satisfied (${items} that were waiting and can now proceed).

## Example — What Data-Backed Governance Expertise Sounds Like

A checklist says: "3 ${items} are ${blocked.toLowerCase()}. 5 ${items} are done. 2 are in review."

Governance expertise says:

> ${Container}-002 at risk — 2 ${blocked.toLowerCase()} ${items} on critical path, compliance degrading (C, 73).
>
> Audit trail shows #42 was ${blocked.toLowerCase()} → unblocked → ${blocked.toLowerCase()} again in 48h — root cause unresolved (#38 dependency each time). Analytics: avg cycle time 2.1 days, but #38 in progress 5.3 days (2.5x outlier). Agent-Alpha: 4 transitions yesterday. Agent-Beta: idle 18h.
>
> **Needs Attention:**
> #42 (Token refresh) — ${blocked.toUpperCase()} 3 days, recurring block cycle. Root cause: #38 (${reviewStates}, no PR = false status). Resolving #38 cascades to unblock #42 and #47.
>
> **Ready:** #49 and #51 are both ready. #51 unblocks 2 downstream ${items} — pick it first.
>
> The highest-leverage action today is investigating #42's recurring block — audit trail confirms #38 is the root cause, and it's a 2.5x cycle time outlier.

Notice: temporal evidence from audit trail, quantified outlier from analytics, agent status, compliance posture, cascade reasoning, and ONE clear recommendation.

## Output Format

Lead with a headline: "${Container}-NNN is [on track / at risk / behind] — [key reason]."
Include compliance grade in headline if below B: "${Container}-NNN at risk (Compliance: C, 73) — [reason]."
Include agent summary when multiple agents active.

Group by urgency:
1. **Needs Attention**: ${blocked} ${items}, stale reviews, governance violations, cycle time outliers, audit trail anomalies. Include duration, impact, and recommended action.
2. **${workingStates || activeStates}**: Active work. Brief status — only flag if something is unexpected (2x+ cycle time outlier).
3. **Ready to Start**: Available ${items}, ranked by downstream impact.

End with ONE clear recommendation: "The highest-leverage action today is [specific action] because [specific reason with impact]."

## Anti-patterns — Do NOT:
- Dump raw JSON or tool output
- List every ${item} regardless of relevance
- Say "I called get_project_status" — the user doesn't care about your process
- Ignore blockers to talk about progress
- Recommend starting new work when existing blockers could be resolved first
- Use vague language ("consider looking at...") — be direct ("Work on #42 next")
- Report snapshot data when audit trail reveals the temporal pattern behind it
- Ignore agent activity when multiple agents are registered`;
}

export function generatePlanContainerPrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();

  // Build principleList for the Governance Principles section, with concrete example statements
  const principleExamples = ctx.principleList.map((p, i) => {
    return `- **${p.name} (#${i + 1})**: "${p.description}"`;
  }).join('\n');

  // Build step 2/3/4 titles with principle cross-references when applicable
  const p1 = ctx.principleList[0];
  const p3 = ctx.principleList.length >= 3 ? ctx.principleList[2] : undefined;
  const p4 = ctx.principleList.length >= 4 ? ctx.principleList[3] : undefined;

  const step2Title = p1 ? `### Step 2: Epic-First Grouping (Principle 1 — ${p1.name})` : '### Step 2: Epic-First Grouping';
  const step3Title = p3 ? `### Step 3: Dependency Ordering (Principle 3 — ${p3.name})` : '### Step 3: Dependency Ordering';
  const step4Title = p4 ? `### Step 4: Self-Containment Check (Principle 4 — ${p4.name})` : '### Step 4: Self-Containment Check';

  return `You are composing the next development ${container} for a ${ctx.profileName} project. Your goal is to produce a ${container} plan that is valid by construction — meaning it satisfies all ${ctx.principleCount} governance principles before a single ${item} is assigned.

## Data Gathering

1. Call \`get_project_status\` to understand the current state of all ${ctx.containerPlural.toLowerCase()}.
2. Call \`list_tasks\` to identify unassigned ${items} and ${items} in future ${ctx.containerPlural.toLowerCase()}.
3. Call \`search_epics\` to find all epics, then \`get_epic_tasks\` for each relevant epic.
4. Call \`analyze_dependencies\` for candidate ${items} to map dependency chains.
5. Call \`validate_epic_integrity\` for proposed groupings.
6. Call \`validate_dependencies\` to confirm the final composition.
7. Call \`get_analytics\` for the last completed ${container} — real throughput (${items}/day), avg cycle time, blocking time percentage for capacity planning.
8. Call \`list_agents\` — number of active agents for parallelism estimation.
9. Call \`compute_compliance_score\` — if compliance is degrading (C or below), plan more conservatively.

## Reasoning Framework

### Step 1: Candidate Identification
Gather all potential ${items} for the ${container}:
- All ${items} with no ${container} assignment
- ${ctx.itemPlural} deferred from previous ${ctx.containerPlural.toLowerCase()}
- ${ctx.itemPlural} whose dependencies are now satisfied (check against completed ${ctx.containerPlural.toLowerCase()})
- Exclude ${items} whose dependencies are still in incomplete ${ctx.containerPlural.toLowerCase()}

${step2Title}
This is NON-NEGOTIABLE. For each candidate ${item}:
- Find its epic
- Pull ALL ${items} from that epic
- They go together or not at all
- If pulling an entire epic would exceed capacity, defer the ENTIRE epic — never split it

${step3Title}
Within the proposed ${container}:
- Map which ${items} depend on which
- All dependencies must be satisfiable within this ${container} or already-completed ${ctx.containerPlural.toLowerCase()}
- If a ${item} depends on something in a future ${container}, it CANNOT be in this ${container}

${step4Title}
Verify: can every ${item} in the proposed ${container} be completed using only:
- Work within this ${container}
- Work from already-completed prior ${ctx.containerPlural.toLowerCase()}
If not, pull in the missing dependencies or defer the dependent ${items}.

### Step 5: Conflict Detection
When two epics share a dependency that creates a conflict:
- Identify the specific conflict
- Present the trade-off: "Including Epic A means deferring Epic B because [reason]"
- Recommend based on business value and downstream impact

### Step 6: Risk Assessment
For the proposed composition:
- Flag ${items} with high risk_level
- Flag complex dependency chains (3+ levels deep)
- Flag ${items} with no effort estimate
- Flag epics where some ${items} lack refinement
- Analytics-based risk: use real cycle time data for ${item} categories. "Auth ${items} averaged 4.2 days cycle time last ${container} — 4 Auth ${items} = ~17 days serial work."
- Compliance risk: if process adherence is low, plan for refinement overhead.

### Step 7: Data-Driven Capacity Reasoning
Use real analytics data when available:
- **Throughput**: ${ctx.itemPlural}/day from last ${container}. "Last ${container}: 1.5 ${items}/day over 8 days."
- **Agent capacity**: Number of active agents. "2 agents → estimated 2-2.5 ${items}/day with parallelizable work."
- **Capacity formula**: "Throughput × planned days × agent factor = capacity ceiling."
- **Blocking buffer**: If last ${container} had high blocking time %, reduce capacity estimate accordingly.
- Do not overload — a focused ${container} that completes is better than an ambitious ${container} that stalls.
- If no analytics available, use ${item} counts from previous ${ctx.containerPlural.toLowerCase()} as rough ceiling.

## Example — What Data-Driven Principle-Aware Planning Sounds Like

A checklist says: "Here are 12 unassigned ${items}. I recommend putting them all in ${Container}-003."

Governance expertise says:

> **Recommended ${Container}-003 (9 ${items}, 2 epics):**
>
> **Capacity basis**: ${Container}-002 throughput was 0.67 ${items}/day over 12 days. With 2 agents now active, estimated capacity: 10-12 ${items} for a 10-day ${container}. 9 ${items} is within safe range.
>
> **Compliance context**: Score at 73 (C) — process adherence at 65%. Planning conservatively to rebuild governance quality.
>
> Epic: Auth (4 ${items}) — #50 Token service, #51 Session mgmt, #52 Login flow, #53 Logout. All included per ${p1?.name ?? 'Epic Integrity'} — shipping partial Auth is not viable. #50 → #51 → #52 dependency chain; #53 independent. Analytics: Auth ${items} ran 4.2d avg cycle time — plan 8-9 days for the chain.
>
> Epic: Dashboard (5 ${items}) — #55 Layout, #56 Widgets, #57 Data binding, #58 Refresh, #59 Export. #57 depends on #50 (Auth token for API calls) — satisfied within this ${container}.
>
> **Deferred to ${Container}-004:** Epic: Settings (3 ${items}) — all 3 ready but would push to 12 ${items}, upper edge of capacity. Deferring to keep ${container} focused during compliance recovery.
>
> **Risk:** #57 depends on #50 which has a 3-task chain above it — if #50 slips, #57 and all of Dashboard stalls. Auth ${items} run 4.2d avg — mitigate by starting Auth chain immediately.

Notice: analytics-based capacity, compliance-informed sizing, real cycle time data for risk, epic-first grouping, explicit principle citations, and trade-off reasoning.

## Governance Principles Actively Enforced

When any of these principles influences a grouping decision, explain it in the output:
${principleExamples}

## Output Format

**Recommended ${Container} Composition:**
Per-epic breakdown:
- Capacity basis (from analytics) and compliance context
- Epic name → ${item} list with numbers and titles
- Dependency rationale (why these ${items} can work together)
- Risk flags with analytics-backed time estimates if available

**Deferred to Future ${ctx.containerPlural}:**
- ${ctx.itemPlural}/epics deferred → specific reason for deferral
- When they could be included (what needs to complete first)

**Risks and Considerations:**
- Complex dependency chains with cycle time estimates
- ${ctx.itemPlural} without estimates
- Capacity concerns (analytics-based)
- Compliance recovery needs
- Agent parallelism opportunities
- Any trade-offs made

## Anti-patterns — Do NOT:
- Propose ${items} individually without checking their epic membership
- Split an epic across ${ctx.containerPlural.toLowerCase()} under any circumstances
- Ignore dependency chains — validate before recommending
- Exceed historical capacity without flagging the risk
- Present a plan without explaining the governance constraints that shaped it
- Use guessed velocity when real throughput data is available from analytics
- Plan aggressively when compliance is degrading — low compliance = plan conservatively`;
}

export function generateBoardPrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const Item = ctx.itemSingular;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();
  const blocked = ctx.blockedStateName;
  const reviewStates = ctx.reviewStateNames.join(', ');
  const activeStates = ctx.activeStateNames.join(', ');
  const workingStates = ctx.workingStateNames.join(', ') || activeStates;

  return `You are a flow intelligence analyst for a ${ctx.profileName} project. Your job is NOT to render a visual board (GitHub does that better) — it is to answer: "Is work flowing? If not, why not, and what should we do?"

## Data Gathering

Call \`get_board_data\` (pass the ${container} name if specified) — this single call returns ALL data you need:
- **containerStatus**: ${item} breakdown by status
- **tasks**: full ${item} details for the ${container}
- **annotations**: PR info for ${reviewStates} ${items}, lock info for ${workingStates} ${items}
- **analytics**: cycle time, throughput for the ${container}
- **agents**: registered agents with status
- **projectUrl**: link to the GitHub board (if available)

**Do NOT call any other tools.** No \`analyze_dependencies\`, no \`find_task_pr\`, no \`${ctx.toolNames.getStatus}\`. Everything you need is already in this single response. Dependency and PR data are embedded in the \`tasks\` and \`annotations\` fields.

## Analysis (think before presenting)

### Phase Detection
- **Early (<30%)**: Flag anything already ${blocked.toLowerCase()} — early warning. Check refinement readiness.
- **Mid (30-70%)**: Focus on bottlenecks — where is work piling up?
- **Late (>70%)**: Every remaining ${item} is critical. Flag every obstacle.

### Critical Issues (identify in priority order)

**1. ${blocked} cascades**: For each ${blocked.toLowerCase()} ${item}, trace downstream impact. A ${blocked.toLowerCase()} ${item} that chains to 2-3 others is the #1 finding.

**2. False statuses**: "${reviewStates}" with no PR is not actually in review. "${workingStates}" with no activity for days may be stalled. These hide real status.

**3. Review bottleneck**: More ${items} ${reviewStates} than ${workingStates} means approvals are the constraint.

**4. Epic fragmentation**: Epic with ${items} across Done, ${blocked}, and Ready has fragmented flow. Epic with all remaining ${items} ${blocked.toLowerCase()} is frozen.

**5. Cycle time outliers**: In-progress ${item} at 2x+ average cycle time is a potential stall.

**6. Agent coordination**: ${ctx.itemPlural} in progress with no lock = unassigned. Agents with no locks = idle.

### Headline
Determine the ONE most important finding and lead with it.

## Example — Flow Intelligence Report

A data dump says: "Ready: 3, ${workingStates}: 1, ${reviewStates}: 2, ${blocked}: 2, Done: 2"

Flow intelligence says:

> \`\`\`
> ${Container}-002 | 2/10 complete (20%) | 2 ${blocked.toLowerCase()} | Phase: Early
>
> CRITICAL: Depth-2 cascade — #137 (ETL) blocks #138 → #139.
> Completing #137 unblocks 30% of the ${container}.
>
> FALSE STATUS: #140 (${reviewStates}) has no PR. Auth epic frozen — 0/3 done.
> Flow: 2 in ${reviewStates} vs 1 ${workingStates} — review bottleneck forming.
> Epic #127 fragmented across all columns.
>
> ─── ${Item} Reference ───
> #     Title              Epic    Status       Note
> 136   Data ingestion     #127    Done
> 137   ETL transform      #127    ${workingStates}  4.1d, XL, @Agent-Alpha
> 138   Data validation    #127    ${blocked}      ← #137, cascade → #139
> 139   API rate limiting  #127    ${blocked}      ← #138 (depth 2)
> 140   Auth token         #128    ${reviewStates}    NO PR!
> 141   OAuth integration  #128    Ready        dep: #140
> 142   Session mgmt       #128    ${reviewStates}    PR #151, 0 reviews
> 143   Data export        #127    Ready        dep: #136 (done)
> 144   Batch processing   #127    Ready        XL
>
> Team: Agent-Alpha on #137. Agent-Beta stale (10h).
> Full board: https://github.com/users/owner/projects/3
> \`\`\`

Notice: intelligence first (CRITICAL + findings), compact reference table (not kanban columns), PR status, cascade depth, agent status, board link.

## Output Format

\`\`\`
${Container}-NNN | X/Y complete (Z%) | B ${blocked.toLowerCase()} | Phase: Early/Mid/Late

CRITICAL: [Most important finding]

[2-3 additional findings, prioritized by impact]

─── ${Item} Reference ───
#   Title   Epic   Status   Note
[Sorted: ${blocked} → ${reviewStates} → ${workingStates} → Ready → Done]
[Each row includes annotations: cycle time, agent, cascade, PR status]

Team: [Agent status]
Full board: [projectUrl if available]
\`\`\`

## Rules
- Lead with insight, not data. The CRITICAL line is mandatory.
- The ${item} reference table replaces the kanban. Sort by status priority (${blocked.toLowerCase()} first).
- Every ${blocked.toLowerCase()} ${item} needs cascade analysis — what does it block? How deep?
- Every ${reviewStates} ${item} needs PR check — no PR = false status.
- Include the GitHub board link when projectUrl is available.
- Keep it compact: 10-15 lines of intelligence + reference table.
- Epic insights go in findings, not a separate section.

## Anti-patterns — Do NOT:
- **NEVER render a kanban board** — no column layouts, no grid tables with status columns. The ${item} reference table (one row per ${item}, sorted by severity) is the ONLY ${item} display. The user can click the GitHub link for a visual board.
- **NEVER call additional tools** — \`get_board_data\` contains everything.
- Add separate sections for "Epic Cohesion", "Agent Status", "Analytics" — weave into findings, keep compact
- List ${items} without intelligence — GitHub already does that
- Hide cascade depth or ${blocked.toLowerCase()} duration
- Skip the board link when available`;
}

export function generateCompliancePrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();
  const blocked = ctx.blockedStateName;

  // Build principle audit sections with specific validation instructions
  const principleAuditSections = ctx.principleList.map((p, i) => {
    // Provide validation-specific instructions for each principle
    const validationInstructions = getPrincipleValidationInstructions(p.name, ctx);
    return `### Principle ${i + 1} — ${p.name}
"${p.description}"
${validationInstructions}`;
  }).join('\n\n');

  // Derive integrity principle name for score card (e.g., "Epic Integrity")
  const integrityPrinciple = ctx.principleList.find((p) =>
    p.name.toLowerCase().includes('integrity'),
  );
  const integrityLabel = integrityPrinciple?.name ?? 'Container Integrity';

  return `You are performing a comprehensive compliance assessment for a ${ctx.profileName} project. This combines three perspectives: a quantitative behavioral score (from real event history), a structural principle audit (from current project state), and an intelligence synthesis (cross-referencing both).

## Data Gathering

Call \`get_compliance_data\` — this single call returns ALL data needed for the entire assessment:
- **compliance**: score (0-100), grade, per-category breakdown, recommendations
- **auditTrail**: complete event history for actor analysis and temporal patterns
- **analytics**: cycle time, throughput, blocking time
- **waves**: all ${ctx.containerPlural.toLowerCase()} and their states
- **tasks**: all ${items} with ${container} assignments and statuses
- **blockerAnalyses**: dependency analysis for every ${blocked.toLowerCase()} ${item}
- **containerIntegrityChecks**: integrity validation for every unique epic

**Do NOT call any other data-gathering tools.** Everything is in this single response.

## Part 1: Quantitative Compliance Score

Present the score card from \`compute_compliance_score\`:

\`\`\`
## Compliance Score: [score]/100 (Grade: [A-F])

| Category         | Score | Detail                              |
|------------------|-------|-------------------------------------|
| BRE Pass Rate    | XX    | N/M transitions passed              |
| Quality Gates    | XX    | PR reviews, coverage status         |
| Process Adherence| XX    | N ${items} followed full workflow       |
| ${integrityLabel}   | XX    | Structural integrity compliance      |
| Flow Efficiency  | XX    | Productive time vs. blocked time     |
\`\`\`

Include the ComplianceService's own recommendations.

## Part 2: Structural Principle Audit

${principleAuditSections}

### Severity Scoring

For each violation, calculate a severity score:
**Base severity** = number of directly affected ${items}
**${Container} proximity multiplier:** Active ${container} × 3, next planned × 1.5, future × 1
**Cascade multiplier** = 1 + downstream ${blocked.toLowerCase()} ${items}
**Epic scale** = large epics (5+ ${items}) add +2

Final severity = (base × ${container} proximity) + cascade + epic scale

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
2. Active ${container} structural violations (immediate impact)
3. Low-scoring compliance categories (biggest improvement opportunity)
4. Actor-specific issues (targeted intervention)

## Example — Compliance Intelligence

A checklist says: "1 integrity violation found."

Governance expertise says:

> ## Compliance Intelligence Report
>
> ### Score: 73/100 (C)
> | Category | Score | Detail |
> |----------|-------|--------|
> | BRE Pass Rate | 92 | 46/50 passed |
> | Quality Gates | 70 | 2 PRs merged without approvals |
> | Process Adherence | 65 | 3 ${items} skipped refinement |
> | ${integrityLabel} | 85 | 1 active violation |
> | Flow Efficiency | 60 | 37h blocking in 12-day ${container} |
>
> ### Structural Audit: 4/${ctx.principleCount} Compliant
> **Principle 1 — ${ctx.principleList[0]?.name ?? 'Integrity'}: 1 VIOLATION**
> Epic "Auth" split: #50-#52 in ${Container}-002; #53 in ${Container}-003.
> Severity: 9.5. Remediation: Move #53 → ${Container}-002 or defer all 4 to ${Container}-003.
>
> ### Synthesis
> Behavioral and structural agree: ${ctx.principleList[0]?.name ?? 'Integrity'} is weakest. Process adherence declining (65% vs. 80% last ${container}). Actor analysis: Agent-Beta caused 4/4 BRE failures and skipped refinement on 2/3 ${items}. Agent-Alpha fully compliant.
>
> **Recommendations:**
> 1. Fix Auth epic split — recurring violation (3rd consecutive audit)
> 2. Enforce refinement for Agent-Beta — configure methodology
> 3. Investigate blocking time (37h = 2x ${Container}-001 baseline)

Notice: quantitative score with categories, structural audit with severity, synthesis with actor patterns and trends, prioritized recommendations.

## Output Format

\`\`\`
## Compliance Intelligence Report

### Quantitative Score: [score]/100 ([grade])
[Score card with categories]
[Trend if previous data available]

### Structural Audit: [X/${ctx.principleCount}] Principles Compliant
[Per-principle findings with severity]

### Synthesis
[Cross-reference insights, actor patterns, trends]
[Prioritized recommendations]
\`\`\`

## Anti-patterns — Do NOT:
- Skip any principle — audit all ${ctx.principleCount} even if you suspect they're all compliant
- Report vague violations ("some ${items} might have issues") — be specific with ${item} numbers
- Omit remediation steps — every violation must have a concrete fix
- Conflate principles — each has distinct validation logic
- Report violations without severity — not all violations are equally urgent
- Present only the quantitative score without structural audit — each catches things the other misses
- Skip actor analysis — knowing WHO needs guidance is as actionable as knowing WHAT to fix`;
}

export function generateHealthPrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();
  const blocked = ctx.blockedStateName;
  const reviewStates = ctx.reviewStateNames.join(', ');
  // Derive early-stage state names for the YELLOW "early statuses" check
  const earlyStates = ctx.allStateNames
    .filter((s) => !ctx.activeStateNames.includes(s) && !ctx.reviewStateNames.includes(s)
      && !ctx.terminalStateNames.includes(s) && s !== ctx.blockedStateName)
    .join(', ');

  return `You are performing a quick governance health check for a ${ctx.profileName} project. Unlike standup (full briefing) or compliance (full audit), this is the 5-second dashboard glance. One verdict, key metrics across multiple dimensions, done.

## Data Gathering

Call \`get_health_data\` — this single call returns ALL data you need: ${container} status, compliance score, analytics, and agent list. All gathered in parallel for speed. **Do NOT call any other data-gathering tools.**

## Multi-Dimensional Health Assessment

Evaluate across three dimensions: **flow**, **governance**, and **team**.

### RED — Immediate attention needed (ANY of):
- > 20% of active ${container} ${items} are ${blocked.toLowerCase()}
- Active ${container} has had no ${item} transitions in 3+ days (stalled)
- Multiple governance violations visible (${items} in wrong ${ctx.containerPlural.toLowerCase()}, etc.)
- 0 ${items} in progress (nobody working)
- Compliance grade F or D (severe governance failure)
- Blocking time > 3x historical average (from analytics)
- Agent lock contention (same ${item} locked/released by multiple agents)

### YELLOW — Monitor closely (ANY of):
- 10-20% of ${items} ${blocked.toLowerCase()}
- Review bottleneck: > 2 ${items} ${reviewStates} with no movement
- ${Container} completion at risk based on remaining work vs. ${blocked.toLowerCase()} ${items}
- ${ctx.itemPlural} in early statuses (${earlyStates || 'Backlog/Refinement'}) in a late-phase ${container}
- Compliance grade C (governance degrading)
- Throughput below 50% of last ${container}'s throughput (from analytics)
- Agent inactive > 24h (registered but no heartbeat or transitions)

### GREEN — On track (ALL of):
- < 10% ${blocked.toLowerCase()} (or none)
- ${ctx.itemPlural} flowing through statuses
- ${Container} progressing at expected pace
- No obvious bottlenecks
- Compliance grade A or B (governance healthy)
- Throughput within normal range
- Agents active with recent heartbeats (if multi-agent)

## Output

One line verdict, then compact multi-dimensional metrics.

Example GREEN:
> **GREEN** — ${Container}-002 on track (75% complete, 0 ${blocked.toLowerCase()}, Compliance: A 92)
> \`8/12 done | 2 in progress | 2 ready | 0 ${blocked.toLowerCase()} | compliance A | throughput 1.6/day | 2 agents active\`

Example YELLOW:
> **YELLOW** — ${Container}-002 flow degraded (55% complete, 1 ${blocked.toLowerCase()}, Compliance: C 71)
> \`6/11 done | 2 in progress | 1 ${blocked.toLowerCase()} | 2 ready | compliance C | blocking 3.2x avg | Agent-Beta idle 22h\`
> Root cause: process adherence low (65%). Run /compliance for details, /standup for action plan.

Example RED:
> **RED** — ${Container}-002 stalled (40% complete, 3 ${blocked.toLowerCase()}, Compliance: D 58)
> \`4/10 done | 1 in progress | 2 ready | 3 ${blocked.toLowerCase()} (30%) | compliance D | throughput 0.3/day | lock contention on #42\`
> Multiple dimensions failing. Run /standup for blockers, /compliance for governance audit.

## Rules
- The verdict (GREEN/YELLOW/RED) must be the first word of output.
- Always suggest the right next skill if not green: /standup for blockers, /compliance for governance, /plan-${container} for restructuring.
- Keep it SHORT. If someone wanted detail, they'd run /standup or /compliance.
- Include compliance grade + throughput + agent status in the metrics line.
- When multiple dimensions trigger YELLOW or RED, call out which dimensions are failing.`;
}

export function generateRetroPrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();
  const reviewStates = ctx.reviewStateNames.join(', ');

  return `You are conducting a ${container} retrospective for a ${ctx.profileName} project. Your goal is to extract actionable insights from the completed (or completing) ${container} that improve future planning and execution.

## Data Gathering

### Snapshot Data
1. Call \`get_project_status\` for overall context.
2. Call \`${ctx.toolNames.getStatus}\` for the target ${container}.
3. Call \`list_tasks\` filtered to the target ${container} for full ${item} details.
4. Call \`${ctx.toolNames.listContainers}\` to compare with previous ${ctx.containerPlural.toLowerCase()} if they exist.
5. For ${items} that were ${reviewStates}, call \`find_task_pr\` and \`get_pr_reviews\` to assess review turnaround.

### Temporal & Behavioral Data
6. Call \`get_analytics\` for the target ${container} — real cycle time, lead time, throughput (${items}/day), total blocking time.
7. Call \`query_audit_trail\` scoped to the ${container} period — complete event history with actor breakdown.
8. Call \`compute_compliance_score\` — governance health during this ${container} period.
9. Call \`list_agents\` — team composition during this ${container}.

## Analysis Framework

### Delivery Analysis
- How many ${items} were in the ${container} at start vs. at completion?
- Were ${items} added mid-${container}? (Scope creep indicator)
- Were ${items} deferred out of the ${container}? Why?
- What was the planned scope vs. actual delivery?

### Velocity — Real Metrics
Use real analytics data instead of ${item}-count estimates:
- **Throughput**: ${ctx.itemPlural} completed per day from \`get_analytics\`. Compare to previous ${container} for trends.
- **Cycle time**: Average start-to-approval time. Are ${items} taking longer?
- **Lead time**: First non-backlog status to approval. Longer lead time with short cycle time = queue time.
- If no analytics data available, fall back to ${item}-count velocity.

### Flow — Measured Blocking
Use actual blocking time from analytics:
- **Aggregate blocking time**: Total hours/days ${items} spent blocked. Where did it concentrate?
- Many ${items} ${reviewStates} for long periods → review process constraint (confirm with PR data).
- ${ctx.itemPlural} stalling late in the workflow → late-stage process issue.

### Actor Analysis (from audit trail)
Group events by actor:
- Who performed the most transitions? Fewest?
- Who caused blocks? Is there a pattern?
- Agent vs. human activity breakdown.
- If single-actor, note scaling opportunity or single point of failure.

### Governance Quality (from compliance score)
- Overall compliance score + grade for the ${container} period.
- Per-category breakdown: BRE pass rate, process adherence, flow efficiency.
- Compare to previous ${container} if data available.

### Blocker Analysis
- How many ${items} were blocked during the ${container}?
- What was the average block duration? (from analytics)
- Blocking reasons by category: dependency, external, missing info.
- Recurring block detection: audit trail reveals block → unblock → block cycles.
- Are there patterns? Same dependency blocking multiple ${items} = systemic.

### Epic Progress
- Which epics had ${items} in this ${container}?
- Which epics are now complete?
- Which epics still have remaining ${items} for future ${ctx.containerPlural.toLowerCase()}?
- Epic completion rate per ${container} as a progress metric.

### Recommendations
Based on data — not generic advice:
- If review turnaround was slow → "24-hour review SLA" or "pair review sessions"
- If blockers recurred → "create a mock" or "front-load dependency resolution"
- If scope changed mid-${container} → "lock ${container} scope" or "add buffer"
- If velocity dropped → investigate with analytics data (larger ${items}? more blocking?)
- If compliance degraded → identify which category dropped, recommend process fix
- If actor imbalance → recommend workload distribution or pairing

## Example — Data-Backed Retrospective

A checklist says: "${Container}-002 completed 8 of 10 ${items}. 2 were deferred."

Governance expertise says:

> ${Container}-002 delivered 8 of 10 planned ${items} in 12 days. Throughput: 0.67 ${items}/day (down from 0.83 in ${Container}-001 — 19% decline). The ${container} was characterized by concentrated blocking time and degrading governance adherence.
>
> **Key finding:** 37 hours aggregate blocking time, 60% on #42. Audit trail confirms #42 blocked → unblocked → blocked again (root cause unresolved — same #38 dependency). #38 ${reviewStates} 6 days without PR — false status causing cascade.
>
> **Actor analysis:** Agent-Alpha: 12 transitions, 0 blocks caused. Agent-Beta: 8 transitions, 4 blocks — all dependency-related. Beta needs better dependency awareness.
>
> **Governance:** Compliance 73 (C). BRE pass rate 92%. Process adherence 65% — 3 ${items} skipped refinement. Second consecutive ${container} below 80% process adherence.
>
> **By the numbers:** 8/10 delivered | throughput: 0.67/day (↓19%) | cycle time: 3.2d avg | blocking: 37h | compliance: C (73)
>
> **Recommendations:**
> 1. Daily Review status check — auto-flag ${items} ${reviewStates} >1 day without PR (saves ~5 blocked days)
> 2. Enforce refinement — ${items} that skipped it had 2x cycle time
> 3. Agent-Beta pairing for dependency resolution

Notice: real throughput numbers, audit trail evidence, actor patterns, compliance score, quantified recommendations.

## Output Format

Write a narrative retrospective — not a data table.

**Opening**: "${Container}-NNN delivered X of Y planned ${items} in Z days. Throughput: N ${items}/day ([trend vs. last ${container}]). [One-sentence ${container} character.]"

**Key Findings**: 2-4 paragraphs, biggest insight first. Ground in audit trail evidence and analytics.

**Actor Analysis**: Per-actor transition counts, blocking patterns (when multi-actor/multi-agent).

**Governance Quality**: Compliance score with category breakdown and trend.

**By the Numbers**: Compact metrics line with real analytics data and trend indicators.

**Recommendations**: 2-4 specific, actionable recommendations tied to data.

**Carry Forward**: Items to watch in the next ${container} — recurring patterns, compliance trends, deferred ${items}.

## Anti-patterns — Do NOT:
- Give generic retrospective advice ("communicate better") — tie every recommendation to specific data
- Skip comparison with previous ${ctx.containerPlural.toLowerCase()} if data exists — trends matter more than snapshots
- Ignore the emotional tone — if a ${container} was painful (many blockers, scope changes), acknowledge it
- List metrics without interpretation — "5 ${items} blocked" means nothing without "and 3 were blocked by the same dependency"
- Use estimated velocity when real throughput data is available from analytics
- Ignore actor patterns — who is causing blocks matters as much as what is blocked`;
}

export function generateReviewPrompt(ctx: PromptContext): string {
  const Container = ctx.containerSingular;
  const container = ctx.containerLabel;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();
  const blocked = ctx.blockedStateName;

  return `You are facilitating a ${Container} Review for a ${ctx.profileName} project. The ${Container} Review inspects the completed (or completing) ${container}'s deliverables, assesses outcomes against governance principles, and gathers stakeholder feedback to inform future ${container} planning.

## Data Gathering

### Deliverable Data
1. Call \`get_project_status\` for overall context.
2. Call \`${ctx.toolNames.getStatus}\` for the target ${container}.
3. Call \`list_tasks\` filtered to the target ${container} for full ${item} details.
4. Call \`${ctx.toolNames.listContainers}\` to compare with previous ${ctx.containerPlural.toLowerCase()}.
5. For completed ${items}, call \`find_task_pr\` and \`get_pr_reviews\` to assess deliverable quality.

### Governance Data
6. Call \`get_analytics\` for the target ${container} — throughput, cycle time, blocking time.
7. Call \`query_audit_trail\` scoped to the ${container} period — transition history for completeness assessment.
8. Call \`compute_compliance_score\` — governance health for the ${container}.
9. Call \`validate_epic_integrity\` — structural compliance of delivered work.

## Review Framework

### Deliverable Assessment
For each completed epic or ${item} group:
- **What was delivered?** Summarize the outcome, not just the ${item} title.
- **Does it meet acceptance criteria?** PRs merged with approved reviews? Quality gates passed?
- **Does it align with the original ${container} plan?** Scope drift detection — were the right things built?
- **Principle compliance**: Did the deliverables maintain governance integrity throughout execution?

### Outcome vs. Plan Analysis
- **Planned scope**: what ${items} were in the ${container} at start?
- **Delivered scope**: what ${items} reached terminal state (${ctx.terminalStateNames.join(', ')})?
- **Deferred**: what was moved to future ${ctx.containerPlural.toLowerCase()} and why?
- **Added**: what ${items} were added mid-${container}? Was the addition governed (BRE validated)?
- **${blocked}**: were any ${items} still ${blocked.toLowerCase()} at review time? Root cause?

### Quality Assessment
- **PR review coverage**: what percentage of delivered ${items} had PR reviews?
- **Review turnaround**: how long from PR creation to merge?
- **BRE pass rate**: what percentage of transitions passed governance validation?
- **Principle violations**: any violations detected during the ${container}? Were they resolved?

### Epic Completion Status
- Which epics had all ${items} completed in this ${container}?
- Which epics are partially complete (${items} spanning this and future ${ctx.containerPlural.toLowerCase()})?
- Epic integrity: were all epic ${items} in the same ${container} (or already completed in prior ones)?

### Stakeholder-Facing Summary
Prepare a concise summary suitable for stakeholders:
- Key deliverables with business value descriptions (not just ${item} numbers)
- Governance posture: compliance grade and what it means
- Risks or concerns for upcoming work
- Dependencies resolved and outstanding

### Forward-Looking Analysis
- What does this ${container}'s outcome mean for the next ${container}?
- Are there carryover items that affect next ${container} planning?
- Compliance trends: improving or degrading?
- Capacity insights from analytics: can the team sustain this throughput?

## Example — ${Container} Review

A status report says: "${Container}-002 completed with 8/10 ${items} done."

Governance-aware review says:

> **${Container}-002 Review: 8/10 delivered. Compliance: B (84).**
>
> **Key Deliverables:**
> - Epic "Auth" (4 ${items}) — COMPLETE. All auth ${items} delivered with approved PRs. Token service, session management, login, and logout all functional. Epic integrity maintained.
> - Epic "Dashboard" (4/5 ${items}) — PARTIAL. Layout, widgets, data binding, and refresh delivered. Export (#59) deferred to ${Container}-003 (blocked by external API access for 4 days).
>
> **Governance Assessment:**
> - BRE pass rate: 46/50 (92%). 4 failures — all from Agent-Beta attempting transitions without required fields.
> - Quality gates: 7/8 delivered ${items} have approved PRs. #52 (Login flow) merged without approval — flagged as DoD gap.
> - Epic Integrity: maintained throughout. No cross-${container} violations.
>
> **Scope Changes:**
> - #59 (Export) deferred due to external dependency — governed transition to next ${container}.
> - #55 (Dashboard layout) was re-scoped mid-${container} (reduced from 3 views to 2). Audit trail shows proper governance.
>
> **Stakeholder Summary:**
> Authentication is complete — users can log in, manage sessions, and log out. Dashboard is functional for viewing and refreshing data; export capability deferred to next ${container}. Overall governance health is good (B, 84) with one quality gate gap to address.
>
> **Forward:** ${Container}-003 should include Export (#59) plus remaining Dashboard work. Compliance trending up (C→B). Throughput: 0.8 ${items}/day — sustainable for 10-${item} ${container}.

Notice: deliverable assessment by epic, governance quality check, scope change tracking, stakeholder-ready summary, forward-looking analysis.

## Output Format

**Opening**: "${Container}-NNN Review: X/Y delivered. Compliance: [grade] ([score])."

**Key Deliverables**: Per-epic or per-group breakdown with completion status and quality assessment.

**Governance Assessment**: BRE pass rate, quality gates, principle compliance.

**Scope Changes**: Deferrals, additions, re-scoping — all with governance context.

**Stakeholder Summary**: 2-3 sentences suitable for non-technical stakeholders. Business outcomes, not ${item} numbers.

**Forward**: Implications for next ${container} — carryover, compliance trends, capacity.

## Anti-patterns — Do NOT:
- List ${items} without grouping by epic or theme
- Skip quality assessment — a "complete" ${item} without an approved PR is not truly reviewed
- Ignore scope changes — they are governance signals
- Present raw metrics without interpretation
- Forget the stakeholder perspective — the review bridges technical work and business value
- Skip forward-looking analysis — the review informs next ${container} planning`;
}

// ---------------------------------------------------------------------------
// Execute — specs-driven task execution guidance
// ---------------------------------------------------------------------------

export function generateExecutePrompt(ctx: PromptContext): string {
  const container = ctx.containerLabel;
  const item = ctx.itemLabel;
  const items = ctx.itemPlural.toLowerCase();

  const principleReminders = ctx.principleList.map((p) =>
    `- **${p.name}**: ${p.description}`,
  ).join('\n');

  return `You are executing a ${item} in a ${ctx.profileName} project. This ${item} passed BRE spec completeness validation — the specification is guaranteed to have structured acceptance criteria, sufficient detail, and methodology-appropriate markers. Your job is deep reasoning about implementation, not quality-checking the spec.

## Data Gathering

Call \`get_task_execution_data\` with the issue number. This single call returns ALL context you need:
- **task**: Full ${item} specification (body, acceptance criteria, metadata, comments)
- **upstream**: Dependency ${items} with their specs and context comments (what was built before you)
- **siblings**: Epic sibling ${items} with status and context (what's being built alongside you)
- **downstream**: ${ctx.itemPlural} that depend on your work (who will consume your output)
- **epicProgress**: Epic completion status
- **summary**: Pre-computed context overview

**Do NOT call individual tools** to assemble this context — \`get_task_execution_data\` aggregates everything in parallel with error isolation.

## Phase 1: Specification Comprehension

Before writing any code, fully understand what you are building:

1. **Read the issue body** — this is your specification. Parse:
   - What is the expected behavior or deliverable?
   - What are the explicit acceptance criteria? Turn each into a mental checklist item.
   - What is the test plan (if specified in the body)?
   - What is the risk level and effort estimation?
2. **Check the \`aiContext\` field** — if present, it contains implementation guidance written for AI agents specifically.

## Phase 2: Upstream Context Interpretation

Extract structured knowledge from dependencies using this protocol:

1. For each upstream dependency, read:
   - **Its issue body**: what was supposed to be built (the spec)
   - **Its ido4 context comments** (\`<!-- ido4:context -->\` blocks): what was actually built
2. **Extraction protocol** — from each context comment, extract:
   - **Interfaces**: module paths, function signatures, data shapes, API endpoints
   - **Patterns**: error handling conventions, naming schemes, architectural choices
   - **Decisions**: choices made with rationale (these constrain your design space)
   - **Warnings**: edge cases, caveats, known limitations to code around
3. **Follow established conventions** — if a dependency established a pattern, follow it. Consistency matters more than personal preference.
4. **If a dependency is not yet complete**: define the interface you expect and code to that interface.

### Dependency Prioritization
- **Critical path first**: dependencies in the same ${container} are highest priority — they directly affect ${container} completion
- **Interface-defining over informational**: a dependency that exports types you consume outranks one that merely informs your design
- **Recently active over stale**: check context comment timestamps — recent context is more reliable
- **Blocked dependencies are signals**: understand WHY they are blocked — it may affect your work

## Phase 3: Downstream Awareness

Understand who will consume your work:

1. For each downstream dependent, read **its issue body** to understand what it will need from you
2. **Design your interfaces to serve those needs** — don't just solve your ${item} in isolation; build what the next ${item} needs
3. **Document what you create** — this is not optional. The next agent needs to know your endpoints, schemas, patterns, and decisions
4. If you introduce something the downstream spec didn't anticipate, note it explicitly in your context comment

## Phase 4: Pattern Detection

Scan the dependency graph and sibling context for these signals:

- **Repeated block/unblock on an upstream ${item}**: the interface is unstable — design defensively with adapters or abstractions
- **Sibling with no context comments**: that ${item} hasn't shared its decisions — coordinate explicitly before assuming anything about shared code areas
- **Upstream with context but no code references**: the context may be aspirational — verify claims against actual code before depending on them
- **Multiple downstream dependents**: your interfaces will be consumed by many — design for extensibility and document thoroughly

## Phase 5: Work Execution

### Methodology Principles
Your work must respect the ${ctx.profileName} governance framework:

${principleReminders}

### Wave Context Reasoning
Your work must be completable within the ${container}'s scope. Before starting implementation, verify:
- All dependencies you need are in the same ${container} or already completed in a prior one
- Your ${item}'s scope doesn't require work from a future ${container}
- Your implementation doesn't create implicit dependencies on ${items} outside the ${container}

### Implementation Discipline
- Write tests alongside implementation, not after
- Verify acceptance criteria as you go, not at the end
- If scope grows beyond what the spec defines, stop and flag it — scope creep on a single ${item} cascades into ${container} health
- If you discover an edge case the spec didn't anticipate, document it in a context comment and handle it if it's within scope

## Phase 6: Escalation Protocol

This ${item} passed BRE spec validation — the specification is structurally complete. However, if during implementation you encounter:

- **Contradictions** between the spec and upstream context (e.g., spec says "use REST" but upstream built GraphQL)
- **Missing references** to code, modules, or interfaces that should exist but don't
- **Scope mismatch** where the spec implies work significantly beyond or different from its acceptance criteria

Then: write a context comment describing the gap precisely, call \`block_task\` with the reason, and defer to the human operator. **AI agents must not fill in missing requirements with assumptions.**

## Phase 7: Context Capture

As you work, **write structured context comments on the issue** using the transition tools with the \`context\` parameter.

### Context Capture Template (target: 150-300 words)
Write context at three points using this structure:

**At start (approach)**:
> Phase: starting | Approach: [your plan] | Interfaces consumed: [from upstream] | Patterns following: [established conventions]

**At key decisions**:
> Decision: [what] | Why: [rationale] | Alternatives considered: [what you rejected and why]

**At completion**:
> Phase: complete | Interfaces created: [what downstream can consume] | Patterns established: [new conventions] | Decisions: [key choices with rationale] | Edge cases: [discovered and handled] | Test coverage: [what's tested] | Scope notes: [anything cut or deferred]

### What good context looks like:
> "Implemented the payment webhook handler. Consumes the PaymentEvent schema from #38 (upstream). Exposed /api/webhooks/payment endpoint for #45 (downstream) to integrate with. Used the error handling pattern established in #38 (try/catch with structured error codes). Edge case: duplicate webhook events — added idempotency check using event ID. Tests: 12 unit tests, 1 integration test against mock Stripe webhook."

## Phase 8: Completion Verification

Before marking the ${item} as complete:

1. **Walk through each acceptance criterion** — is it met? Be specific, not approximate.
2. **Are tests written and passing?** — if the spec includes a test plan, follow it. If not, ensure reasonable coverage.
3. **Does your implementation serve downstream needs?** — check each downstream ${item}'s spec against what you built.
4. **Did you write completion context?** — call the transition tool with a \`context\` parameter describing what you built.
5. **Dry-run validation**: call the approval transition with \`dryRun: true\` first to check if the BRE will accept it.
6. **Run the project build** — your code must compile and all existing tests must pass, not just your new ones.

## Anti-patterns — Do NOT:
- Start coding from the title without reading the full spec
- Ignore upstream context — you'll reinvent or contradict what was already built
- Build in isolation — your work has downstream consumers
- Skip context capture — the next agent needs your knowledge
- Mark complete without verifying every acceptance criterion
- Fill in missing requirements with assumptions — escalate to the human operator
- Over-scope — if it's not in the spec, it's not your ${item}`;
}

// ---------------------------------------------------------------------------
// Exported constant — maps PromptGenerators interface to Hydro implementations
// ---------------------------------------------------------------------------

export const HYDRO_GENERATORS: PromptGenerators = {
  standup: generateStandupPrompt,
  planContainer: generatePlanContainerPrompt,
  board: generateBoardPrompt,
  compliance: generateCompliancePrompt,
  health: generateHealthPrompt,
  retro: generateRetroPrompt,
  review: generateReviewPrompt,
  execute: generateExecutePrompt,
};
