---
date: 2026-03-20
status: idea
category: platform
---

# Governance Maturity Levels

A progression model for teams adopting ido4, and an architectural roadmap for the platform:

**Level 1 — Configurable (built).** Profile defines rules, engine enforces them. Deterministic, auditable. Teams choose their profile.

**Level 2 — Context-aware.** BRE considers broader situation. Last task in wave? Stricter checks. High-risk task? More gates. Low-risk docs update? Fast track. Rules are conditional — they respond to context. Type-scoped pipelines in Scrum are already this pattern.

**Level 3 — Recommending.** System observes patterns and suggests adjustments. "Coverage gate bypassed 40% of tasks this sprint — threshold too aggressive or coverage infra needs work." Analytics + thresholds + templates. Deterministic rules on observed data. Auditors feed findings into this layer.

**Level 4 — Self-adapting.** System makes low-risk adjustments autonomously. WIP limits adjust based on throughput. Gate thresholds tighten/relax based on defect rates. Every adaptation is auditable and reversible. Humans retain override authority.

Each level builds on the previous. Level 1 is shipped. Level 2 is a natural extension. Level 3 requires accumulated analytics + the auditor/signal infrastructure. Level 4 is the long-term vision.

**Connects to:** external-auditors, pluggable-quality-gates, signal-provider-abstraction
