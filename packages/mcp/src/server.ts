/**
 * Ido4 MCP Server — creates and configures the MCP server with all tools, resources, and prompts.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { MethodologyProfile } from '@ido4/core';
import { registerTaskTools } from './tools/index.js';
import { registerContainerTools } from './tools/index.js';
import { registerDependencyTools } from './tools/index.js';
import { registerProjectTools } from './tools/index.js';
import { registerEpicTools } from './tools/index.js';
import { registerSandboxTools } from './tools/index.js';
import { registerAuditTools } from './tools/index.js';
import { registerAnalyticsTools } from './tools/index.js';
import { registerAgentTools } from './tools/index.js';
import { registerComplianceTools } from './tools/index.js';
import { registerSkillDataTools } from './tools/index.js';
import { registerDistributionTools } from './tools/index.js';
import { registerCoordinationTools } from './tools/index.js';
import { registerGateTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

export function createServer(profile: MethodologyProfile): McpServer {
  const server = new McpServer({
    name: 'ido4',
    version: '0.1.0',
  });

  // Register all tool groups
  registerTaskTools(server, profile);
  registerContainerTools(server, profile);
  registerDependencyTools(server);
  registerProjectTools(server, profile);
  registerEpicTools(server, profile);
  registerSandboxTools(server);
  registerAuditTools(server);
  registerAnalyticsTools(server);
  registerAgentTools(server);
  registerComplianceTools(server);
  registerSkillDataTools(server);
  registerDistributionTools(server);
  registerCoordinationTools(server);
  registerGateTools(server);

  // Register resources
  registerResources(server, profile);

  // Register prompts
  registerPrompts(server, profile);

  return server;
}

export async function startServer(): Promise<void> {
  const projectRoot = process.env.IDO4_PROJECT_ROOT ?? process.cwd();
  const { ProfileConfigLoader } = await import('@ido4/core');
  const profile = await ProfileConfigLoader.load(projectRoot);
  const server = createServer(profile);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
