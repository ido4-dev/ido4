---
name: compliance
description: Audit the entire project against the 5 Unbreakable Principles with severity scoring — the governance health check
user-invocable: true
allowed-tools: mcp__ido4__*
context: fork
---

You are auditing the project against its 5 Unbreakable Principles. This is the governance health check — it answers "are we following our own rules?" Your job is to identify every violation, score its severity, and provide specific remediation steps.

## Step 1: Gather All Governance Data

1. `get_project_status` — overall state
2. `list_waves` — all waves and their states
3. `list_tasks` — all tasks with wave assignments and statuses
4. `search_epics` — find all epics in the project

This gives you the complete picture. Now audit each principle systematically.

## Step 2: Audit Each Principle

### Principle 1 — Epic Integrity
"All tasks within an epic MUST be assigned to the same wave."

For each epic that has tasks assigned to waves:
- Call `get_epic_tasks` to get all tasks in the epic
- Call `validate_epic_integrity` to check compliance
- If tasks are in different waves, report the violation with severity score

### Principle 2 — Active Wave Singularity
"Only one wave can be active at a time."

From `list_waves`:
- Count waves with active status
- If more than one is active, report with severity score

### Principle 3 — Dependency Coherence
"A task's wave must be numerically equal to or higher than all its dependency tasks' waves."

For tasks with dependencies:
- Call `analyze_dependencies` to map dependency relationships
- Check: does any task depend on a task in a LATER wave?
- Report forward dependency violations with severity score

### Principle 4 — Self-Contained Execution
"Each wave contains all dependencies needed for its completion."

For the active wave:
- Call `validate_dependencies` to check if all dependencies are satisfiable
- Check if any task depends on a task in a future, non-completed wave
- Report unsatisfiable dependencies with severity score

### Principle 5 — Atomic Completion
"A wave is complete only when ALL its tasks are in Done."

For each wave marked as completed:
- Call `validate_wave_completion` to check
- Report non-Done tasks in completed waves with severity score

## Step 3: Score Severity

For each violation, calculate severity to prioritize remediation:

**Base severity** = number of directly affected tasks
**Wave proximity multiplier:**
- Active wave: × 3 (immediate impact on current work)
- Next planned wave: × 1.5 (upcoming impact)
- Future wave: × 1 (can be fixed during planning)

**Cascade multiplier** = 1 + number of downstream tasks blocked by this violation
**Epic scale** = violations in larger epics (5+ tasks) add +2

**Severity = (base × wave proximity) + cascade + epic scale**

Use severity to rank violations and determine the "most urgent fix."

## Step 4: Present the Audit

### Example — Compliance Audit With Teeth

> **Principle 1 — Epic Integrity: 1 VIOLATION**
> Epic "Auth" split: #50, #51, #52 in Wave-002; #53 in Wave-003.
> Severity: 9.5 — base 4 × 3 (active) + cascade 1 (#53 blocked) + epic scale 0
> Impact: Auth can't ship as a complete feature. #53 orphaned.
> Remediation: Move #53 → Wave-002 (completes epic) or defer all 4 → Wave-003 (delays Auth).
>
> **Overall: 4/5 compliant | 1 violation (severity 9.5) | Fix #53's wave assignment**

### Format

For each principle:
```
## Principle N — [Name]
Status: COMPLIANT | N VIOLATION(S)

[If violations:]
- Violation: [specific description with task/wave/epic numbers]
  Severity: [score with breakdown]
  Impact: [what this causes]
  Remediation: [specific fix]
```

End with:
```
## Overall Compliance
Score: X/5 principles compliant
Total violations: N (sum severity: S)
Most urgent fix: [highest-severity violation with action]
```

## Step 5: Persist Findings

After delivering the audit report, output a structured summary block that should be saved to memory:

```
--- COMPLIANCE FINDINGS (save to memory) ---
Date: [today's date]
Score: X/5 compliant
Violations: [list with principle, description, severity]
Most urgent fix: [specific action]
Resolved since last audit: [any improvements]
---
```

Tell the user: "These compliance findings should be saved to memory so `/standup` and `/plan-wave` can reference them. Would you like me to update the project memory?"

This creates the cross-skill feedback loop: compliance violations inform standups (governance debt awareness) and wave planning (violations to address).

### Anti-patterns — Do NOT:
- Skip any principle — audit ALL 5
- Report vague violations — cite specific task numbers, wave names, epic names
- Omit remediation — every violation needs a concrete fix
- Conflate principles — each has distinct validation logic
- Report violations without severity — not all violations are equally urgent
- Sugar-coat violations — if governance is broken, say so clearly
- Forget to persist findings — other skills depend on this output
