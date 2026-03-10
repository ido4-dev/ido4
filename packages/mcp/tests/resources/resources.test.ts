import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readResource,
  readResourceTemplate,
  hasRegisteredResource,
  hasRegisteredResourceTemplate,
} from '../helpers/test-utils.js';

const mockContainerService = {
  listContainers: vi.fn(),
  getContainerStatus: vi.fn(),
};

const mockWorkflowConfig = {
  getAllStatusValues: vi.fn(),
};

const mockContainer = {
  containerService: mockContainerService,
  workflowConfig: mockWorkflowConfig,
};

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HYDRO_PROFILE } from '@ido4/core';
import { registerResources, PRINCIPLES_BUILDER, WORKFLOW_BUILDER } from '../../src/resources/index.js';

describe('Resources', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerResources(server, HYDRO_PROFILE);
  });

  describe('static resources', () => {
    it('methodology-principles returns 5 principles', async () => {
      const result = await readResource(server, 'ido4://methodology/principles') as {
        contents: Array<{ text: string; mimeType: string }>;
      };

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0]!.mimeType).toBe('application/json');

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.principles).toHaveLength(5);
      expect(parsed.principles[0].name).toBe('Epic Integrity');
    });

    it('methodology-workflow returns transitions', async () => {
      const result = await readResource(server, 'ido4://methodology/workflow') as {
        contents: Array<{ text: string }>;
      };

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.statuses).toContain('Backlog');
      expect(parsed.statuses).toContain('Done');
      expect(parsed.transitions.start.from).toBe('Ready for Dev');
    });

    it('methodology-statuses loads from container', async () => {
      mockWorkflowConfig.getAllStatusValues.mockReturnValue({
        BACKLOG: 'Backlog',
        DONE: 'Done',
      });

      const result = await readResource(server, 'ido4://methodology/statuses') as {
        contents: Array<{ text: string }>;
      };

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.statuses.BACKLOG).toBe('Backlog');
      expect(parsed.statuses.DONE).toBe('Done');
    });

    it('methodology-profile returns complete profile', async () => {
      const result = await readResource(server, 'ido4://methodology/profile') as {
        contents: Array<{ text: string }>;
      };

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.id).toBe('hydro');
      expect(parsed.states).toHaveLength(7);
    });

    it('methodology-work-item-types returns work item definitions', async () => {
      const result = await readResource(server, 'ido4://methodology/work-item-types') as {
        contents: Array<{ text: string }>;
      };

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.primary.singular).toBe('Task');
      expect(parsed.types).toHaveLength(5);
    });

    it('project-status lists containers', async () => {
      const containers = [{ name: 'Wave 1', taskCount: 3 }];
      mockContainerService.listContainers.mockResolvedValue(containers);

      const result = await readResource(server, 'ido4://project/status') as {
        contents: Array<{ text: string }>;
      };

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.containers).toHaveLength(1);
      expect(parsed.containers[0].name).toBe('Wave 1');
    });

    it('all static resources are registered', () => {
      expect(hasRegisteredResource(server, 'ido4://methodology/principles')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://methodology/workflow')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://methodology/statuses')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://methodology/profile')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://methodology/work-item-types')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://project/status')).toBe(true);
    });
  });

  describe('dynamic resources', () => {
    it('wave-status template is registered', () => {
      expect(hasRegisteredResourceTemplate(server, 'wave-status')).toBe(true);
    });

    it('epic-status template is registered for Hydro', () => {
      expect(hasRegisteredResourceTemplate(server, 'epic-status')).toBe(true);
    });

    it('analytics-wave template is registered', () => {
      expect(hasRegisteredResourceTemplate(server, 'analytics-wave')).toBe(true);
    });

    it('wave-status fetches wave data', async () => {
      const status = { name: 'Wave 1', tasks: [], metrics: { total: 5 } };
      mockContainerService.getContainerStatus.mockResolvedValue(status);

      const result = await readResourceTemplate(
        server,
        'wave-status',
        'ido4://wave/Wave%201/status',
        { waveName: 'Wave 1' },
      ) as { contents: Array<{ text: string }> };

      expect(mockContainerService.getContainerStatus).toHaveBeenCalledWith('Wave 1');
      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.name).toBe('Wave 1');
    });
  });

  describe('profile-driven generation', () => {
    it('PRINCIPLES_BUILDER produces 5 principles for Hydro', () => {
      const principles = PRINCIPLES_BUILDER(HYDRO_PROFILE);
      expect(principles.principles).toHaveLength(5);
      expect(principles.principles[0]!.name).toBe('Epic Integrity');
    });

    it('WORKFLOW_BUILDER produces correct transitions for Hydro', () => {
      const workflow = WORKFLOW_BUILDER(HYDRO_PROFILE);
      expect(workflow.transitionTypes).toContain('start');
      expect(workflow.transitionTypes).toContain('approve');
      expect(workflow.transitionTypes).toContain('block');
      expect(workflow.statuses).toContain('Backlog');
      expect(workflow.statuses).toContain('Done');
    });

    it('each principle has name, description, and enforcement', () => {
      const principles = PRINCIPLES_BUILDER(HYDRO_PROFILE);
      for (const p of principles.principles) {
        expect(p.name).toBeDefined();
        expect(p.description).toBeDefined();
        expect(p.enforcement).toBeDefined();
      }
    });
  });
});
