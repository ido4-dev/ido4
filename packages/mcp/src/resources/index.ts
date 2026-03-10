/**
 * MCP resource registrations — profile-driven methodology data and dynamic project status.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getContainer } from '../helpers/index.js';

/**
 * Build the PRINCIPLES object from profile data.
 * For Hydro, this produces the same structure as the old hardcoded constant.
 */
function buildPrinciples(profile: MethodologyProfile) {
  return {
    principles: profile.principles.map((p) => ({
      name: p.name,
      description: p.description,
      enforcement: p.enforcement
        ? `BRE ${p.enforcement.type}: ${p.enforcement.ref}`
        : 'Not directly enforced by BRE',
    })),
  };
}

/**
 * Build the WORKFLOW object from profile data.
 * For Hydro, this produces the same structure as the old hardcoded constant.
 */
function buildWorkflow(profile: MethodologyProfile) {
  const statuses = profile.states.map((s) => s.name);

  // Build transitions map (deduplicate actions, pick first from/to)
  const transitions: Record<string, { from: string; to: string }> = {};
  const stateNameMap = new Map(profile.states.map((s) => [s.key, s.name]));
  const resolveStateName = (key: string): string => stateNameMap.get(key) ?? key;

  for (const t of profile.transitions) {
    if (!transitions[t.action]) {
      const fromNames = t.from.length > 1 ? 'any' : resolveStateName(t.from[0]!);
      const toName = t.backward ? 'previous status' : resolveStateName(t.to);
      transitions[t.action] = { from: fromNames, to: toName };
    }
  }

  const transitionTypes = [...new Set(profile.transitions.map((t) => t.action))];

  return { statuses, transitions, transitionTypes };
}

export function registerResources(server: McpServer, profile: MethodologyProfile): void {
  const principles = buildPrinciples(profile);
  const workflow = buildWorkflow(profile);

  // Static: methodology principles
  server.resource(
    'methodology-principles',
    'ido4://methodology/principles',
    { description: `The ${profile.principles.length} Governance Principles`, mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify(principles, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  // Static: workflow definition
  server.resource(
    'methodology-workflow',
    'ido4://methodology/workflow',
    { description: 'Workflow states and valid transitions', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify(workflow, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  // Static: status definitions (loaded from container)
  server.resource(
    'methodology-statuses',
    'ido4://methodology/statuses',
    { description: 'All workflow status definitions with IDs', mimeType: 'application/json' },
    async (uri) => {
      const container = await getContainer();
      const statuses = container.workflowConfig.getAllStatusValues();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ statuses }, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );

  // Static: methodology profile
  server.resource(
    'methodology-profile',
    'ido4://methodology/profile',
    { description: 'Complete methodology profile configuration', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify(profile, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  // Static: work item types
  server.resource(
    'methodology-work-item-types',
    'ido4://methodology/work-item-types',
    { description: 'Work item type definitions and hierarchy', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify(profile.workItems, null, 2),
        mimeType: 'application/json',
      }],
    }),
  );

  // Dynamic: container status templates (one per managed container type)
  for (const containerDef of profile.containers.filter((c) => c.managed)) {
    const label = containerDef.singular.toLowerCase();
    server.resource(
      `${containerDef.id}-status`,
      new ResourceTemplate(`ido4://${containerDef.id}/{${label}Name}/status`, { list: undefined }),
      { description: `Status and task breakdown for a specific ${label}`, mimeType: 'application/json' },
      async (uri, params) => {
        const container = await getContainer();
        const status = await container.containerService.getContainerStatus(params[`${label}Name`] as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(status, null, 2),
            mimeType: 'application/json',
          }],
        };
      },
    );
  }

  // Dynamic: audit recent events (fast path for /standup)
  server.resource(
    'audit-recent',
    'ido4://audit/recent',
    { description: 'Last 20 governance events from the audit trail', mimeType: 'application/json' },
    async (uri) => {
      const container = await getContainer();
      const events = await container.auditService.getRecentEvents(20);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ events }, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );

  // Dynamic: container analytics templates (one per execution container with completionRule)
  for (const containerDef of profile.containers.filter((c) => c.managed && c.completionRule && c.completionRule !== 'none')) {
    const label = containerDef.singular.toLowerCase();
    server.resource(
      `analytics-${containerDef.id}`,
      new ResourceTemplate(`ido4://analytics/${containerDef.id}/{${label}Name}`, { list: undefined }),
      { description: `Analytics for a specific ${label} (velocity, cycle time, throughput)`, mimeType: 'application/json' },
      async (uri, params) => {
        const container = await getContainer();
        const analytics = await container.analyticsService.getContainerAnalytics(params[`${label}Name`] as string);
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(analytics, null, 2),
            mimeType: 'application/json',
          }],
        };
      },
    );
  }

  // Dynamic: project status (list containers)
  server.resource(
    'project-status',
    'ido4://project/status',
    { description: 'Current project overview with all containers', mimeType: 'application/json' },
    async (uri) => {
      const container = await getContainer();
      const containers = await container.containerService.listContainers();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ containers }, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );

  // Dynamic: recent governance events (structured, poll-friendly)
  server.resource(
    'events-recent',
    'ido4://events/recent',
    { description: 'Recent governance events — task transitions, recommendations, handoffs. Poll-friendly for multi-agent coordination.', mimeType: 'application/json' },
    async (uri) => {
      const container = await getContainer();
      const events = await container.auditService.getRecentEvents(50);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ events, count: events.length }, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );

  // Dynamic: multi-agent coordination snapshot
  server.resource(
    'agents-coordination',
    'ido4://agents/coordination',
    { description: 'Multi-agent coordination state — who is working on what, active locks, recent handoffs, agent health.', mimeType: 'application/json' },
    async (uri) => {
      const container = await getContainer();
      const { aggregateCoordinationData } = await import('../aggregators/coordination-aggregator.js');
      const data = await aggregateCoordinationData(container);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(data, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );
}

// Export for testing — now generated from profile
export { buildPrinciples as PRINCIPLES_BUILDER, buildWorkflow as WORKFLOW_BUILDER };
