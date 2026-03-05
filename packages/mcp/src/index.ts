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

import { startServer } from './server.js';

async function main(): Promise<void> {
  process.stderr.write('ido4 MCP server starting...\n');
  await startServer();
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
