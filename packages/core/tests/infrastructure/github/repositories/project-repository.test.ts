import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubProjectRepository } from '../../../../src/infrastructure/github/repositories/project-repository.js';
import { TestLogger } from '../../../helpers/test-logger.js';
import { createMockProjectConfig } from '../../../helpers/mock-factories.js';
import { createMockGraphQLClient, buildProjectItemsResponse } from '../helpers/graphql-mock.js';
import type { MockGraphQLClient } from '../helpers/graphql-mock.js';

describe('GitHubProjectRepository', () => {
  let client: MockGraphQLClient;
  let repo: GitHubProjectRepository;
  let logger: TestLogger;

  beforeEach(() => {
    client = createMockGraphQLClient();
    logger = new TestLogger();
    const config = createMockProjectConfig({
      project: { id: 'PVT_test_project_001', number: 1, repository: 'test-org/test-repo' },
    });
    repo = new GitHubProjectRepository(client as unknown as any, config, logger);
  });

  describe('getProjectItems', () => {
    it('returns mapped ProjectItem array', async () => {
      client.queryAllPages.mockResolvedValueOnce([
        {
          id: 'PVTI_1',
          type: 'ISSUE',
          fieldValues: {
            nodes: [
              { field: { id: 'f1', name: 'Status' }, name: 'In Progress' },
              { field: { id: 'f2', name: 'Wave' }, text: 'wave-001-test' },
            ],
          },
          content: {
            id: 'I_1',
            number: 1,
            title: 'First Item',
            url: 'https://github.com/test/repo/issues/1',
            state: 'OPEN',
            body: 'Body text',
            assignees: { nodes: [] },
          },
        },
      ]);

      const items = await repo.getProjectItems();

      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe('PVTI_1');
      expect(items[0]!.content.number).toBe(1);
      expect(items[0]!.content.title).toBe('First Item');
      expect(items[0]!.fieldValues.Status).toBe('In Progress');
      expect(items[0]!.fieldValues.Wave).toBe('wave-001-test');
    });

    it('filters out items with null content', async () => {
      client.queryAllPages.mockResolvedValueOnce([
        {
          id: 'PVTI_1',
          type: 'ISSUE',
          fieldValues: { nodes: [] },
          content: { id: 'I_1', number: 1, title: 'Issue', url: '', state: 'OPEN', body: '', assignees: { nodes: [] } },
        },
        {
          id: 'PVTI_2',
          type: 'DRAFT_ISSUE',
          fieldValues: { nodes: [] },
          content: null,
        },
      ]);

      const items = await repo.getProjectItems();
      expect(items).toHaveLength(1);
    });

    it('uses queryAllPages for pagination', async () => {
      client.queryAllPages.mockResolvedValueOnce([]);

      await repo.getProjectItems();

      expect(client.queryAllPages).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ projectId: 'PVT_test_project_001' }),
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ pageSize: 100 }),
      );
    });

    it('returns empty array for empty project', async () => {
      client.queryAllPages.mockResolvedValueOnce([]);

      const items = await repo.getProjectItems();
      expect(items).toEqual([]);
    });
  });

  describe('updateItemField', () => {
    it('dispatches text mutation for text type', async () => {
      client.mutate.mockResolvedValueOnce({});

      await repo.updateItemField('PVTI_1', 'PVTF_wave', 'wave-002', 'text');

      expect(client.mutate).toHaveBeenCalledWith(
        expect.stringContaining('text'),
        expect.objectContaining({
          projectId: 'PVT_test_project_001',
          itemId: 'PVTI_1',
          fieldId: 'PVTF_wave',
          value: 'wave-002',
        }),
      );
    });

    it('dispatches select mutation for singleSelect type', async () => {
      client.mutate.mockResolvedValueOnce({});

      await repo.updateItemField('PVTI_1', 'PVTF_status', 'opt_progress', 'singleSelect');

      expect(client.mutate).toHaveBeenCalledWith(
        expect.stringContaining('singleSelectOptionId'),
        expect.objectContaining({
          value: 'opt_progress',
        }),
      );
    });
  });

  describe('getWaveStatus', () => {
    it('filters items by wave and computes metrics', async () => {
      client.queryAllPages.mockResolvedValueOnce([
        {
          id: 'PVTI_1', type: 'ISSUE',
          fieldValues: { nodes: [
            { field: { id: 'f1', name: 'Status' }, name: 'Done' },
            { field: { id: 'f2', name: 'Wave' }, text: 'wave-001-test' },
          ] },
          content: { id: 'I_1', number: 1, title: 'T1', url: '', state: 'OPEN', body: '', assignees: { nodes: [] } },
        },
        {
          id: 'PVTI_2', type: 'ISSUE',
          fieldValues: { nodes: [
            { field: { id: 'f1', name: 'Status' }, name: 'In Progress' },
            { field: { id: 'f2', name: 'Wave' }, text: 'wave-001-test' },
          ] },
          content: { id: 'I_2', number: 2, title: 'T2', url: '', state: 'OPEN', body: '', assignees: { nodes: [] } },
        },
        {
          id: 'PVTI_3', type: 'ISSUE',
          fieldValues: { nodes: [
            { field: { id: 'f1', name: 'Status' }, name: 'Blocked' },
            { field: { id: 'f2', name: 'Wave' }, text: 'wave-002-test' },
          ] },
          content: { id: 'I_3', number: 3, title: 'T3', url: '', state: 'OPEN', body: '', assignees: { nodes: [] } },
        },
      ]);

      const status = await repo.getWaveStatus('wave-001-test');

      expect(status.name).toBe('wave-001-test');
      expect(status.tasks).toHaveLength(2);
      expect(status.metrics.total).toBe(2);
      expect(status.metrics.completed).toBe(1);
      expect(status.metrics.inProgress).toBe(1);
      expect(status.metrics.blocked).toBe(0);
    });

    it('returns empty metrics for unknown wave', async () => {
      client.queryAllPages.mockResolvedValueOnce([]);

      const status = await repo.getWaveStatus('wave-999-nonexistent');
      expect(status.metrics.total).toBe(0);
      expect(status.tasks).toEqual([]);
    });
  });

  describe('getCurrentUser', () => {
    it('returns UserInfo', async () => {
      client.query.mockResolvedValueOnce({
        viewer: { login: 'testuser', id: 'U_123' },
      });

      const user = await repo.getCurrentUser();
      expect(user.login).toBe('testuser');
      expect(user.id).toBe('U_123');
    });
  });
});
