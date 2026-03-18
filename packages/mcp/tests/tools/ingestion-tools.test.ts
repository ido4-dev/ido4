/**
 * Ingestion MCP tool tests — verifies tool registration and delegation to IngestionService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool, hasRegisteredTool } from '../helpers/test-utils.js';

const mockIngestSpec = vi.fn();

vi.mock('@ido4/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ido4/core')>();
  return {
    ...actual,
    IngestionService: vi.fn().mockImplementation(() => ({
      ingestSpec: mockIngestSpec,
    })),
  };
});

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerIngestionTools } from '../../src/tools/ingestion-tools.js';

describe('Ingestion Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.1.0' });

    mockGetContainer.mockResolvedValue({
      taskService: {},
      issueRepository: {},
      projectRepository: {},
      profile: { id: 'hydro', semantics: { initialState: 'BACKLOG' }, containers: [] },
      logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    });

    registerIngestionTools(server);
  });

  it('registers ingest_spec tool', () => {
    expect(hasRegisteredTool(server, 'ingest_spec')).toBe(true);
  });

  it('calls IngestionService.ingestSpec with correct args', async () => {
    mockIngestSpec.mockResolvedValue({
      success: true,
      parsed: { projectName: 'Test', groupCount: 1, taskCount: 2, parseErrors: [] },
      created: { groupIssues: [], tasks: [], subIssueRelationships: 0, totalIssues: 0 },
      failed: [],
      warnings: [],
      suggestions: [],
    });

    await callTool(server, 'ingest_spec', {
      specContent: '# Test\n\n> Desc.\n',
      dryRun: true,
    });

    expect(mockIngestSpec).toHaveBeenCalledTimes(1);
    const callArgs = mockIngestSpec.mock.calls[0]![0]!;
    expect(callArgs.specContent).toBe('# Test\n\n> Desc.\n');
    expect(callArgs.dryRun).toBe(true);
  });

  it('returns error result on service failure', async () => {
    mockIngestSpec.mockRejectedValue(new Error('Parse failed'));

    const result = await callTool(server, 'ingest_spec', {
      specContent: 'invalid',
      dryRun: false,
    }) as { content: Array<{ text: string }> };

    expect(result.content[0]!.text).toContain('Parse failed');
  });

  it('defaults dryRun to false', async () => {
    mockIngestSpec.mockResolvedValue({
      success: true,
      parsed: { projectName: 'Test', groupCount: 0, taskCount: 0, parseErrors: [] },
      created: { groupIssues: [], tasks: [], subIssueRelationships: 0, totalIssues: 0 },
      failed: [],
      warnings: [],
      suggestions: [],
    });

    await callTool(server, 'ingest_spec', {
      specContent: '# Test\n> Desc.\n',
    });

    const callArgs = mockIngestSpec.mock.calls[0]![0]!;
    expect(callArgs.dryRun).toBe(false);
  });
});
