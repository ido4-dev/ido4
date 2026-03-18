/**
 * Sandbox MCP tool tests — verifies tools call SandboxService correctly
 * and reset the container after each operation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

// Mock @ido4/core modules
const mockCreateSandbox = vi.fn();
const mockDestroySandbox = vi.fn();
const mockResetSandbox = vi.fn();

vi.mock('@ido4/core', () => ({
  ConsoleLogger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
  CredentialManager: vi.fn(),
  GitHubGraphQLClient: vi.fn(),
  SandboxService: vi.fn().mockImplementation(() => ({
    createSandbox: mockCreateSandbox,
    destroySandbox: mockDestroySandbox,
    resetSandbox: mockResetSandbox,
  })),
}));

const { mockResetContainer } = vi.hoisted(() => ({
  mockResetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: vi.fn(),
  resetContainer: mockResetContainer,
}));

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSandboxTools } from '../../src/tools/sandbox-tools.js';

describe('Sandbox Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerSandboxTools(server);
  });

  describe('create_sandbox', () => {
    it('calls SandboxService.createSandbox with correct args', async () => {
      const createResult = {
        success: true,
        project: { id: 'PVT_1', number: 1, title: 'Sandbox', url: 'https://example.com', repository: 'owner/repo' },
        scenario: 'hydro-governance',
        created: { parentIssues: 5, containerInstances: 4, tasks: 20, subIssueRelationships: 20, closedTasks: 8, pullRequests: 1, contextComments: 5, auditEvents: 28, registeredAgents: 2 },
        configPath: '/test/.ido4/project-info.json',
      };
      mockCreateSandbox.mockResolvedValue(createResult);

      const result = await callTool(server, 'create_sandbox', {
        repository: 'owner/repo',
      }) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
      expect(parsed.created.tasks).toBe(20);
      expect(mockCreateSandbox).toHaveBeenCalledWith(
        expect.objectContaining({ repository: 'owner/repo' }),
      );
    });

    it('resets container after creation', async () => {
      mockCreateSandbox.mockResolvedValue({ success: true });

      await callTool(server, 'create_sandbox', { repository: 'owner/repo' });
      expect(mockResetContainer).toHaveBeenCalled();
    });

    it('passes scenarioId when provided', async () => {
      mockCreateSandbox.mockResolvedValue({ success: true });

      await callTool(server, 'create_sandbox', {
        repository: 'owner/repo',
        scenarioId: 'custom',
      });

      expect(mockCreateSandbox).toHaveBeenCalledWith(
        expect.objectContaining({ scenarioId: 'custom' }),
      );
    });
  });

  describe('destroy_sandbox', () => {
    it('calls SandboxService.destroySandbox', async () => {
      const destroyResult = {
        success: true,
        projectId: 'PVT_1',
        issuesClosed: 10,
        projectDeleted: true,
        configRemoved: true,
      };
      mockDestroySandbox.mockResolvedValue(destroyResult);

      const result = await callTool(server, 'destroy_sandbox') as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.success).toBe(true);
      expect(parsed.projectDeleted).toBe(true);
      expect(mockDestroySandbox).toHaveBeenCalled();
    });

    it('resets container after destruction', async () => {
      mockDestroySandbox.mockResolvedValue({ success: true });

      await callTool(server, 'destroy_sandbox');
      expect(mockResetContainer).toHaveBeenCalled();
    });
  });

  describe('reset_sandbox', () => {
    it('reads repository from existing config and calls resetSandbox', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ project: { repository: 'owner/repo' }, sandbox: true }),
      );

      const resetResult = {
        destroyed: { success: true, projectId: 'PVT_1', issuesClosed: 5, projectDeleted: true, configRemoved: true },
        created: { success: true, project: { id: 'PVT_2' }, scenario: 'hydro-governance', created: { epics: 5, tasks: 20 } },
      };
      mockResetSandbox.mockResolvedValue(resetResult);

      const result = await callTool(server, 'reset_sandbox', {}) as { content: Array<{ text: string }> };

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.destroyed.success).toBe(true);
      expect(parsed.created.success).toBe(true);
    });

    it('resets container after reset', async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ project: { repository: 'owner/repo' }, sandbox: true }),
      );
      mockResetSandbox.mockResolvedValue({ destroyed: {}, created: {} });

      await callTool(server, 'reset_sandbox', {});
      expect(mockResetContainer).toHaveBeenCalled();
    });
  });
});
