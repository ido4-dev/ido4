---
name: standup
description: Morning standup briefing with proactive recommendations based on current project state
user-invocable: true
allowed-tools: mcp__ido4__*
---

Provide a morning standup briefing for the current project:

1. Get the current project status using `get_project_status`
2. Get the active wave status using `get_wave_status`
3. List tasks that are blocked, in review (stale > 2 days), or newly unblocked
4. Check for any tasks that are ready to start
5. Suggest today's priorities based on wave goals and dependency chain

Format the response conversationally, not as a raw data dump. Highlight:
- What changed since last session (use agent memory if available)
- What needs attention (stale reviews, long-blocked tasks)
- What to work on next (highest impact, unblocked, aligns with wave goals)
