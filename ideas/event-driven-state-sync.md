---
date: 2026-03-20
status: idea
category: platform
---

# Event-Driven State Synchronization

Today ido4 is pull-based: agent calls tool, BRE validates, transition happens. Real governance also needs push: PR merged in GitHub -> task state updates. CI fails -> task gets flagged.

**Progression:**

1. **Polling (near-term):** A `sync_task_state` tool that reads current GitHub state and reconciles. Works with STDIO, no infrastructure change. Runs when called.

2. **Event abstraction (mid-term):** Design the internal event model so the engine doesn't care whether a state change came from a tool call or a webhook. Same validation, same audit trail.

3. **Webhook ingestion (long-term):** HTTP transport + webhook processing. External tools push events, ido4 processes them through governance. Requires transport expansion beyond STDIO.

Each step is independently useful. Polling is a quick win. The event abstraction is architectural investment. Webhooks are the multi-agent future.

**Connects to:** signal-provider-abstraction, pluggable-quality-gates
