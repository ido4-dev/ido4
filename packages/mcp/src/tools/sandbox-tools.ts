/**
 * Sandbox tool registrations — 3 MCP tools for sandbox lifecycle management.
 *
 * Sandbox tools bootstrap standalone (like init_project) — they create their own
 * GraphQL client and SandboxService, then reset the shared container after completion
 * so subsequent tool calls pick up the new/removed config.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CreateSandboxSchema,
  ResetSandboxSchema,
  DestroySandboxSchema,
} from '../schemas/sandbox-schemas.js';
import { handleErrors, toCallToolResult, resetContainer, activateMethodology } from '../helpers/index.js';
import {
  GitHubGraphQLClient,
  CredentialManager,
  ConsoleLogger,
  SandboxService,
} from '@ido4/core';

function createSandboxService(): SandboxService {
  const logger = new ConsoleLogger({ component: 'sandbox' });
  const credentialManager = new CredentialManager(logger);
  const graphqlClient = new GitHubGraphQLClient(credentialManager, logger);
  return new SandboxService(graphqlClient, logger);
}

function getProjectRoot(): string {
  return process.env.IDO4_PROJECT_ROOT ?? process.cwd();
}

export function registerSandboxTools(server: McpServer): void {
  server.tool(
    'create_sandbox',
    'Create a governed sandbox project with embedded governance violations. Uses the ingestion pipeline to create tasks from a technical spec, then applies methodology-specific state simulation and violation injection. Supports: hydro-governance (Hydro), scrum-sprint (Scrum), shape-up-cycle (Shape Up).',
    CreateSandboxSchema,
    async (args) => handleErrors(async () => {
      const service = createSandboxService();
      const projectRoot = args.projectRoot ?? getProjectRoot();
      const result = await service.createSandbox({
        repository: args.repository,
        projectRoot,
        scenarioId: args.scenarioId,
      });
      resetContainer();
      await activateMethodology(server);
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'destroy_sandbox',
    'Destroy a sandbox project — closes all issues, deletes the project, removes config. Safety: refuses on non-sandbox projects.',
    DestroySandboxSchema,
    async (args) => handleErrors(async () => {
      const service = createSandboxService();
      const projectRoot = args.projectRoot ?? getProjectRoot();
      const result = await service.destroySandbox(projectRoot);
      resetContainer();
      return toCallToolResult(result);
    }),
  );

  server.tool(
    'reset_sandbox',
    'Reset a sandbox project — destroys the existing sandbox and creates a fresh one. Safety: refuses on non-sandbox projects.',
    ResetSandboxSchema,
    async (args) => handleErrors(async () => {
      const service = createSandboxService();
      const projectRoot = args.projectRoot ?? getProjectRoot();

      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const configPath = path.join(projectRoot, '.ido4', 'project-info.json');
      const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      const repository = (configData.project as { repository: string }).repository;

      const result = await service.resetSandbox({
        repository,
        projectRoot,
        scenarioId: args.scenarioId,
      });
      resetContainer();
      await activateMethodology(server);
      return toCallToolResult(result);
    }),
  );
}
