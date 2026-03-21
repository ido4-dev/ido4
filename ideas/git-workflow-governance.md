---
date: 2026-03-20
status: idea
category: governance
---

# Git Workflow Governance

Add git workflow rules to the methodology profile. Just like containers define wave/sprint/cycle, a gitWorkflow section defines branch naming, PR requirements, review policies, merge strategy.

```
gitWorkflow: {
  strategy: 'feature-branch',
  branchNaming: '{type}/{issue-number}-{slug}',
  prRequired: true,
  reviewsRequired: 1,
  ciRequired: true,
  mergeStrategy: 'squash'
}
```

BRE validation steps enforce these: "ValidatePRRequirements" checks profile-defined rules on transitions that require PR (e.g., moving to review, completing a task). Every team does git differently — the profile captures their way, the engine enforces it.

**Connects to:** pluggable-quality-gates
