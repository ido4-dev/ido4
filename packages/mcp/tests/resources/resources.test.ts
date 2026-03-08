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
import { registerResources, PRINCIPLES, WORKFLOW } from '../../src/resources/index.js';

describe('Resources', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerResources(server);
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

    it('project-status lists waves', async () => {
      const waves = [{ name: 'Wave 1', taskCount: 3 }];
      mockContainerService.listContainers.mockResolvedValue(waves);

      const result = await readResource(server, 'ido4://project/status') as {
        contents: Array<{ text: string }>;
      };

      const parsed = JSON.parse(result.contents[0]!.text);
      expect(parsed.waves).toHaveLength(1);
      expect(parsed.waves[0].name).toBe('Wave 1');
    });

    it('all static resources are registered', () => {
      expect(hasRegisteredResource(server, 'ido4://methodology/principles')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://methodology/workflow')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://methodology/statuses')).toBe(true);
      expect(hasRegisteredResource(server, 'ido4://project/status')).toBe(true);
    });
  });

  describe('dynamic resources', () => {
    it('wave-status template is registered', () => {
      expect(hasRegisteredResourceTemplate(server, 'wave-status')).toBe(true);
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

  describe('exported constants', () => {
    it('PRINCIPLES has 5 entries', () => {
      expect(PRINCIPLES.principles).toHaveLength(5);
    });

    it('WORKFLOW has transition types', () => {
      expect(WORKFLOW.transitionTypes).toContain('start');
      expect(WORKFLOW.transitionTypes).toContain('approve');
      expect(WORKFLOW.transitionTypes).toContain('block');
    });

    it('each principle has name, description, and enforcement', () => {
      for (const p of PRINCIPLES.principles) {
        expect(p.name).toBeDefined();
        expect(p.description).toBeDefined();
        expect(p.enforcement).toBeDefined();
      }
    });
  });
});
