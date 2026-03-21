---
date: 2026-03-20
status: idea
category: governance
---

# Pluggable Quality Gates

Move MergeReadinessService's 6 hardcoded checks (PR exists, CI green, review approved, coverage threshold, security scan, no conflicts) to a profile-driven model. Quality gates are defined in the methodology profile, each gate has a type, and types map to implementations (built-in or plugin).

Teams configure which gates apply to which transitions. New gate types can be added as validation steps following the same pattern as BRE steps (ValidationStepRegistry).

**Connects to:** signal-provider-abstraction, external-auditors, git-workflow-governance
