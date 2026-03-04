#!/usr/bin/env node

/**
 * @ido4/mcp — Development Governance MCP Server.
 *
 * Exposes ido4 domain logic as MCP tools, resources, and prompts
 * for Claude Code and MCP-compatible AI coding environments.
 *
 * Transport: STDIO (launched as subprocess by Claude Code)
 *
 * Usage in Claude Code:
 *   claude mcp add --transport stdio ido4 -- npx @ido4/mcp
 *
 * Or in .mcp.json:
 *   {
 *     "mcpServers": {
 *       "ido4": {
 *         "command": "npx",
 *         "args": ["@ido4/mcp"],
 *         "env": { "GITHUB_TOKEN": "..." }
 *       }
 *     }
 *   }
 */

// TODO: Phase 2 implementation
// 1. Import Server from @modelcontextprotocol/sdk
// 2. Import ServiceContainer from @ido4/core
// 3. Create STDIO transport
// 4. Register tools (task_*, wave_*, project_*, dependency_*, intelligence_*)
// 5. Register resources (project://, wave://, methodology://, audit://)
// 6. Register prompts (/standup, /plan-wave, /board, /retro, /compliance)
// 7. Initialize ServiceContainer on first tool call (lazy, with project root detection)
// 8. Start server

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.error('ido4 MCP server starting...');
  // Server implementation will go here in Phase 2
  throw new Error('@ido4/mcp server not yet implemented — Phase 2 work');
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', error);
  process.exit(1);
});
