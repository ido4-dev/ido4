/**
 * Legacy epic tool registrations — 4 MCP tools for epic visibility and governance.
 *
 * These tools use epicRepository (Hydro infrastructure) and are only registered
 * when the profile has a container with id === 'epic'.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';
import {
  SearchEpicsSchema,
  GetEpicTasksSchema,
  GetEpicTimelineSchema,
  ValidateEpicIntegritySchema,
} from '../schemas/index.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerEpicTools(server: McpServer, profile: MethodologyProfile): void {
  // Only register legacy epic tools when profile has an 'epic' container
  const hasEpicContainer = profile.containers.some((c) => c.id === 'epic');
  if (!hasEpicContainer) return;

  server.tool(
    'search_epics',
    'Search for epic issues by name or title pattern. Returns matching issues with number, title, and URL.',
    SearchEpicsSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const results = await container.epicRepository.searchEpicIssues(args.searchTerm);
      return toCallToolResult({ success: true, data: { epics: results, total: results.length } });
    }),
  );

  server.tool(
    'get_epic_tasks',
    'Get all tasks assigned to an epic with their status and wave. Essential for wave planning — ensures Epic Integrity (all tasks in an epic must be in the same wave).',
    GetEpicTasksSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const tasks = await container.epicService.getTasksInEpic(args.epicName);
      return toCallToolResult({ success: true, data: { epicName: args.epicName, tasks, total: tasks.length } });
    }),
  );

  server.tool(
    'get_epic_timeline',
    'Get epic issue with timeline: connected issues, sub-issues, and completion summary. Provides the full picture of an epic\'s composition and progress.',
    GetEpicTimelineSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const timeline = await container.epicRepository.getIssueWithTimeline(args.issueNumber);
      return toCallToolResult({ success: true, data: timeline });
    }),
  );

  server.tool(
    'validate_epic_integrity',
    'Check if a task\'s epic assignment maintains Epic Integrity — all tasks in the same epic must be in the same wave. Returns violations if any.',
    ValidateEpicIntegritySchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const task = await container.taskService.getTask({ issueNumber: args.issueNumber });
      const result = await container.epicService.validateEpicIntegrity(task);
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
