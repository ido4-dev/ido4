/**
 * Ido4 MCP Server — creates and configures the MCP server with all tools, resources, and prompts.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTaskTools } from './tools/index.js';
import { registerWaveTools } from './tools/index.js';
import { registerDependencyTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'ido4',
    version: '0.1.0',
  });

  // Register all tool groups
  registerTaskTools(server);
  registerWaveTools(server);
  registerDependencyTools(server);

  // Register resources
  registerResources(server);

  // Register prompts
  registerPrompts(server);

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
