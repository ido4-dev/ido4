import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../../../src/domains/tasks/task-service.js';
import { TaskWorkflowService } from '../../../src/domains/tasks/task-workflow-service.js';
import { SuggestionService } from '../../../src/domains/tasks/suggestion-service.js';
import type {
  IIssueRepository, IProjectRepository, ITaskTransitionValidator,
  ProjectItem,
} from '../../../src/container/interfaces.js';
import type { IEventBus } from '../../../src/shared/events/event-bus.js';
import { TestLogger } from '../../helpers/test-logger.js';
import { createMockWorkflowConfig, createMockGitWorkflowConfig, createMockProjectConfig } from '../../helpers/mock-factories.js';
import type { IProjectConfig } from '../../../src/container/interfaces.js';
import { SYSTEM_ACTOR } from '../../../src/index.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';

function createMockIssueRepo(): IIssueRepository {
  return {
    getTask: vi.fn(), getTaskWithDetails: vi.fn(), createIssue: vi.fn(),
    updateTaskStatus: vi.fn(), updateTaskField: vi.fn(), updateTaskContainer: vi.fn(),
    assignTask: vi.fn(), addComment: vi.fn(), closeIssue: vi.fn(),
    findPullRequestForIssue: vi.fn(), getSubIssues: vi.fn().mockResolvedValue([]),
  };
}

function createMockProjectRepo(): IProjectRepository {
  return {
    getProjectItems: vi.fn().mockResolvedValue([]),
    addItemToProject: vi.fn().mockResolvedValue('PVTI_item1'),
    updateItemField: vi.fn(),
    getContainerStatus: vi.fn(),
    getCurrentUser: vi.fn(),
  };
}

function createMockValidator(): ITaskTransitionValidator {
  return { validateTransition: vi.fn(), validateAllTransitions: vi.fn() };
}

function createMockEventBus(): IEventBus {
  return { on: vi.fn().mockReturnValue(() => {}), emit: vi.fn(), removeAllListeners: vi.fn() };
}

function makeProjectItem(overrides: Partial<ProjectItem> & { fieldOverrides?: Record<string, string> } = {}): ProjectItem {
  const { fieldOverrides, ...rest } = overrides;
  return {
    id: 'PVTI_1',
    content: {
      number: 1,
      title: 'Task 1',
      body: 'Description',
      url: 'https://github.com/owner/repo/issues/1',
      closed: false,
    },
    fieldValues: {
      Status: 'In Progress',
      Wave: 'wave-001',
      Epic: 'Auth',
      Dependencies: '#2',
      'AI Suitability': 'ai-reviewed',
      'Risk Level': 'Medium',
      Effort: 'M',
      'Task Type': 'Feature',
      'AI Context': 'Context here',
      ...fieldOverrides,
    },
    ...rest,
  };
}

describe('TaskService — listTasks', () => {
  let service: TaskService;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;

  beforeEach(() => {
    const issueRepo = createMockIssueRepo();
    projectRepo = createMockProjectRepo();
    const validator = createMockValidator();
    const eventBus = createMockEventBus();
    const logger = new TestLogger();
    const workflowConfig = createMockWorkflowConfig();
    const gitWorkflowConfig = createMockGitWorkflowConfig();
    const projectConfig = createMockProjectConfig();

    const workflowService = new TaskWorkflowService(issueRepo, validator, workflowConfig, logger, HYDRO_PROFILE);
    const suggestionService = new SuggestionService(workflowConfig, gitWorkflowConfig, HYDRO_PROFILE);

    service = new TaskService(
      workflowService, suggestionService, validator,
      issueRepo, projectRepo, projectConfig, workflowConfig, eventBus, 'test-session', logger,
    );
  });

  it('returns all tasks when no filters provided', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
      makeProjectItem({ id: 'PVTI_1', content: { number: 1, title: 'Task 1', body: '', url: 'u1', closed: false } }),
      makeProjectItem({ id: 'PVTI_2', content: { number: 2, title: 'Task 2', body: '', url: 'u2', closed: false } }),
    ]);

    const result = await service.listTasks({});
    expect(result.success).toBe(true);
    expect(result.data.tasks).toHaveLength(2);
    expect(result.data.total).toBe(2);
  });

  it('filters by status', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
      makeProjectItem({ id: 'PVTI_1', fieldOverrides: { Status: 'In Progress' } }),
      makeProjectItem({ id: 'PVTI_2', fieldOverrides: { Status: 'Done' } }),
      makeProjectItem({ id: 'PVTI_3', fieldOverrides: { Status: 'In Progress' } }),
    ]);

    const result = await service.listTasks({ status: 'In Progress' });
    expect(result.data.tasks).toHaveLength(2);
    expect(result.data.tasks.every(t => t.status === 'In Progress')).toBe(true);
  });

  it('filters by wave', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
      makeProjectItem({ id: 'PVTI_1', fieldOverrides: { Wave: 'wave-001' } }),
      makeProjectItem({ id: 'PVTI_2', fieldOverrides: { Wave: 'wave-002' } }),
    ]);

    const result = await service.listTasks({ wave: 'wave-001' });
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasks[0]!.containers['wave']).toBe('wave-001');
  });

  it('returns empty array when no items match', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
      makeProjectItem({ fieldOverrides: { Status: 'Done' } }),
    ]);

    const result = await service.listTasks({ status: 'Blocked' });
    expect(result.data.tasks).toHaveLength(0);
    expect(result.data.total).toBe(0);
  });

  it('maps all field values correctly', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([makeProjectItem()]);

    const result = await service.listTasks({});
    const task = result.data.tasks[0]!;

    expect(task.status).toBe('In Progress');
    expect(task.containers['wave']).toBe('wave-001');
    expect(task.containers['epic']).toBe('Auth');
    expect(task.dependencies).toBe('#2');
    expect(task.aiSuitability).toBe('ai-reviewed');
    expect(task.riskLevel).toBe('Medium');
    expect(task.effort).toBe('M');
    expect(task.taskType).toBe('Feature');
    expect(task.aiContext).toBe('Context here');
  });

  it('returns filters in response', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([]);

    const result = await service.listTasks({ status: 'Done', wave: 'wave-001' });
    expect(result.data.filters).toEqual({ status: 'Done', wave: 'wave-001' });
  });

  it('handles empty project', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([]);

    const result = await service.listTasks({});
    expect(result.success).toBe(true);
    expect(result.data.tasks).toHaveLength(0);
  });

  it('combines status and wave filters', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
      makeProjectItem({ id: 'PVTI_1', fieldOverrides: { Status: 'In Progress', Wave: 'wave-001' } }),
      makeProjectItem({ id: 'PVTI_2', fieldOverrides: { Status: 'In Progress', Wave: 'wave-002' } }),
      makeProjectItem({ id: 'PVTI_3', fieldOverrides: { Status: 'Done', Wave: 'wave-001' } }),
    ]);

    const result = await service.listTasks({ status: 'In Progress', wave: 'wave-001' });
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasks[0]!.number).toBe(1);
  });

  it('defaults status to Unknown when missing', async () => {
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([
      makeProjectItem({ fieldOverrides: {} }),
    ]);

    // fieldOverrides: {} will spread over the defaults but Status was in defaults
    // Need to actually remove Status
    vi.mocked(projectRepo.getProjectItems).mockResolvedValue([{
      id: 'PVTI_1',
      content: { number: 1, title: 'No Status', body: '', url: 'u', closed: false },
      fieldValues: {},
    }]);

    const result = await service.listTasks({});
    expect(result.data.tasks[0]!.status).toBe('Unknown');
  });
});

describe('TaskService — createTask', () => {
  let service: TaskService;
  let issueRepo: ReturnType<typeof createMockIssueRepo>;
  let projectRepo: ReturnType<typeof createMockProjectRepo>;
  let eventBus: ReturnType<typeof createMockEventBus>;
  let projectConfig: IProjectConfig;

  beforeEach(() => {
    issueRepo = createMockIssueRepo();
    projectRepo = createMockProjectRepo();
    const validator = createMockValidator();
    eventBus = createMockEventBus();
    const logger = new TestLogger();
    const workflowConfig = createMockWorkflowConfig();
    const gitWorkflowConfig = createMockGitWorkflowConfig();
    projectConfig = createMockProjectConfig();

    const workflowService = new TaskWorkflowService(issueRepo, validator, workflowConfig, logger, HYDRO_PROFILE);
    const suggestionService = new SuggestionService(workflowConfig, gitWorkflowConfig, HYDRO_PROFILE);

    service = new TaskService(
      workflowService, suggestionService, validator,
      issueRepo, projectRepo, projectConfig, workflowConfig, eventBus, 'test-session', logger,
    );

    // Default mock responses
    vi.mocked(issueRepo.createIssue).mockResolvedValue({
      id: 'I_issue1', number: 42, url: 'https://github.com/owner/repo/issues/42',
    });
    vi.mocked(projectRepo.addItemToProject).mockResolvedValue('PVTI_item1');
  });

  it('creates issue and adds to project', async () => {
    const result = await service.createTask({
      title: 'New task',
      body: 'Description here',
      actor: SYSTEM_ACTOR,
    });

    expect(result.success).toBe(true);
    expect(result.data.issueNumber).toBe(42);
    expect(result.data.title).toBe('New task');
    expect(result.data.itemId).toBe('PVTI_item1');
    expect(issueRepo.createIssue).toHaveBeenCalledWith('New task', 'Description here');
    expect(projectRepo.addItemToProject).toHaveBeenCalledWith('I_issue1');
  });

  it('sets initial status to BACKLOG by default', async () => {
    await service.createTask({ title: 'Test', actor: SYSTEM_ACTOR });

    expect(issueRepo.updateTaskStatus).toHaveBeenCalledWith(42, 'BACKLOG');
  });

  it('uses custom initial status when provided', async () => {
    await service.createTask({
      title: 'Ready task',
      initialStatus: 'IN_REFINEMENT',
      actor: SYSTEM_ACTOR,
    });

    expect(issueRepo.updateTaskStatus).toHaveBeenCalledWith(42, 'IN_REFINEMENT');
  });

  it('sets text fields when provided', async () => {
    const result = await service.createTask({
      title: 'Full task',
      wave: 'wave-001',
      epic: 'Auth',
      dependencies: '#1, #2',
      aiContext: 'Implement login',
      actor: SYSTEM_ACTOR,
    });

    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'wave', 'wave-001', 'text');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'epic', 'Auth', 'text');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'dependencies', '#1, #2', 'text');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'ai_context', 'Implement login', 'text');
    expect(result.data.fieldsSet).toContain('wave');
    expect(result.data.fieldsSet).toContain('epic');
    expect(result.data.fieldsSet).toContain('dependencies');
    expect(result.data.fieldsSet).toContain('ai_context');
  });

  it('skips undefined optional fields', async () => {
    await service.createTask({ title: 'Minimal', actor: SYSTEM_ACTOR });

    // Only updateTaskStatus should be called, not updateTaskField
    expect(issueRepo.updateTaskField).not.toHaveBeenCalled();
  });

  it('returns dry run response without making API calls', async () => {
    const result = await service.createTask({
      title: 'Dry run',
      dryRun: true,
      actor: SYSTEM_ACTOR,
    });

    expect(result.success).toBe(true);
    expect(result.data.issueNumber).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]!.code).toBe('DRY_RUN');
    expect(issueRepo.createIssue).not.toHaveBeenCalled();
  });

  it('emits event on creation', async () => {
    await service.createTask({ title: 'Test', actor: SYSTEM_ACTOR });

    expect(eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task.transition',
        issueNumber: 42,
        fromStatus: '',
        toStatus: 'BACKLOG',
        transition: 'create',
      }),
    );
  });

  it('returns suggestions after creation', async () => {
    const result = await service.createTask({ title: 'Test', actor: SYSTEM_ACTOR });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some(s => s.action === 'assign_task_to_wave')).toBe(true);
  });

  it('returns url and issueId in data', async () => {
    const result = await service.createTask({ title: 'Test', actor: SYSTEM_ACTOR });

    expect(result.data.url).toBe('https://github.com/owner/repo/issues/42');
    expect(result.data.issueId).toBe('I_issue1');
  });

  it('includes status in fieldsSet', async () => {
    const result = await service.createTask({ title: 'Test', actor: SYSTEM_ACTOR });

    expect(result.data.fieldsSet).toContain('status');
  });

  it('sets single-select fields when provided', async () => {
    const result = await service.createTask({
      title: 'Full task',
      effort: 'M',
      riskLevel: 'HIGH',
      aiSuitability: 'AI_REVIEWED',
      taskType: 'FEATURE',
      actor: SYSTEM_ACTOR,
    });

    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'effort', 'opt_effort_m', 'singleSelect');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'risk_level', 'opt_risk_high', 'singleSelect');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'ai_suitability', 'opt_ai_reviewed', 'singleSelect');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'task_type', 'opt_type_feature', 'singleSelect');
    expect(result.data.fieldsSet).toContain('effort');
    expect(result.data.fieldsSet).toContain('risk_level');
    expect(result.data.fieldsSet).toContain('ai_suitability');
    expect(result.data.fieldsSet).toContain('task_type');
  });

  it('skips single-select fields with invalid keys', async () => {
    await service.createTask({
      title: 'Bad key',
      effort: 'NONEXISTENT',
      actor: SYSTEM_ACTOR,
    });

    // updateTaskField should not be called for effort (invalid key)
    expect(issueRepo.updateTaskField).not.toHaveBeenCalledWith(
      42, 'effort', expect.anything(), 'singleSelect',
    );
  });

  it('sets both text and single-select fields together', async () => {
    const result = await service.createTask({
      title: 'Complete task',
      wave: 'wave-001',
      epic: 'Auth',
      effort: 'L',
      taskType: 'BUG',
      actor: SYSTEM_ACTOR,
    });

    // Text fields
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'wave', 'wave-001', 'text');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'epic', 'Auth', 'text');
    // Single-select fields
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'effort', 'opt_effort_l', 'singleSelect');
    expect(issueRepo.updateTaskField).toHaveBeenCalledWith(42, 'task_type', 'opt_type_bug', 'singleSelect');
    expect(result.data.fieldsSet).toEqual(
      expect.arrayContaining(['status', 'wave', 'epic', 'effort', 'task_type']),
    );
  });

  it('handles missing option maps gracefully', async () => {
    // Create service with no option maps in config
    const base = createMockProjectConfig();
    const sparseConfig: IProjectConfig = {
      ...base,
      effort_options: undefined,
      risk_level_options: undefined,
      ai_suitability_options: undefined,
      task_type_options: undefined,
    };
    const validator = createMockValidator();
    const logger = new TestLogger();
    const workflowConfig = createMockWorkflowConfig();
    const gitWorkflowConfig = createMockGitWorkflowConfig();
    const workflowService = new TaskWorkflowService(issueRepo, validator, workflowConfig, logger, HYDRO_PROFILE);
    const suggestionService = new SuggestionService(workflowConfig, gitWorkflowConfig, HYDRO_PROFILE);
    const sparseService = new TaskService(
      workflowService, suggestionService, validator,
      issueRepo, projectRepo, sparseConfig, workflowConfig, eventBus, 'test-session', logger,
    );

    const result = await sparseService.createTask({
      title: 'Sparse config',
      effort: 'M',
      riskLevel: 'HIGH',
      actor: SYSTEM_ACTOR,
    });

    // Should succeed but not set single-select fields
    expect(result.success).toBe(true);
    expect(issueRepo.updateTaskField).not.toHaveBeenCalledWith(
      42, 'effort', expect.anything(), 'singleSelect',
    );
  });
});
