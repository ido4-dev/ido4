---
name: plan-wave
description: Plan the next development wave by analyzing dependencies, capacity, and priorities
user-invocable: true
allowed-tools: mcp__ido4__*, Read, Grep
---

Plan the next development wave for the current project:

1. Get current project status to understand overall state
2. Identify all tasks not yet assigned to a wave (or in future waves)
3. Analyze dependencies to determine which tasks can be grouped together
4. Apply Epic Integrity rules: all tasks in an epic MUST go in the same wave
5. Consider historical velocity from agent memory (if available)
6. Suggest wave composition with reasoning

Present:
- Recommended tasks for the wave, grouped by epic
- Dependencies that constrain the grouping
- Any Epic Integrity considerations
- Estimated capacity based on historical velocity
- Tasks deferred to future waves and why

Use $ARGUMENTS as the wave name if provided.
