import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DependencyService } from '../../../src/domains/dependencies/dependency-service.js';
import type { IIssueRepository, IWorkflowConfig } from '../../../src/container/interfaces.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockTaskData, createMockWorkflowConfig } from '../../helpers/mock-factories.js';

function createMockIssueRepository(): IIssueRepository {
  return {
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
}

describe('DependencyService', () => {
  let service: DependencyService;
  let issueRepo: ReturnType<typeof createMockIssueRepository>;
  let workflowConfig: IWorkflowConfig;
  let logger: TestLogger;

  beforeEach(() => {
    issueRepo = createMockIssueRepository();
    workflowConfig = createMockWorkflowConfig();
    logger = new TestLogger();
    service = new DependencyService(issueRepo, workflowConfig, logger);
  });

  describe('parseDependencies (static)', () => {
    it('returns empty array for undefined', () => {
      expect(DependencyService.parseDependencies(undefined)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      expect(DependencyService.parseDependencies('')).toEqual([]);
    });

    it('returns empty array for "No dependencies"', () => {
      expect(DependencyService.parseDependencies('No dependencies')).toEqual([]);
    });

    it('returns empty for case-insensitive "no dependencies"', () => {
      expect(DependencyService.parseDependencies('NO DEPENDENCIES')).toEqual([]);
    });

    it('parses single #N dependency', () => {
      expect(DependencyService.parseDependencies('#123')).toEqual([123]);
    });

    it('parses multiple dependencies', () => {
      expect(DependencyService.parseDependencies('#123, #456')).toEqual([123, 456]);
    });

    it('parses "Depends on:" format', () => {
      expect(DependencyService.parseDependencies('Depends on: #10, #20')).toEqual([10, 20]);
    });

    it('parses numbers without hash', () => {
      expect(DependencyService.parseDependencies('123, 456')).toEqual([123, 456]);
    });

    it('deduplicates repeated numbers', () => {
      expect(DependencyService.parseDependencies('#123, #123, #456')).toEqual([123, 456]);
    });

    it('skips zero', () => {
      expect(DependencyService.parseDependencies('#0')).toEqual([]);
    });
  });

  describe('analyzeDependencies', () => {
    it('returns empty when task has no dependencies', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, dependencies: 'No dependencies' }),
      );

      const result = await service.analyzeDependencies(1);

      expect(result.issueNumber).toBe(1);
      expect(result.dependencies).toHaveLength(0);
      expect(result.circularDependencies).toHaveLength(0);
      expect(result.maxDepth).toBe(0);
    });

    it('builds flat dependency tree', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2, #3' });
        if (num === 2) return createMockTaskData({ number: 2, status: 'Done', dependencies: 'No dependencies' });
        if (num === 3) return createMockTaskData({ number: 3, status: 'In Progress', dependencies: 'No dependencies' });
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.analyzeDependencies(1);

      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies[0]!.issueNumber).toBe(2);
      expect(result.dependencies[0]!.satisfied).toBe(true);
      expect(result.dependencies[1]!.issueNumber).toBe(3);
      expect(result.dependencies[1]!.satisfied).toBe(false);
      expect(result.maxDepth).toBe(1);
    });

    it('builds nested dependency tree', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2' });
        if (num === 2) return createMockTaskData({ number: 2, status: 'Done', dependencies: '#3' });
        if (num === 3) return createMockTaskData({ number: 3, status: 'Done', dependencies: 'No dependencies' });
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.analyzeDependencies(1);

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]!.children).toHaveLength(1);
      expect(result.dependencies[0]!.children[0]!.issueNumber).toBe(3);
      expect(result.maxDepth).toBe(2);
    });

    it('detects circular dependencies', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2' });
        if (num === 2) return createMockTaskData({ number: 2, dependencies: '#1' }); // circular!
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.analyzeDependencies(1);

      expect(result.circularDependencies.length).toBeGreaterThan(0);
    });

    it('handles missing dependency tasks gracefully', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#999' });
        throw new Error('Not found');
      });

      const result = await service.analyzeDependencies(1);

      // Missing dep is skipped (null node)
      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('validateDependencies', () => {
    it('returns valid when all dependencies are satisfied', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2, #3' });
        if (num === 2) return createMockTaskData({ number: 2, status: 'Done', dependencies: 'No dependencies' });
        if (num === 3) return createMockTaskData({ number: 3, status: 'Done', dependencies: 'No dependencies' });
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.validateDependencies(1);

      expect(result.valid).toBe(true);
      expect(result.unsatisfied).toHaveLength(0);
      expect(result.circular).toHaveLength(0);
    });

    it('returns invalid when some dependencies are unsatisfied', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2, #3' });
        if (num === 2) return createMockTaskData({ number: 2, status: 'Done', dependencies: 'No dependencies' });
        if (num === 3) return createMockTaskData({ number: 3, status: 'In Progress', dependencies: 'No dependencies' });
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.validateDependencies(1);

      expect(result.valid).toBe(false);
      expect(result.unsatisfied).toContain(3);
    });

    it('returns invalid when circular dependencies exist', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2' });
        if (num === 2) return createMockTaskData({ number: 2, status: 'Done', dependencies: '#1' });
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.validateDependencies(1);

      expect(result.valid).toBe(false);
      expect(result.circular.length).toBeGreaterThan(0);
    });

    it('returns valid when task has no dependencies', async () => {
      vi.mocked(issueRepo.getTask).mockResolvedValue(
        createMockTaskData({ number: 1, dependencies: 'No dependencies' }),
      );

      const result = await service.validateDependencies(1);

      expect(result.valid).toBe(true);
      expect(result.unsatisfied).toHaveLength(0);
    });

    it('collects all unsatisfied dependencies from nested tree', async () => {
      vi.mocked(issueRepo.getTask).mockImplementation(async (num: number) => {
        if (num === 1) return createMockTaskData({ number: 1, dependencies: '#2' });
        if (num === 2) return createMockTaskData({ number: 2, status: 'In Progress', dependencies: '#3' });
        if (num === 3) return createMockTaskData({ number: 3, status: 'Ready for Dev', dependencies: 'No dependencies' });
        throw new Error(`Unknown issue ${num}`);
      });

      const result = await service.validateDependencies(1);

      expect(result.valid).toBe(false);
      expect(result.unsatisfied).toContain(2);
      expect(result.unsatisfied).toContain(3);
    });
  });
});
