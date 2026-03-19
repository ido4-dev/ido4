/**
 * IngestionService tests — verifies the orchestration of parse → map → create flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionService } from '../../../src/domains/ingestion/ingestion-service.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';
import { SCRUM_PROFILE } from '../../../src/profiles/scrum.js';
import { NoopLogger } from '../../../src/shared/noop-logger.js';
import type { ITaskService, IIssueRepository, IProjectRepository } from '../../../src/container/interfaces.js';

const SAMPLE_SPEC = `# Test Project

> A test project.

## Capability: Core
> size: M | risk: low

Core group.

### COR-01: First Task
> effort: M | risk: low | type: feature | ai: full
> depends_on: -

Task body for COR-01. This is the first task.

**Success conditions:**
- Condition one

### COR-02: Second Task
> effort: S | risk: medium | type: feature | ai: assisted
> depends_on: COR-01

Task body for COR-02. This depends on COR-01.

**Success conditions:**
- Condition two
`;

describe('IngestionService', () => {
  let service: TestableIngestionService;
  let mockTaskService: {
    createTask: ReturnType<typeof vi.fn>;
  };
  let mockIssueRepo: {
    createIssue: ReturnType<typeof vi.fn>;
    addSubIssue: ReturnType<typeof vi.fn>;
    getTask: ReturnType<typeof vi.fn>;
    getTaskWithDetails: ReturnType<typeof vi.fn>;
    getIssueComments: ReturnType<typeof vi.fn>;
    updateTaskStatus: ReturnType<typeof vi.fn>;
    updateTaskField: ReturnType<typeof vi.fn>;
    updateTaskContainer: ReturnType<typeof vi.fn>;
    assignTask: ReturnType<typeof vi.fn>;
    addComment: ReturnType<typeof vi.fn>;
    closeIssue: ReturnType<typeof vi.fn>;
    findPullRequestForIssue: ReturnType<typeof vi.fn>;
    getSubIssues: ReturnType<typeof vi.fn>;
  };
  let mockProjectRepo: {
    addItemToProject: ReturnType<typeof vi.fn>;
    getProjectItems: ReturnType<typeof vi.fn>;
    updateItemField: ReturnType<typeof vi.fn>;
    deleteProject: ReturnType<typeof vi.fn>;
    getContainerStatus: ReturnType<typeof vi.fn>;
    getCurrentUser: ReturnType<typeof vi.fn>;
  };

  let issueCounter: number;

  class TestableIngestionService extends IngestionService {
    protected override sleep(_ms: number): Promise<void> {
      return Promise.resolve();
    }
  }

  beforeEach(() => {
    issueCounter = 0;

    mockTaskService = {
      createTask: vi.fn().mockImplementation((req: { title: string }) => {
        issueCounter++;
        return Promise.resolve({
          success: true,
          data: {
            issueId: `issue-${issueCounter}`,
            issueNumber: issueCounter + 100,
            itemId: `item-${issueCounter}`,
            url: `https://github.com/test/repo/issues/${issueCounter + 100}`,
            title: req.title,
            status: 'Backlog',
            fieldsSet: ['status'],
          },
        });
      }),
    };

    mockIssueRepo = {
      createIssue: vi.fn().mockImplementation((title: string) => {
        issueCounter++;
        return Promise.resolve({
          id: `issue-${issueCounter}`,
          number: issueCounter + 100,
          url: `https://github.com/test/repo/issues/${issueCounter + 100}`,
        });
      }),
      addSubIssue: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn(),
      getTaskWithDetails: vi.fn(),
      getIssueComments: vi.fn(),
      updateTaskStatus: vi.fn(),
      updateTaskField: vi.fn(),
      updateTaskContainer: vi.fn(),
      assignTask: vi.fn(),
      addComment: vi.fn(),
      closeIssue: vi.fn(),
      findPullRequestForIssue: vi.fn(),
      getSubIssues: vi.fn(),
    };

    mockProjectRepo = {
      addItemToProject: vi.fn().mockResolvedValue('item-id'),
      getProjectItems: vi.fn(),
      updateItemField: vi.fn(),
      deleteProject: vi.fn(),
      getContainerStatus: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    service = new TestableIngestionService(
      mockTaskService as unknown as ITaskService,
      mockIssueRepo as unknown as IIssueRepository,
      mockProjectRepo as unknown as IProjectRepository,
      HYDRO_PROFILE,
      new NoopLogger(),
    );
  });

  describe('dry run', () => {
    it('returns preview without creating issues', async () => {
      const result = await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: true,
        profile: HYDRO_PROFILE,
      });

      expect(result.success).toBe(true);
      expect(result.parsed.projectName).toBe('Test Project');
      expect(result.parsed.groupCount).toBe(1);
      expect(result.parsed.taskCount).toBe(2);
      expect(result.created.groupIssues).toHaveLength(1);
      expect(result.created.tasks).toHaveLength(2);
      expect(result.suggestions[0]).toContain('Dry run');

      // No actual API calls
      expect(mockTaskService.createTask).not.toHaveBeenCalled();
      expect(mockIssueRepo.createIssue).not.toHaveBeenCalled();
    });

    it('reports value mappings in dry run', async () => {
      const result = await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: true,
        profile: HYDRO_PROFILE,
      });

      const firstTask = result.created.tasks[0]!;
      expect(firstTask.ref).toBe('COR-01');
      expect(firstTask.dependsOn).toEqual([]);

      const secondTask = result.created.tasks[1]!;
      expect(secondTask.ref).toBe('COR-02');
      expect(secondTask.dependsOn).toEqual(['COR-01']);
    });
  });

  describe('live ingestion', () => {
    it('creates group issues and tasks', async () => {
      const result = await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(result.success).toBe(true);
      // 1 group issue + 2 tasks
      expect(mockIssueRepo.createIssue).toHaveBeenCalledTimes(1);
      expect(mockTaskService.createTask).toHaveBeenCalledTimes(2);
      expect(result.created.totalIssues).toBe(3);
    });

    it('sets epic container on tasks for Hydro', async () => {
      await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      const firstCall = mockTaskService.createTask.mock.calls[0]![0]!;
      // Group was created as issue 101 (first createIssue call)
      expect(firstCall.containers).toHaveProperty('epic');
      expect(firstCall.containers.epic).toMatch(/^#\d+$/);
    });

    it('resolves dependency refs to issue numbers', async () => {
      await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      // Second task depends on first
      const secondCall = mockTaskService.createTask.mock.calls[1]![0]!;
      expect(secondCall.dependencies).toMatch(/^#\d+$/);
    });

    it('creates sub-issue relationships', async () => {
      await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(mockIssueRepo.addSubIssue).toHaveBeenCalledTimes(2);
    });

    it('adds project items for groups', async () => {
      await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(mockProjectRepo.addItemToProject).toHaveBeenCalledTimes(1);
    });
  });

  describe('error isolation', () => {
    it('skips dependent tasks when a dependency fails', async () => {
      mockTaskService.createTask
        .mockRejectedValueOnce(new Error('API error'))
        .mockImplementation((req: { title: string }) => {
          issueCounter++;
          return Promise.resolve({
            success: true,
            data: {
              issueId: `issue-${issueCounter}`,
              issueNumber: issueCounter + 100,
              itemId: `item-${issueCounter}`,
              url: `https://github.com/test/repo/issues/${issueCounter + 100}`,
              title: req.title,
              status: 'Backlog',
              fieldsSet: [],
            },
          });
        });

      const result = await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(result.success).toBe(false);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0]!.error).toContain('API error');
      expect(result.failed[1]!.error).toContain('dependency');
    });
  });

  describe('empty/invalid specs', () => {
    it('handles empty spec gracefully', async () => {
      const result = await service.ingestSpec({
        specContent: '# Empty\n\n> No tasks.\n',
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(result.created.totalIssues).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Scrum profile', () => {
    it('sets epic container on tasks (Scrum now has epic)', async () => {
      const scrumService = new TestableIngestionService(
        mockTaskService as unknown as ITaskService,
        mockIssueRepo as unknown as IIssueRepository,
        mockProjectRepo as unknown as IProjectRepository,
        SCRUM_PROFILE,
        new NoopLogger(),
      );

      await scrumService.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: SCRUM_PROFILE,
      });

      const firstCall = mockTaskService.createTask.mock.calls[0]![0]!;
      expect(firstCall.containers).toHaveProperty('epic');
    });
  });

  describe('suggestions', () => {
    it('generates creation summary suggestion', async () => {
      const result = await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(result.suggestions.some(s => s.includes('Created 2 tasks'))).toBe(true);
    });

    it('generates group container suggestion for Hydro', async () => {
      const result = await service.ingestSpec({
        specContent: SAMPLE_SPEC,
        dryRun: false,
        profile: HYDRO_PROFILE,
      });

      expect(result.suggestions.some(s => s.includes('epic'))).toBe(true);
    });
  });
});
