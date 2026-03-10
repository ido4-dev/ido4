/**
 * Project initialization tool — bootstraps ido4 governance for a GitHub repository.
 *
 * Unlike other tools, this one does NOT use getContainer() because the config
 * files that ServiceContainer needs don't exist yet. Instead it creates its own
 * standalone GraphQL client for the initialization workflow.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';
import { InitProjectSchema } from '../schemas/index.js';
import { handleErrors, toCallToolResult, getContainer, resetContainer } from '../helpers/index.js';
import {
  ConsoleLogger,
  CredentialManager,
  GitHubGraphQLClient,
  ProjectInitService,
} from '@ido4/core';

export function registerProjectTools(server: McpServer, _profile: MethodologyProfile): void {
  server.tool(
    'init_project',
    'Initialize ido4 governance for a GitHub repository — creates project, custom fields, and .ido4/ config files',
    InitProjectSchema,
    async (args) => handleErrors(async () => {
      // Bootstrap standalone client — cannot use getContainer() because config doesn't exist yet
      const logger = new ConsoleLogger({ component: 'init-project' });
      const credentialManager = new CredentialManager(logger);
      const graphqlClient = new GitHubGraphQLClient(credentialManager, logger);
      const initService = new ProjectInitService(graphqlClient, logger);

      const projectRoot = process.env.IDO4_PROJECT_ROOT ?? process.cwd();
      const result = await initService.initializeProject({
        mode: args.mode,
        repository: args.repository,
        projectName: args.projectName,
        projectId: args.projectId,
        projectRoot,
      });

      // Reset container so subsequent tool calls pick up the new config
      resetContainer();

      return toCallToolResult(result);
    }),
  );

  server.tool(
    'get_project_status',
    'Get a dashboard overview of the entire project: wave summaries, task distribution by status, blocked count, and completion metrics.',
    {},
    async () => handleErrors(async () => {
      const container = await getContainer();

      const [waves, taskResult] = await Promise.all([
        container.containerService.listContainers(),
        container.taskService.listTasks({}),
      ]);

      const tasks = taskResult.data.tasks;
      const statusDistribution: Record<string, number> = {};
      let blockedCount = 0;

      for (const task of tasks) {
        const status = task.status ?? 'Unknown';
        statusDistribution[status] = (statusDistribution[status] ?? 0) + 1;
        if (container.workflowConfig.isBlockedStatus(status)) blockedCount++;
      }

      // Derive primary execution container from profile
      const execContainer = container.profile.containers.find(
        (c) => c.managed && c.completionRule && c.completionRule !== 'none',
      ) ?? container.profile.containers[0]!;
      const execContainerId = execContainer.id;

      const activeWaves = waves.filter((w) => w.status === 'active');
      const completedTasks = tasks.filter((t) => container.workflowConfig.isTerminalStatus(t.status) || t.closed).length;
      const unassignedTasks = tasks.filter((t) => !t.containers[execContainerId]).length;

      return toCallToolResult({
        success: true,
        data: {
          waves,
          activeWave: activeWaves[0]?.name ?? null,
          projectMetrics: {
            totalTasks: tasks.length,
            completedTasks,
            blockedCount,
            unassignedTasks,
            activeWaveCount: activeWaves.length,
            completionPercentage: tasks.length > 0
              ? Math.round((completedTasks / tasks.length) * 100)
              : 0,
            statusDistribution,
          },
        },
      });
    }),
  );
}
