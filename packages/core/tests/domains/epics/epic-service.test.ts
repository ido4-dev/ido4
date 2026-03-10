import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EpicService } from '../../../src/domains/epics/epic-service.js';
import type { IProjectRepository, ProjectItem } from '../../../src/container/interfaces.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';
import { TestLogger } from '../../helpers/test-logger.js';

function createMockProjectRepository(): IProjectRepository {
  return {
    getProjectItems: vi.fn(),
    updateItemField: vi.fn(),
    getContainerStatus: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

function makeItem(overrides: {
  number?: number;
  title?: string;
  body?: string;
  epic?: string;
  wave?: string;
  status?: string;
  closed?: boolean;
}): ProjectItem {
  return {
    id: `PVTI_${overrides.number ?? 1}`,
    content: {
      number: overrides.number ?? 1,
      title: overrides.title ?? 'Task',
      body: overrides.body ?? '',
      url: `https://github.com/test/repo/issues/${overrides.number ?? 1}`,
      closed: overrides.closed ?? false,
    },
    fieldValues: {
      Status: overrides.status ?? 'Backlog',
      ...(overrides.wave ? { Wave: overrides.wave } : {}),
      ...(overrides.epic ? { Epic: overrides.epic } : {}),
    },
  };
}

describe('EpicService', () => {
  let service: EpicService;
  let projectRepo: ReturnType<typeof createMockProjectRepository>;
  let logger: TestLogger;

  beforeEach(() => {
    projectRepo = createMockProjectRepository();
    logger = new TestLogger();
    service = new EpicService(projectRepo, HYDRO_PROFILE, logger);
  });

  describe('getTasksInEpic', () => {
    it('returns tasks matching by epic field value', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        makeItem({ number: 2, epic: 'Auth Epic', wave: 'wave-001' }),
        makeItem({ number: 3, epic: 'Other Epic', wave: 'wave-002' }),
      ]);

      const tasks = await service.getTasksInEpic('Auth Epic');

      expect(tasks).toHaveLength(2);
      expect(tasks[0]!.number).toBe(1);
      expect(tasks[1]!.number).toBe(2);
    });

    it('matches by epic field case-insensitively', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'AUTH EPIC', wave: 'wave-001' }),
      ]);

      const tasks = await service.getTasksInEpic('auth epic');
      expect(tasks).toHaveLength(1);
    });

    it('matches by title pattern [epicName]', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, title: '[Auth Epic] Setup login', wave: 'wave-001' }),
        makeItem({ number: 2, title: 'Unrelated task', wave: 'wave-001' }),
      ]);

      const tasks = await service.getTasksInEpic('Auth Epic');
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.number).toBe(1);
    });

    it('returns combined field + title matches without duplicates', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Auth Epic', title: '[Auth Epic] Setup', wave: 'wave-001' }),
        makeItem({ number: 2, epic: 'Auth Epic', wave: 'wave-001' }),
        makeItem({ number: 3, title: '[Auth Epic] Other', wave: 'wave-001' }),
      ]);

      const tasks = await service.getTasksInEpic('Auth Epic');
      // All 3 match (item 1 matches both ways but included once)
      expect(tasks).toHaveLength(3);
    });

    it('returns empty array when no tasks match', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Other Epic', wave: 'wave-001' }),
      ]);

      const tasks = await service.getTasksInEpic('Auth Epic');
      expect(tasks).toHaveLength(0);
    });

    it('returns empty array when project has no items', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([]);

      const tasks = await service.getTasksInEpic('Auth Epic');
      expect(tasks).toHaveLength(0);
    });

    it('maps ProjectItem fields to TaskData correctly', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({
          number: 42,
          title: 'Test Task',
          epic: 'Auth Epic',
          wave: 'wave-001',
          status: 'In Progress',
        }),
      ]);

      const tasks = await service.getTasksInEpic('Auth Epic');
      const task = tasks[0]!;

      expect(task.number).toBe(42);
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe('In Progress');
      expect(task.containers['wave']).toBe('wave-001');
      expect(task.containers['epic']).toBe('Auth Epic');
      expect(task.itemId).toBe('PVTI_42');
    });
  });

  describe('validateEpicIntegrity', () => {
    it('returns maintained when task has no epic', async () => {
      const result = await service.validateEpicIntegrity({
        id: 'I_1', itemId: 'PVTI_1', number: 1, title: 'T', body: '', status: 'Backlog',
        containers: {},
      });

      expect(result.maintained).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('returns maintained when all epic tasks are in the same wave', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        makeItem({ number: 2, epic: 'Auth Epic', wave: 'wave-001' }),
      ]);

      const result = await service.validateEpicIntegrity({
        id: 'I_1', itemId: 'PVTI_1', number: 1, title: 'T', body: '',
        status: 'Backlog', containers: { epic: 'Auth Epic', wave: 'wave-001' },
      });

      expect(result.maintained).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('returns violated when epic tasks span multiple waves', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        makeItem({ number: 2, epic: 'Auth Epic', wave: 'wave-002' }),
      ]);

      const result = await service.validateEpicIntegrity({
        id: 'I_1', itemId: 'PVTI_1', number: 1, title: 'T', body: '',
        status: 'Backlog', containers: { epic: 'Auth Epic', wave: 'wave-001' },
      });

      expect(result.maintained).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toContain('Auth Epic');
      expect(result.violations[0]).toContain('wave-001');
      expect(result.violations[0]).toContain('wave-002');
    });

    it('ignores tasks with no wave assignment', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
        makeItem({ number: 2, epic: 'Auth Epic' }), // no wave
      ]);

      const result = await service.validateEpicIntegrity({
        id: 'I_1', itemId: 'PVTI_1', number: 1, title: 'T', body: '',
        status: 'Backlog', containers: { epic: 'Auth Epic', wave: 'wave-001' },
      });

      expect(result.maintained).toBe(true);
    });

    it('returns maintained when epic has only one task', async () => {
      vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
        makeItem({ number: 1, epic: 'Auth Epic', wave: 'wave-001' }),
      ]);

      const result = await service.validateEpicIntegrity({
        id: 'I_1', itemId: 'PVTI_1', number: 1, title: 'T', body: '',
        status: 'Backlog', containers: { epic: 'Auth Epic', wave: 'wave-001' },
      });

      expect(result.maintained).toBe(true);
    });
  });
});
