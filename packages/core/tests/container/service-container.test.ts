import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceContainer } from '../../src/container/service-container.js';
import { TestLogger } from '../helpers/test-logger.js';
import { InMemoryEventBus } from '../../src/shared/events/index.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * ServiceContainer.create() integration test.
 *
 * Creates a temporary .ido4 directory with valid config files,
 * then verifies the container initializes all services correctly.
 */

let testDir: string;

async function createTestProject(): Promise<string> {
  testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ido4-test-'));
  const ido4Dir = path.join(testDir, '.ido4');
  await fs.mkdir(ido4Dir, { recursive: true });

  // project-info.json
  await fs.writeFile(path.join(ido4Dir, 'project-info.json'), JSON.stringify({
    project: {
      id: 'PVT_test_001',
      number: 1,
      repository: 'test-org/test-repo',
      title: 'Test Project',
    },
    fields: {
      status_field_id: 'PVTF_status',
      wave_field_id: 'PVTF_wave',
      epic_field_id: 'PVTF_epic',
      dependencies_field_id: 'PVTF_deps',
      ai_suitability_field_id: 'PVTF_ai',
      risk_level_field_id: 'PVTF_risk',
      effort_field_id: 'PVTF_effort',
      ai_context_field_id: 'PVTF_ctx',
    },
    status_options: {
      BACKLOG: { name: 'Backlog', id: 'opt_1' },
      IN_REFINEMENT: { name: 'In Refinement', id: 'opt_2' },
      READY_FOR_DEV: { name: 'Ready for Dev', id: 'opt_3' },
      BLOCKED: { name: 'Blocked', id: 'opt_4' },
      IN_PROGRESS: { name: 'In Progress', id: 'opt_5' },
      IN_REVIEW: { name: 'In Review', id: 'opt_6' },
      DONE: { name: 'Done', id: 'opt_7' },
    },
  }));

  // git-workflow.json
  await fs.writeFile(path.join(ido4Dir, 'git-workflow.json'), JSON.stringify({
    enabled: true,
    require_pr_for_review: true,
    show_git_suggestions: true,
    detect_git_context: true,
  }));

  return testDir;
}

describe('ServiceContainer', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await createTestProject();
  });

  it('creates a fully initialized container', async () => {
    const logger = new TestLogger();
    const eventBus = new InMemoryEventBus();

    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
      logger,
      sessionId: 'test-session-123',
      agentId: 'agent-1',
      eventBus,
    });

    // Session identity
    expect(container.sessionId).toBe('test-session-123');
    expect(container.agentId).toBe('agent-1');
    expect(container.eventBus).toBe(eventBus);
    expect(container.logger).toBe(logger);

    // Configuration
    expect(container.projectConfig.project.repository).toBe('test-org/test-repo');
    expect(container.workflowConfig.getStatusName('BACKLOG')).toBe('Backlog');
    expect(container.gitWorkflowConfig.isEnabled()).toBe(true);

    // Infrastructure
    expect(container.graphqlClient).toBeDefined();
    expect(container.issueRepository).toBeDefined();
    expect(container.projectRepository).toBeDefined();
    expect(container.repositoryRepository).toBeDefined();
    expect(container.epicRepository).toBeDefined();

    // Domain Services
    expect(container.taskService).toBeDefined();
    expect(container.taskTransitionValidator).toBeDefined();
    expect(container.waveService).toBeDefined();
    expect(container.epicService).toBeDefined();
    expect(container.epicValidator).toBeDefined();
    expect(container.dependencyService).toBeDefined();
  });

  it('generates sessionId when not provided', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    expect(container.sessionId).toBeDefined();
    expect(container.sessionId.length).toBeGreaterThan(0);
  });

  it('uses NoopLogger when no logger provided', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    // NoopLogger doesn't throw on calls
    expect(() => container.logger.info('test')).not.toThrow();
  });

  it('uses InMemoryEventBus when no event bus provided', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    expect(container.eventBus).toBeDefined();
    // Verify it works as an event bus
    const handler = vi.fn();
    container.eventBus.on('task.transition', handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('loads project config from .ido4 directory', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    expect(container.projectConfig.project.id).toBe('PVT_test_001');
    expect(container.projectConfig.fields.status_field_id).toBe('PVTF_status');
    expect(container.projectConfig.status_options['DONE']!.name).toBe('Done');
  });

  it('loads git workflow config from .ido4 directory', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    expect(container.gitWorkflowConfig.requiresPRForReview()).toBe(true);
    expect(container.gitWorkflowConfig.shouldShowGitSuggestions()).toBe(true);
  });

  it('workflow config resolves status names correctly', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    expect(container.workflowConfig.getStatusName('IN_PROGRESS')).toBe('In Progress');
    expect(container.workflowConfig.getStatusName('DONE')).toBe('Done');
    expect(container.workflowConfig.isValidTransition('Ready for Dev', 'In Progress')).toBe(true);
    expect(container.workflowConfig.isValidTransition('Backlog', 'Done')).toBe(false);
  });

  it('throws when project config is missing', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ido4-empty-'));

    await expect(
      ServiceContainer.create({ projectRoot: emptyDir, githubToken: 'ghp_test' }),
    ).rejects.toThrow();
  });

  it('all services are unique instances', async () => {
    const container = await ServiceContainer.create({
      projectRoot,
      githubToken: 'ghp_test_token',
    });

    // Verify task service and wave service are separate
    expect(container.taskService).not.toBe(container.waveService);
    expect(container.epicService).not.toBe(container.epicValidator);
  });
});
