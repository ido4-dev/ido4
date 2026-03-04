---
name: board
description: Display a text-based kanban board of the current wave or project
user-invocable: true
allowed-tools: mcp__ido4__*
---

Display a text-based task board for the current project:

1. Get the active wave status (or use $ARGUMENTS as wave name if provided)
2. Group tasks by workflow status columns: Backlog | Refinement | Ready | In Progress | In Review | Done
3. Show blocked tasks with a marker

Format as a clean text kanban board. Include:
- Wave name and overall completion percentage
- Task number and short title in each column
- Blocked indicator for blocked tasks
- Epic grouping if multiple epics exist in the wave
