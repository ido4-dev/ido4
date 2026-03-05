/**
 * MCP prompt registrations — standup, plan-wave, board.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const STANDUP_PROMPT = `Provide a morning standup briefing for the current project:

1. Get the current project status using the project status resource or list_waves tool
2. Get the active wave status using get_wave_status
3. List tasks that are blocked, in review (stale > 2 days), or newly unblocked
4. Check for any tasks that are ready to start
5. Suggest today's priorities based on wave goals and dependency chain

Format the response conversationally, not as a raw data dump. Highlight:
- What changed since last session
- What needs attention (stale reviews, long-blocked tasks)
- What to work on next (highest impact, unblocked, aligns with wave goals)`;

const PLAN_WAVE_PROMPT = `Plan the next development wave for the current project:

1. Get current project status to understand overall state
2. Identify all tasks not yet assigned to a wave (or in future waves)
3. Analyze dependencies to determine which tasks can be grouped together
4. Apply Epic Integrity rules: all tasks in an epic MUST go in the same wave
5. Consider historical velocity if available

Present:
- Recommended tasks for the wave, grouped by epic
- Dependencies that constrain the grouping
- Any Epic Integrity considerations
- Tasks deferred to future waves and why`;

const BOARD_PROMPT = `Display a text-based task board for the current project:

1. Get the active wave status (or use the specified wave name if provided)
2. Group tasks by workflow status columns: Backlog | Refinement | Ready | In Progress | In Review | Done
3. Show blocked tasks with a marker

Format as a clean text kanban board. Include:
- Wave name and overall completion percentage
- Task number and short title in each column
- Blocked indicator for blocked tasks
- Epic grouping if multiple epics exist in the wave`;

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'standup',
    'Morning standup briefing with proactive recommendations based on current project state',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: STANDUP_PROMPT },
      }],
    }),
  );

  server.prompt(
    'plan-wave',
    'Plan the next development wave by analyzing dependencies, capacity, and priorities',
    { waveName: z.string().optional().describe('Name for the wave being planned') },
    async (args) => {
      const waveSuffix = args.waveName ? `\n\nWave name to use: ${args.waveName}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: PLAN_WAVE_PROMPT + waveSuffix },
        }],
      };
    },
  );

  server.prompt(
    'board',
    'Display a text-based kanban board of the current wave or project',
    { waveName: z.string().optional().describe('Specific wave to display (defaults to active wave)') },
    async (args) => {
      const waveSuffix = args.waveName ? `\n\nWave to display: ${args.waveName}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: BOARD_PROMPT + waveSuffix },
        }],
      };
    },
  );
}

// Export for testing
export { STANDUP_PROMPT, PLAN_WAVE_PROMPT, BOARD_PROMPT };
