import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubEpicRepository } from '../../../../src/infrastructure/github/repositories/epic-repository.js';
import { NotFoundError } from '../../../../src/shared/errors/index.js';
import { TestLogger } from '../../../helpers/test-logger.js';
import { createMockProjectConfig } from '../../../helpers/mock-factories.js';
import { createMockGraphQLClient } from '../helpers/graphql-mock.js';
import type { MockGraphQLClient } from '../helpers/graphql-mock.js';

describe('GitHubEpicRepository', () => {
  let client: MockGraphQLClient;
  let repo: GitHubEpicRepository;
  let logger: TestLogger;

  beforeEach(() => {
    client = createMockGraphQLClient();
    logger = new TestLogger();
    const config = createMockProjectConfig({
      project: { id: 'PVT_test', number: 1, repository: 'test-org/test-repo' },
    });
    repo = new GitHubEpicRepository(client as unknown as any, config, logger);
  });

  describe('searchEpicIssues', () => {
    it('constructs correct search query', async () => {
      client.query.mockResolvedValueOnce({
        search: { nodes: [] },
      });

      await repo.searchEpicIssues('auth-system');

      expect(client.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: 'repo:test-org/test-repo is:issue "auth-system" in:title',
        }),
      );
    });

    it('returns EpicIssueData array', async () => {
      client.query.mockResolvedValueOnce({
        search: {
          nodes: [
            { number: 1, title: 'Epic: Auth System', url: 'https://github.com/test/repo/issues/1' },
            { number: 2, title: 'Epic: Auth System v2', url: 'https://github.com/test/repo/issues/2' },
          ],
        },
      });

      const results = await repo.searchEpicIssues('auth-system');
      expect(results).toHaveLength(2);
      expect(results[0]!.number).toBe(1);
      expect(results[0]!.title).toBe('Epic: Auth System');
    });

    it('returns empty array when no epics found', async () => {
      client.query.mockResolvedValueOnce({ search: { nodes: [] } });

      const results = await repo.searchEpicIssues('nonexistent');
      expect(results).toEqual([]);
    });

    it('filters out nodes without number or title', async () => {
      client.query.mockResolvedValueOnce({
        search: {
          nodes: [
            { number: 1, title: 'Valid' },
            { number: undefined, title: undefined }, // malformed node
          ],
        },
      });

      const results = await repo.searchEpicIssues('test');
      expect(results).toHaveLength(1);
    });
  });

  describe('getIssueWithTimeline', () => {
    it('maps all fields correctly', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: {
          issue: {
            id: 'I_1',
            number: 10,
            title: 'Epic Issue',
            body: 'Description',
            state: 'OPEN',
            url: 'https://github.com/test/repo/issues/10',
            timelineItems: {
              nodes: [
                { id: 'ev1', subject: { number: 11, title: 'Related Issue', state: 'OPEN' } },
              ],
            },
            subIssues: {
              nodes: [
                { number: 12, title: 'Sub-task', state: 'CLOSED', url: 'https://github.com/test/repo/issues/12' },
              ],
            },
            subIssuesSummary: { total: 3, completed: 1, percentCompleted: 33 },
            trackedIssues: { nodes: [] },
            trackedInIssues: { nodes: [] },
          },
        },
      });

      const result = await repo.getIssueWithTimeline(10);

      expect(result.number).toBe(10);
      expect(result.title).toBe('Epic Issue');
      expect(result.connectedIssues).toHaveLength(1);
      expect(result.connectedIssues[0]!.number).toBe(11);
      expect(result.subIssues).toHaveLength(1);
      expect(result.subIssues[0]!.state).toBe('CLOSED');
      expect(result.subIssuesSummary).toEqual({ total: 3, completed: 1 });
    });

    it('throws NotFoundError for missing issue', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: { issue: null },
      });

      await expect(repo.getIssueWithTimeline(999)).rejects.toThrow(NotFoundError);
    });

    it('sends sub_issues header', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: {
          issue: {
            id: 'I_1', number: 10, title: 'T', body: '', state: 'OPEN', url: '',
            timelineItems: { nodes: [] },
            subIssues: { nodes: [] },
            subIssuesSummary: { total: 0, completed: 0, percentCompleted: 0 },
            trackedIssues: { nodes: [] },
            trackedInIssues: { nodes: [] },
          },
        },
      });

      await repo.getIssueWithTimeline(10);
      expect(client.queryWithHeaders).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { 'GraphQL-Features': 'sub_issues' },
      );
    });

    it('handles timeline events without subjects', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: {
          issue: {
            id: 'I_1', number: 10, title: 'T', body: '', state: 'OPEN', url: '',
            timelineItems: {
              nodes: [
                { id: 'ev1' }, // no subject
                { id: 'ev2', subject: { number: 11, title: 'Connected', state: 'OPEN' } },
              ],
            },
            subIssues: { nodes: [] },
            subIssuesSummary: { total: 0, completed: 0, percentCompleted: 0 },
            trackedIssues: { nodes: [] },
            trackedInIssues: { nodes: [] },
          },
        },
      });

      const result = await repo.getIssueWithTimeline(10);
      expect(result.connectedIssues).toHaveLength(1);
    });
  });
});
