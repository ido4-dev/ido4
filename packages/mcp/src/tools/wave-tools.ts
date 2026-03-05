/**
 * Wave tool registrations — 5 MCP tools for wave management.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  WaveNameSchema,
  CreateWaveSchema,
  AssignTaskToWaveSchema,
} from '../schemas/index.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerWaveTools(server: McpServer): void {
  server.tool(
    'list_waves',
    'List all waves in the project with task counts and completion percentages',
    {},
    async () => handleErrors(async () => {
      const container = await getContainer();
      const waves = await container.waveService.listWaves();
      return toCallToolResult({ success: true, data: waves });
    }),
  );

  server.tool(
    'get_wave_status',
    'Get detailed status of a specific wave including task breakdown and metrics',
    WaveNameSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const status = await container.waveService.getWaveStatus(args.waveName);
      return toCallToolResult({ success: true, data: status });
    }),
  );

  server.tool(
    'create_wave',
    'Create a new wave for grouping tasks',
    CreateWaveSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.waveService.createWave(args.name, args.description);
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'assign_task_to_wave',
    'Assign a task to a wave — enforces Epic Integrity (all tasks in an epic must be in the same wave)',
    AssignTaskToWaveSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.waveService.assignTaskToWave(args.issueNumber, args.waveName);
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'validate_wave_completion',
    'Check if a wave can be completed — validates all tasks are Done',
    WaveNameSchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.waveService.validateWaveCompletion(args.waveName);
      return toCallToolResult(result);
    }),
  );
}
