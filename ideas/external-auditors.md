---
date: 2026-03-20
status: idea
category: governance
---

# External Auditors

Distinct from quality gates. A gate blocks transitions. An auditor observes and reports without blocking. A security auditor runs Snyk weekly and feeds findings into compliance scoring. An architecture auditor checks for dependency violations and surfaces warnings in standup or health check.

Teams adopt gradually: start with auditors (observation, zero friction), then promote specific findings to gates (blocking) as confidence grows. Same plugin, different enforcement level configured in the profile.

Auditors produce findings. Findings accumulate. Patterns emerge. Recommendations are generated (connects to governance maturity Level 3).

**Connects to:** pluggable-quality-gates, signal-provider-abstraction, governance-maturity-levels
