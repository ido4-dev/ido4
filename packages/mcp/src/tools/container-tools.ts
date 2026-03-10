/**
 * Dynamic container tool generation — creates MCP tools from profile.containers.
 *
 * For each managed container type, generates:
 * - list_{id}s — list all containers of this type
 * - get_{id}_status — get detailed status of a specific container
 * - assign_task_to_{id} — assign a task to a container (enforces integrity)
 * - create_{id} — create a new container (only if namePattern defined)
 * - validate_{id}_completion — check if a container can complete (only if completionRule !== 'none')
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';
import { z } from 'zod';
import { handleErrors, toCallToolResult, getContainer } from '../helpers/index.js';

export function registerContainerTools(server: McpServer, profile: MethodologyProfile): void {
  for (const containerDef of profile.containers.filter((c) => c.managed)) {
    const { id, singular, plural } = containerDef;
    const label = singular.toLowerCase();

    // Find integrity rules that enforce on assignment to this container
    const integrityRuleDescs = profile.integrityRules
      .filter((r) => (r.type === 'same-container' && r.mustMatch === id) || (r.type === 'ordering' && r.containerType === id))
      .map((r) => r.description);
    const integrityNote = integrityRuleDescs.length > 0
      ? ` — enforces ${integrityRuleDescs.join('; ')}`
      : '';

    // list_{id}s
    server.tool(
      `list_${id}s`,
      `List all ${plural.toLowerCase()} in the project with task counts and completion percentages`,
      {},
      async () => handleErrors(async () => {
        const container = await getContainer();
        const containers = await container.containerService.listContainers();
        return toCallToolResult({ success: true, data: containers });
      }),
    );

    // get_{id}_status
    server.tool(
      `get_${id}_status`,
      `Get detailed status of a specific ${label} including task breakdown and metrics`,
      { [`${label}Name`]: z.string().describe(`Name of the ${label}`) },
      async (args) => handleErrors(async () => {
        const container = await getContainer();
        const nameParam = args[`${label}Name`] as string;
        const status = await container.containerService.getContainerStatus(nameParam);
        return toCallToolResult({ success: true, data: status });
      }),
    );

    // assign_task_to_{id}
    server.tool(
      `assign_task_to_${id}`,
      `Assign a task to a ${label}${integrityNote}`,
      {
        issueNumber: z.number().int().positive().describe('GitHub issue number'),
        [`${label}Name`]: z.string().describe(`${singular} to assign the task to`),
      },
      async (args) => handleErrors(async () => {
        const container = await getContainer();
        const nameParam = args[`${label}Name`] as string;
        const result = await container.containerService.assignTaskToContainer(
          args.issueNumber as number,
          nameParam,
        );
        return toCallToolResult(result);
      }),
    );

    // create_{id} — only if namePattern is defined (container supports creation)
    if (containerDef.namePattern) {
      server.tool(
        `create_${id}`,
        `Create a new ${label} for grouping ${profile.workItems.primary.plural.toLowerCase()}`,
        {
          name: z.string().describe(`${singular} name (e.g., "${containerDef.nameExample ?? `${singular} 1`}")`),
          description: z.string().optional().describe(`${singular} description`),
        },
        async (args) => handleErrors(async () => {
          const container = await getContainer();
          const result = await container.containerService.createContainer(args.name, args.description);
          return toCallToolResult(result);
        }),
      );
    }

    // validate_{id}_completion — only if completionRule is not 'none'
    if (containerDef.completionRule && containerDef.completionRule !== 'none') {
      server.tool(
        `validate_${id}_completion`,
        `Check if a ${label} can be completed — validates all ${profile.workItems.primary.plural.toLowerCase()} are in terminal state`,
        { [`${label}Name`]: z.string().describe(`Name of the ${label}`) },
        async (args) => handleErrors(async () => {
          const container = await getContainer();
          const nameParam = args[`${label}Name`] as string;
          const result = await container.containerService.validateContainerCompletion(nameParam);
          return toCallToolResult(result);
        }),
      );
    }
  }
}
