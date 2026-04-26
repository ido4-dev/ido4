/**
 * Sandbox tool registrations — 5 MCP tools for sandbox lifecycle management.
 *
 * Sandbox tools bootstrap standalone (like init_project) — they create their own
 * GraphQL client and SandboxService, then reset the shared container after completion
 * so subsequent tool calls pick up the new/removed config.
 *
 * Phase 5 OBS-09 added two orphan-cleanup tools (list_orphan_sandboxes,
 * delete_orphan_sandbox) for the case where a user deletes a sandbox repo via
 * `gh repo delete` without running destroy_sandbox first — Project V2 doesn't
 * cascade-delete with the repo, so it lives on the user's account orphaned.
 */

import { z } from 'zod';
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

  // ─── Phase 5 OBS-09: Orphan Sandbox Cleanup ───
  //
  // GitHub Projects V2 don't cascade-delete with the repository. When a user
  // runs `gh repo delete` on a sandbox without calling destroy_sandbox first,
  // the linked Project V2 outlives the repo and accumulates on the user's
  // account. These tools surface and clean up those orphans.

  server.tool(
    'list_orphan_sandboxes',
    'Phase 5 OBS-09: List ido4 Sandbox-titled Project V2 projects on the viewer\'s account, identifying orphans whose linked GitHub repository no longer exists. Read-only; no mutations. Use the result to decide which projects to clean up via delete_orphan_sandbox.',
    {},
    async () => handleErrors(async () => {
      const service = createSandboxService();
      const result = await service.listOrphanSandboxes();
      return toCallToolResult({ success: true, data: result });
    }),
  );

  server.tool(
    'delete_orphan_sandbox',
    'Phase 5 OBS-09: Delete one orphan sandbox Project V2 by ID. Gated by a sandbox-title safety check (project title must contain "Sandbox") to defend against accidentally deleting a non-sandbox project. Caller is expected to confirm with the user before invoking — deletion is irreversible.',
    {
      projectId: z.string().describe('The Project V2 node ID to delete (e.g., "PVT_xxx"). Get from list_orphan_sandboxes.'),
    },
    async (args) => handleErrors(async () => {
      const service = createSandboxService();
      const result = await service.deleteOrphanSandbox(args.projectId);
      return toCallToolResult({ success: true, data: result });
    }),
  );
}
