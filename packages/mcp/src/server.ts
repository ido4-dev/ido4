/**
 * Ido4 MCP Server — creates and configures the MCP server with all tools, resources, and prompts.
 *
 * Supports two modes:
 * - Full mode (profile provided): registers all tools immediately for the known methodology.
 * - Bootstrap mode (profile = null): registers only profile-independent tools. Profile-dependent
 *   tools are deferred until init_project or create_sandbox writes the methodology config,
 *   at which point activateMethodology() dynamically registers them.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { MethodologyProfile } from '@ido4/core';
import { setActivationCallback } from './helpers/index.js';
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
import { registerIngestionTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

/**
 * Register profile-dependent tools, resources, and prompts.
 * Called immediately in full mode, or deferred via callback in bootstrap mode.
 */
function registerMethodologyTools(server: McpServer, profile: MethodologyProfile): void {
  registerTaskTools(server, profile);
  registerContainerTools(server, profile);
  registerEpicTools(server, profile);
  registerResources(server, profile);
  registerPrompts(server, profile);
}

export function createServer(profile: MethodologyProfile | null): McpServer {
  const server = new McpServer({
    name: 'ido4',
    version: '0.5.0',
  });

  if (profile) {
    // Full mode — register all profile-dependent tools immediately
    registerMethodologyTools(server, profile);
  } else {
    // Bootstrap mode — defer profile-dependent registration until methodology is known
    setActivationCallback((srv, p) => registerMethodologyTools(srv, p));

    // Pre-register resource and prompt capabilities. The MCP SDK requires capabilities
    // to be declared before connect(). Without at least one resource and one prompt
    // registered, post-connect calls to server.resource()/server.prompt() would fail
    // with "Cannot register capabilities after connecting to transport."
    server.resource(
      'server-mode',
      'ido4://server/mode',
      { description: 'Current server mode and available operations', mimeType: 'application/json' },
      async (uri) => ({
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ mode: 'bootstrap', availableOperations: ['init_project', 'create_sandbox'] }),
          mimeType: 'application/json',
        }],
      }),
    );

    server.prompt(
      'setup',
      'Get started — run init_project or create_sandbox to configure your methodology',
      async () => ({
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: 'The ido4 server is in bootstrap mode. Run init_project to configure governance for an existing repository, or create_sandbox to create a demo project. Both will configure the methodology (Hydro, Scrum, or Shape Up) and activate methodology-specific tools.',
          },
        }],
      }),
    );
  }

  // Profile-independent tools — always registered
  registerProjectTools(server);
  registerDependencyTools(server);
  registerSandboxTools(server);
  registerAuditTools(server);
  registerAnalyticsTools(server);
  registerAgentTools(server);
  registerComplianceTools(server);
  registerSkillDataTools(server);
  registerDistributionTools(server);
  registerCoordinationTools(server);
  registerGateTools(server);
  registerIngestionTools(server);

  return server;
}

export async function startServer(): Promise<void> {
  const projectRoot = process.env.IDO4_PROJECT_ROOT ?? process.cwd();
  const { ProfileConfigLoader } = await import('@ido4/core');

  let profile: MethodologyProfile | null;
  try {
    profile = await ProfileConfigLoader.load(projectRoot);
  } catch {
    // Bootstrap mode — no .ido4/methodology-profile.json yet.
    // Only profile-independent tools are registered. After init_project or
    // create_sandbox writes the config, activateMethodology() dynamically
    // registers the correct methodology-specific tools.
    process.stderr.write(
      'ido4: no methodology profile found — starting in bootstrap mode. Run init_project or create_sandbox to set up.\n',
    );
    profile = null;
  }

  const server = createServer(profile);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
