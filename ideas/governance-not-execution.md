---
date: 2026-03-20
status: idea
category: platform
---

# Governance, Not Execution — Strategic Boundary

ido4 is the governance substrate, not an e2e development system. It does not build execution agents (code review, QA, test writing). It governs whatever agents or tools the team uses.

**ido4's role with PRs, branches, code review, QA:**
1. Define governance contracts (BRE steps enforcing process requirements)
2. Consume signals from execution tools (CI, CodeRabbit, SonarQube)
3. Enforce quality gates (merge readiness, configurable per profile)
4. NOT build the agents that do the work — let the ecosystem provide those

**Why this matters:**
- Focus: great governance layer vs. mediocre everything
- Market: "Development Governance Platform" is a new category. "E2E AI dev platform" competes with Cursor, Devin, Factory.
- Architecture: governance is deterministic (BRE). Execution is probabilistic (LLMs). Mixing dilutes the deterministic guarantee.

This is a foundational positioning decision, not just a technical one.
