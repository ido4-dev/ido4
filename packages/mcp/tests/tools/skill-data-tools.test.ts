/**
 * Skill data tool registration tests — verifies tools are registered
 * and pass parameters correctly to aggregators.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasRegisteredTool } from '../helpers/test-utils.js';

const {
  mockAggregateStandup,
  mockAggregateBoard,
  mockAggregateCompliance,
  mockAggregateHealth,
  mockGetContainer,
} = vi.hoisted(() => ({
  mockAggregateStandup: vi.fn(),
  mockAggregateBoard: vi.fn(),
  mockAggregateCompliance: vi.fn(),
  mockAggregateHealth: vi.fn(),
  mockGetContainer: vi.fn(),
}));

vi.mock('../../src/aggregators/standup-aggregator.js', () => ({
  aggregateStandupData: mockAggregateStandup,
}));
vi.mock('../../src/aggregators/board-aggregator.js', () => ({
  aggregateBoardData: mockAggregateBoard,
}));
vi.mock('../../src/aggregators/compliance-aggregator.js', () => ({
  aggregateComplianceData: mockAggregateCompliance,
}));
vi.mock('../../src/aggregators/health-aggregator.js', () => ({
  aggregateHealthData: mockAggregateHealth,
}));

const mockContainer = {};
vi.mock('../../src/helpers/container-init.js', () => ({
  getContainer: mockGetContainer,
  resetContainer: vi.fn(),
}));

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSkillDataTools } from '../../src/tools/skill-data-tools.js';
import { callTool } from '../helpers/test-utils.js';

describe('Skill Data Tools', () => {
  let server: McpServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerSkillDataTools(server);
    mockGetContainer.mockResolvedValue(mockContainer);
  });

  it('registers all 4 skill data tools', () => {
    expect(hasRegisteredTool(server, 'get_standup_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_board_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_compliance_data')).toBe(true);
    expect(hasRegisteredTool(server, 'get_health_data')).toBe(true);
  });

  it('get_standup_data passes parameters to aggregator', async () => {
    mockAggregateStandup.mockResolvedValue({ summary: 'test' });

    const result = await callTool(server, 'get_standup_data', {
      waveName: 'wave-002',
      auditHoursBack: 48,
    }) as { content: Array<{ text: string }> };

    expect(mockAggregateStandup).toHaveBeenCalledWith(mockContainer, {
      containerName: 'wave-002',
      auditHoursBack: 48,
    });
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.summary).toBe('test');
  });

  it('get_board_data passes parameters to aggregator', async () => {
    mockAggregateBoard.mockResolvedValue({ summary: 'board' });

    await callTool(server, 'get_board_data', { waveName: 'wave-001' });

    expect(mockAggregateBoard).toHaveBeenCalledWith(mockContainer, {
      containerName: 'wave-001',
    });
  });

  it('get_compliance_data passes parameters to aggregator', async () => {
    mockAggregateCompliance.mockResolvedValue({ summary: 'compliance' });

    await callTool(server, 'get_compliance_data', {
      since: '2026-03-01T00:00:00Z',
      until: '2026-03-07T00:00:00Z',
      actorId: 'agent-beta',
      waveName: 'wave-001',
    });

    expect(mockAggregateCompliance).toHaveBeenCalledWith(mockContainer, {
      since: '2026-03-01T00:00:00Z',
      until: '2026-03-07T00:00:00Z',
      actorId: 'agent-beta',
      containerName: 'wave-001',
    });
  });

  it('get_health_data passes parameters to aggregator', async () => {
    mockAggregateHealth.mockResolvedValue({ summary: 'health' });

    await callTool(server, 'get_health_data', { waveName: 'wave-003' });

    expect(mockAggregateHealth).toHaveBeenCalledWith(mockContainer, {
      containerName: 'wave-003',
    });
  });
});
