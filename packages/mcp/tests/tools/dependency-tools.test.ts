import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTool } from '../helpers/test-utils.js';

const mockDependencyService = {
  analyzeDependencies: vi.fn(),
  validateDependencies: vi.fn(),
};

const mockContainer = { dependencyService: mockDependencyService };

const { mockGetContainer } = vi.hoisted(() => ({
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDependencyTools } from '../../src/tools/dependency-tools.js';

describe('Dependency Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContainer.mockResolvedValue(mockContainer);
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerDependencyTools(server);
  });

  it('analyze_dependencies returns dependency tree', async () => {
    const analysisResult = {
      issueNumber: 42,
      dependencies: [{ issueNumber: 10, title: 'Dep task', status: 'Done', satisfied: true, children: [] }],
      circularDependencies: [],
      maxDepth: 1,
    };
    mockDependencyService.analyzeDependencies.mockResolvedValue(analysisResult);

    const result = await callTool(server, 'analyze_dependencies', { issueNumber: 42 }) as { content: Array<{ text: string }> };
    expect(mockDependencyService.analyzeDependencies).toHaveBeenCalledWith(42);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.issueNumber).toBe(42);
    expect(parsed.data.dependencies).toHaveLength(1);
  });

  it('validate_dependencies returns validation result', async () => {
    const validationResult = { valid: true, unsatisfied: [], circular: [] };
    mockDependencyService.validateDependencies.mockResolvedValue(validationResult);

    const result = await callTool(server, 'validate_dependencies', { issueNumber: 42 }) as { content: Array<{ text: string }> };
    expect(mockDependencyService.validateDependencies).toHaveBeenCalledWith(42);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.data.valid).toBe(true);
  });

  it('handles errors from dependency service', async () => {
    const { NotFoundError } = await import('@ido4/core');
    mockDependencyService.analyzeDependencies.mockRejectedValue(
      new NotFoundError({ message: 'Issue not found', resource: 'issue', identifier: 999 }),
    );

    const result = await callTool(server, 'analyze_dependencies', { issueNumber: 999 }) as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.code).toBe('NOT_FOUND');
  });
});
