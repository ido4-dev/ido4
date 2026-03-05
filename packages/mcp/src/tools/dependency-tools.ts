/**
 * Dependency tool registrations — 2 MCP tools for dependency analysis.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DependencySchema } from '../schemas/index.js';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerDependencyTools(server: McpServer): void {
  server.tool(
    'analyze_dependencies',
    'Analyze the full dependency tree for a task — detects circular dependencies and depth',
    DependencySchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.dependencyService.analyzeDependencies(args.issueNumber);
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'validate_dependencies',
    'Validate that all dependencies for a task are satisfied (all in Done status)',
    DependencySchema,
    async (args) => handleErrors(async () => {
      const container = await getContainer();
      const result = await container.dependencyService.validateDependencies(args.issueNumber);
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
