import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubIssueRepository } from '../../../../src/infrastructure/github/repositories/issue-repository.js';
import { NotFoundError } from '../../../../src/shared/errors/index.js';
import { TestLogger } from '../../../helpers/test-logger.js';
import { createMockProjectConfig } from '../../../helpers/mock-factories.js';
import { createMockGraphQLClient, buildIssueResponse } from '../helpers/graphql-mock.js';
import type { MockGraphQLClient } from '../helpers/graphql-mock.js';

describe('GitHubIssueRepository', () => {
  let client: MockGraphQLClient;
  let repo: GitHubIssueRepository;
  let logger: TestLogger;

  beforeEach(() => {
    client = createMockGraphQLClient();
    logger = new TestLogger();
    const config = createMockProjectConfig({
      project: { id: 'PVT_test_project_001', number: 1, repository: 'test-org/test-repo' },
    });
    repo = new GitHubIssueRepository(client as unknown as any, config, logger);
  });

  describe('getTask', () => {
    it('returns correctly mapped TaskData', async () => {
      client.queryWithHeaders.mockResolvedValueOnce(buildIssueResponse({
        issueNumber: 42,
        title: 'Test Task',
        status: 'In Progress',
        wave: 'wave-001-test',
      }));

      const task = await repo.getTask(42);

      expect(task.number).toBe(42);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('In Progress');
      expect(task.wave).toBe('wave-001-test');
      expect(task.id).toBe('I_test_42');
      expect(task.itemId).toBe('PVTI_item_001');
    });

    it('finds correct projectItem by project ID', async () => {
      const response = buildIssueResponse({ projectId: 'PVT_test_project_001' });
      // Add a second project item with different project ID
      response.repository.issue!.projectItems.nodes.push({
        id: 'PVTI_other',
        project: { id: 'PVT_OTHER_PROJECT', number: 2 },
        fieldValues: {
          nodes: [{ field: { id: 'f1', name: 'Status' }, name: 'Done' }],
        },
      });

      client.queryWithHeaders.mockResolvedValueOnce(response);

      const task = await repo.getTask(42);
      expect(task.itemId).toBe('PVTI_item_001');
      expect(task.status).toBe('Backlog'); // from first project item, not 'Done'
    });

    it('uses FieldExtractor for field value extraction', async () => {
      client.queryWithHeaders.mockResolvedValueOnce(buildIssueResponse({
        epic: 'epic-auth',
      }));

      const task = await repo.getTask(42);
      expect(task.epic).toBe('epic-auth');
      expect(task.riskLevel).toBe('Low');
      expect(task.effort).toBe('Medium');
      expect(task.aiSuitability).toBe('ai-only');
    });

    it('throws NotFoundError when issue is null', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: { issue: null },
      });

      await expect(repo.getTask(999)).rejects.toThrow(NotFoundError);
    });

    it('extracts assignees and labels', async () => {
      const response = buildIssueResponse();
      response.repository.issue!.assignees = { nodes: [{ login: 'user1' }, { login: 'user2' }] };
      response.repository.issue!.labels = { nodes: [{ name: 'bug' }, { name: 'priority' }] };
      client.queryWithHeaders.mockResolvedValueOnce(response);

      const task = await repo.getTask(42);
      expect(task.assignees).toEqual(['user1', 'user2']);
      expect(task.labels).toEqual(['bug', 'priority']);
    });

    it('sets closed flag from issue state', async () => {
      client.queryWithHeaders.mockResolvedValueOnce(buildIssueResponse({ closed: true }));

      const task = await repo.getTask(42);
      expect(task.closed).toBe(true);
    });

    it('sends sub_issues header', async () => {
      client.queryWithHeaders.mockResolvedValueOnce(buildIssueResponse());
      await repo.getTask(42);

      expect(client.queryWithHeaders).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ owner: 'test-org', repo: 'test-repo', issueNumber: 42 }),
        { 'GraphQL-Features': 'sub_issues' },
      );
    });
  });

  describe('updateTaskStatus', () => {
    it('resolves status ID from config and mutates', async () => {
      client.queryWithHeaders.mockResolvedValueOnce(buildIssueResponse());
      client.mutate.mockResolvedValueOnce({});

      await repo.updateTaskStatus(42, 'IN_PROGRESS');

      expect(client.mutate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          projectId: 'PVT_test_project_001',
          itemId: 'PVTI_item_001',
          fieldId: 'PVTF_status_001',
          value: 'opt_progress',
        }),
      );
    });

    it('throws NotFoundError for unknown status key', async () => {
      await expect(repo.updateTaskStatus(42, 'NONEXISTENT')).rejects.toThrow(NotFoundError);
    });
  });

  describe('addComment', () => {
    it('gets issue ID then adds comment', async () => {
      client.query.mockResolvedValueOnce({
        repository: { issue: { id: 'I_node_123' } },
      });
      client.mutate.mockResolvedValueOnce({});

      await repo.addComment(42, 'Test comment');

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.mutate).toHaveBeenCalledWith(
        expect.any(String),
        { issueId: 'I_node_123', body: 'Test comment' },
      );
    });

    it('throws NotFoundError when issue not found', async () => {
      client.query.mockResolvedValueOnce({
        repository: { issue: null },
      });

      await expect(repo.addComment(999, 'comment')).rejects.toThrow(NotFoundError);
    });
  });

  describe('closeIssue', () => {
    it('gets issue ID then closes', async () => {
      client.query.mockResolvedValueOnce({
        repository: { issue: { id: 'I_node_123' } },
      });
      client.mutate.mockResolvedValueOnce({});

      await repo.closeIssue(42);

      expect(client.mutate).toHaveBeenCalledWith(
        expect.any(String),
        { issueId: 'I_node_123' },
      );
    });
  });

  describe('findPullRequestForIssue', () => {
    it('returns PullRequestInfo when found via closingIssuesReferences', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequests: {
            nodes: [{
              number: 10,
              title: 'Fix #42',
              url: 'https://github.com/test/repo/pull/10',
              state: 'OPEN',
              merged: false,
              headRefName: 'fix-42',
              body: 'Fixes stuff',
              closingIssuesReferences: { nodes: [{ number: 42 }] },
            }],
          },
        },
      });

      const result = await repo.findPullRequestForIssue(42);
      expect(result).not.toBeNull();
      expect(result!.number).toBe(10);
      expect(result!.headRefName).toBe('fix-42');
    });

    it('returns PullRequestInfo when found via title mention', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequests: {
            nodes: [{
              number: 15,
              title: 'Implements #42 feature',
              url: 'https://github.com/test/repo/pull/15',
              state: 'OPEN',
              merged: false,
              headRefName: 'feature-42',
              body: 'Some body',
              closingIssuesReferences: { nodes: [] },
            }],
          },
        },
      });

      const result = await repo.findPullRequestForIssue(42);
      expect(result).not.toBeNull();
      expect(result!.number).toBe(15);
    });

    it('returns null when no PR matches', async () => {
      client.query.mockResolvedValueOnce({
        repository: {
          pullRequests: {
            nodes: [{
              number: 20,
              title: 'Unrelated PR',
              url: 'https://github.com/test/repo/pull/20',
              state: 'OPEN',
              merged: false,
              headRefName: 'other',
              body: 'Nothing here',
              closingIssuesReferences: { nodes: [] },
            }],
          },
        },
      });

      const result = await repo.findPullRequestForIssue(42);
      expect(result).toBeNull();
    });
  });

  describe('getSubIssues', () => {
    it('returns SubIssueData array', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: {
          issue: {
            subIssues: {
              nodes: [
                { number: 43, title: 'Sub 1', state: 'OPEN', url: 'https://github.com/test/repo/issues/43' },
                { number: 44, title: 'Sub 2', state: 'CLOSED', url: 'https://github.com/test/repo/issues/44' },
              ],
            },
          },
        },
      });

      const subs = await repo.getSubIssues(42);
      expect(subs).toHaveLength(2);
      expect(subs[0]).toEqual({
        number: 43,
        title: 'Sub 1',
        state: 'OPEN',
        url: 'https://github.com/test/repo/issues/43',
      });
      expect(subs[1]!.state).toBe('CLOSED');
    });

    it('sends sub_issues header', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: { issue: { subIssues: { nodes: [] } } },
      });

      await repo.getSubIssues(42);
      expect(client.queryWithHeaders).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { 'GraphQL-Features': 'sub_issues' },
      );
    });

    it('throws NotFoundError when issue not found', async () => {
      client.queryWithHeaders.mockResolvedValueOnce({
        repository: { issue: null },
      });

      await expect(repo.getSubIssues(999)).rejects.toThrow(NotFoundError);
    });
  });
});
