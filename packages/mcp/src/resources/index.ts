/**
 * MCP resource registrations — methodology reference data and dynamic project/wave status.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getContainer } from '../helpers/index.js';

const PRINCIPLES = {
  principles: [
    {
      name: 'Epic Integrity',
      description: 'All tasks within an epic MUST be assigned to the same wave.',
      enforcement: 'BRE validation step on wave assignment and task transitions.',
    },
    {
      name: 'Active Wave Singularity',
      description: 'Only one wave can be active at a time.',
      enforcement: 'Wave service validates on wave creation and activation.',
    },
    {
      name: 'Dependency Coherence',
      description: "A task's wave must be numerically higher than all its dependency tasks' waves.",
      enforcement: 'BRE dependency validation step.',
    },
    {
      name: 'Self-Contained Execution',
      description: 'Each wave contains all dependencies needed for its completion.',
      enforcement: 'Wave completion validation checks all dependencies within the wave.',
    },
    {
      name: 'Atomic Completion',
      description: 'A wave is complete only when ALL its tasks are in "Done".',
      enforcement: 'Wave completion validation.',
    },
  ],
};

const WORKFLOW = {
  statuses: ['Backlog', 'In Refinement', 'Ready for Dev', 'In Progress', 'In Review', 'Blocked', 'Done'],
  transitions: {
    refine: { from: 'Backlog', to: 'In Refinement' },
    ready: { from: 'In Refinement', to: 'Ready for Dev' },
    start: { from: 'Ready for Dev', to: 'In Progress' },
    review: { from: 'In Progress', to: 'In Review' },
    approve: { from: 'In Review', to: 'Done' },
    block: { from: 'any', to: 'Blocked' },
    unblock: { from: 'Blocked', to: 'Ready for Dev' },
    return: { from: 'any', to: 'previous status' },
  },
  transitionTypes: ['refine', 'ready', 'start', 'review', 'approve', 'block', 'unblock', 'return'],
};

export function registerResources(server: McpServer): void {
  // Static: methodology principles
  server.resource(
    'methodology-principles',
    'ido4://methodology/principles',
    { description: 'The 5 Unbreakable Principles of ido4 governance', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify(PRINCIPLES, null, 2),
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
        text: JSON.stringify(WORKFLOW, null, 2),
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

  // Dynamic: wave status
  server.resource(
    'wave-status',
    new ResourceTemplate('ido4://wave/{waveName}/status', { list: undefined }),
    { description: 'Status and task breakdown for a specific wave', mimeType: 'application/json' },
    async (uri, params) => {
      const container = await getContainer();
      const status = await container.waveService.getWaveStatus(params.waveName as string);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(status, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );

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

  // Dynamic: wave analytics
  server.resource(
    'analytics-wave',
    new ResourceTemplate('ido4://analytics/wave/{waveName}', { list: undefined }),
    { description: 'Analytics for a specific wave (velocity, cycle time, throughput)', mimeType: 'application/json' },
    async (uri, params) => {
      const container = await getContainer();
      const analytics = await container.analyticsService.getWaveAnalytics(params.waveName as string);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(analytics, null, 2),
          mimeType: 'application/json',
        }],
      };
    },
  );

  // Dynamic: project status (list waves)
  server.resource(
    'project-status',
    'ido4://project/status',
    { description: 'Current project overview with all waves', mimeType: 'application/json' },
    async (uri) => {
      const container = await getContainer();
      const waves = await container.waveService.listWaves();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ waves }, null, 2),
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

// Export for testing
export { PRINCIPLES, WORKFLOW };
