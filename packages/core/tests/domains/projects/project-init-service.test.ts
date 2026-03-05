import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectInitService } from '../../../src/domains/projects/project-init-service.js';
import { NoopLogger } from '../../../src/shared/noop-logger.js';
import type { IGraphQLClient } from '../../../src/container/interfaces.js';
import type {
  RepositoryOwnerResponse,
  CreateProjectResponse,
  CreateFieldTextResponse,
  CreateFieldSingleSelectResponse,
  GetProjectWithFieldsResponse,
} from '../../../src/infrastructure/github/queries/project-init-queries.js';
import { FIELD_OPTIONS } from '../../../src/infrastructure/github/queries/project-init-queries.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ─── Mock execFile for git remote detection ───

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

// ─── Helpers ───

function createMockGraphQLClient(): IGraphQLClient {
  return {
    query: vi.fn(),
    mutate: vi.fn(),
  };
}

function makeRepoOwnerResponse(owner = 'testuser', ownerId = 'MDQ6VXNlcjEyMzQ='): RepositoryOwnerResponse {
  return {
    repository: {
      id: 'R_repo123',
      owner: { id: ownerId, login: owner },
      projectsV2: { nodes: [] },
    },
  };
}

function makeCreateProjectResponse(id = 'PVT_test123', number = 1, title = 'Test Project'): CreateProjectResponse {
  return {
    createProjectV2: {
      projectV2: {
        id,
        number,
        title,
        url: `https://github.com/users/testuser/projects/${number}`,
        owner: { login: 'testuser' },
      },
    },
  };
}

function makeCreateFieldTextResponse(id: string, name: string): CreateFieldTextResponse {
  return {
    createProjectV2Field: {
      projectV2Field: { id, name, dataType: 'TEXT' },
    },
  };
}

function makeCreateFieldSelectResponse(id: string, name: string, options: Array<{ name: string; color: string }>): CreateFieldSingleSelectResponse {
  return {
    createProjectV2Field: {
      projectV2Field: {
        id,
        name,
        dataType: 'SINGLE_SELECT',
        options: options.map((o, i) => ({ id: `opt_${i}`, name: o.name, color: o.color })),
      },
    },
  };
}

function makeProjectWithFieldsResponse(): GetProjectWithFieldsResponse {
  return {
    node: {
      id: 'PVT_test123',
      number: 1,
      title: 'Test Project',
      url: 'https://github.com/users/testuser/projects/1',
      fields: {
        nodes: [
          { id: 'PVTSSF_status', name: 'Status', dataType: 'SINGLE_SELECT', options: [
            { id: 'opt_backlog', name: 'Backlog', color: 'GRAY' },
            { id: 'opt_refinement', name: 'In Refinement', color: 'BLUE' },
            { id: 'opt_ready', name: 'Ready for Dev', color: 'BLUE' },
            { id: 'opt_blocked', name: 'Blocked', color: 'RED' },
            { id: 'opt_progress', name: 'In Progress', color: 'YELLOW' },
            { id: 'opt_review', name: 'In Review', color: 'ORANGE' },
            { id: 'opt_done', name: 'Done', color: 'GREEN' },
          ]},
          { id: 'PVTF_wave', name: 'Wave', dataType: 'TEXT' },
          { id: 'PVTF_epic', name: 'Epic', dataType: 'TEXT' },
          { id: 'PVTF_deps', name: 'Dependencies', dataType: 'TEXT' },
          { id: 'PVTF_aicontext', name: 'AI Context', dataType: 'TEXT' },
          { id: 'PVTSSF_aisuitability', name: 'AI Suitability', dataType: 'SINGLE_SELECT', options: [
            { id: 'opt_aionly', name: 'ai-only', color: 'GREEN' },
            { id: 'opt_aireviewed', name: 'ai-reviewed', color: 'BLUE' },
            { id: 'opt_hybrid', name: 'hybrid', color: 'YELLOW' },
            { id: 'opt_humanonly', name: 'human-only', color: 'RED' },
          ]},
          { id: 'PVTSSF_risk', name: 'Risk Level', dataType: 'SINGLE_SELECT', options: [
            { id: 'opt_low', name: 'Low', color: 'GREEN' },
            { id: 'opt_med', name: 'Medium', color: 'YELLOW' },
            { id: 'opt_high', name: 'High', color: 'ORANGE' },
            { id: 'opt_crit', name: 'Critical', color: 'RED' },
          ]},
          { id: 'PVTSSF_effort', name: 'Effort', dataType: 'SINGLE_SELECT', options: [
            { id: 'opt_xs', name: 'XS', color: 'GREEN' },
            { id: 'opt_s', name: 'S', color: 'BLUE' },
            { id: 'opt_m', name: 'M', color: 'YELLOW' },
            { id: 'opt_l', name: 'L', color: 'ORANGE' },
            { id: 'opt_xl', name: 'XL', color: 'RED' },
          ]},
          { id: 'PVTSSF_tasktype', name: 'Task Type', dataType: 'SINGLE_SELECT', options: [
            { id: 'opt_feature', name: 'Feature', color: 'GREEN' },
            { id: 'opt_bug', name: 'Bug', color: 'RED' },
            { id: 'opt_enhance', name: 'Enhancement', color: 'BLUE' },
            { id: 'opt_docs', name: 'Documentation', color: 'GRAY' },
            { id: 'opt_testing', name: 'Testing', color: 'PURPLE' },
          ]},
        ],
      },
    },
  };
}

function setupFullCreateMocks(client: IGraphQLClient): void {
  const query = client.query as ReturnType<typeof vi.fn>;
  const mutate = client.mutate as ReturnType<typeof vi.fn>;

  // GET_REPOSITORY_OWNER
  query.mockResolvedValueOnce(makeRepoOwnerResponse());
  // CREATE_PROJECT
  mutate.mockResolvedValueOnce(makeCreateProjectResponse());
  // CREATE_FIELD_TEXT × 4
  mutate.mockResolvedValueOnce(makeCreateFieldTextResponse('PVTF_wave', 'Wave'));
  mutate.mockResolvedValueOnce(makeCreateFieldTextResponse('PVTF_epic', 'Epic'));
  mutate.mockResolvedValueOnce(makeCreateFieldTextResponse('PVTF_deps', 'Dependencies'));
  mutate.mockResolvedValueOnce(makeCreateFieldTextResponse('PVTF_aicontext', 'AI Context'));
  // CREATE_FIELD_SINGLE_SELECT × 4
  mutate.mockResolvedValueOnce(makeCreateFieldSelectResponse('PVTSSF_ai', 'AI Suitability', FIELD_OPTIONS.AI_SUITABILITY as unknown as Array<{ name: string; color: string }>));
  mutate.mockResolvedValueOnce(makeCreateFieldSelectResponse('PVTSSF_risk', 'Risk Level', FIELD_OPTIONS.RISK_LEVEL as unknown as Array<{ name: string; color: string }>));
  mutate.mockResolvedValueOnce(makeCreateFieldSelectResponse('PVTSSF_effort', 'Effort', FIELD_OPTIONS.EFFORT as unknown as Array<{ name: string; color: string }>));
  mutate.mockResolvedValueOnce(makeCreateFieldSelectResponse('PVTSSF_type', 'Task Type', FIELD_OPTIONS.TASK_TYPE as unknown as Array<{ name: string; color: string }>));
  // GET_PROJECT_WITH_FIELDS (read-back)
  query.mockResolvedValueOnce(makeProjectWithFieldsResponse());
}

// ─── Tests ───

describe('ProjectInitService', () => {
  let client: IGraphQLClient;
  let service: ProjectInitService;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    client = createMockGraphQLClient();
    service = new ProjectInitService(client, new NoopLogger());
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ido4-init-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // ─── detectRepository ───

  describe('detectRepository', () => {
    it('parses HTTPS remote URL', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'https://github.com/myorg/myrepo.git\n');
      });

      const result = await service.detectRepository(tempDir);
      expect(result).toBe('myorg/myrepo');
    });

    it('parses SSH remote URL', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'git@github.com:myorg/myrepo.git\n');
      });

      const result = await service.detectRepository(tempDir);
      expect(result).toBe('myorg/myrepo');
    });

    it('parses HTTPS without .git suffix', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'https://github.com/myorg/myrepo\n');
      });

      const result = await service.detectRepository(tempDir);
      expect(result).toBe('myorg/myrepo');
    });

    it('throws on non-GitHub remote', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'https://gitlab.com/myorg/myrepo.git\n');
      });

      await expect(service.detectRepository(tempDir)).rejects.toThrow('not a GitHub repository');
    });

    it('throws when git command fails', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(new Error('not a git repository'));
      });

      await expect(service.detectRepository(tempDir)).rejects.toThrow('Could not detect GitHub repository');
    });

    it('passes projectRoot as cwd to git', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], opts: Record<string, unknown>, cb: Function) => {
        expect(opts.cwd).toBe(tempDir);
        cb(null, 'https://github.com/myorg/myrepo.git\n');
      });

      await service.detectRepository(tempDir);
    });
  });

  // ─── initializeProject — create mode ───

  describe('initializeProject (create mode)', () => {
    it('creates project, fields, and writes config', async () => {
      setupFullCreateMocks(client);

      const result = await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.project.id).toBe('PVT_test123');
      expect(result.project.repository).toBe('testuser/testrepo');
      expect(result.fieldsCreated).toHaveLength(8);
      expect(result.fieldsCreated).toContain('Wave');
      expect(result.fieldsCreated).toContain('AI Suitability');
    });

    it('writes valid project-info.json', async () => {
      setupFullCreateMocks(client);

      const result = await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const configContent = await fs.readFile(result.configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.project.id).toBe('PVT_test123');
      expect(config.project.repository).toBe('testuser/testrepo');
      expect(config.fields.status_field_id).toBe('PVTSSF_status');
      expect(config.fields.wave_field_id).toBe('PVTF_wave');
      expect(config.fields.epic_field_id).toBe('PVTF_epic');
      expect(config.fields.dependencies_field_id).toBe('PVTF_deps');
      expect(config.fields.ai_suitability_field_id).toBe('PVTSSF_aisuitability');
      expect(config.fields.ai_context_field_id).toBe('PVTF_aicontext');
    });

    it('extracts all 7 status options with correct keys', async () => {
      setupFullCreateMocks(client);

      const result = await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const configContent = await fs.readFile(result.configPath, 'utf-8');
      const config = JSON.parse(configContent);

      expect(config.status_options.BACKLOG).toEqual({ name: 'Backlog', id: 'opt_backlog' });
      expect(config.status_options.IN_REFINEMENT).toEqual({ name: 'In Refinement', id: 'opt_refinement' });
      expect(config.status_options.READY_FOR_DEV).toEqual({ name: 'Ready for Dev', id: 'opt_ready' });
      expect(config.status_options.BLOCKED).toEqual({ name: 'Blocked', id: 'opt_blocked' });
      expect(config.status_options.IN_PROGRESS).toEqual({ name: 'In Progress', id: 'opt_progress' });
      expect(config.status_options.IN_REVIEW).toEqual({ name: 'In Review', id: 'opt_review' });
      expect(config.status_options.DONE).toEqual({ name: 'Done', id: 'opt_done' });
    });

    it('writes git-workflow.json with defaults', async () => {
      setupFullCreateMocks(client);

      await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const gitConfig = JSON.parse(
        await fs.readFile(path.join(tempDir, '.ido4', 'git-workflow.json'), 'utf-8'),
      );

      expect(gitConfig.enabled).toBe(true);
      expect(gitConfig.require_pr_for_review).toBe(true);
      expect(gitConfig.show_git_suggestions).toBe(true);
      expect(gitConfig.detect_git_context).toBe(true);
    });

    it('uses default project name when not provided', async () => {
      setupFullCreateMocks(client);

      await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const mutate = client.mutate as ReturnType<typeof vi.fn>;
      // Second mutate call is CREATE_PROJECT
      expect(mutate.mock.calls[0][1]).toEqual({
        ownerId: 'MDQ6VXNlcjEyMzQ=',
        title: 'testrepo AI Management',
      });
    });

    it('uses custom project name when provided', async () => {
      setupFullCreateMocks(client);

      await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectName: 'My Custom Project',
        projectRoot: tempDir,
      });

      const mutate = client.mutate as ReturnType<typeof vi.fn>;
      expect(mutate.mock.calls[0][1]).toEqual({
        ownerId: 'MDQ6VXNlcjEyMzQ=',
        title: 'My Custom Project',
      });
    });

    it('creates 4 text fields and 4 single-select fields', async () => {
      setupFullCreateMocks(client);

      await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const mutate = client.mutate as ReturnType<typeof vi.fn>;
      // Call 0: CREATE_PROJECT
      // Calls 1-4: CREATE_FIELD_TEXT (Wave, Epic, Dependencies, AI Context)
      // Calls 5-8: CREATE_FIELD_SINGLE_SELECT (AI Suitability, Risk Level, Effort, Task Type)
      expect(mutate).toHaveBeenCalledTimes(9); // 1 project + 4 text + 4 select
    });

    it('auto-detects repository when not provided', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null, 'https://github.com/autouser/autorepo.git\n');
      });

      const query = client.query as ReturnType<typeof vi.fn>;
      const mutate = client.mutate as ReturnType<typeof vi.fn>;

      query.mockResolvedValueOnce(makeRepoOwnerResponse('autouser'));
      mutate.mockResolvedValueOnce(makeCreateProjectResponse());
      for (let i = 0; i < 4; i++) mutate.mockResolvedValueOnce(makeCreateFieldTextResponse(`PVTF_${i}`, `field${i}`));
      for (let i = 0; i < 4; i++) mutate.mockResolvedValueOnce(makeCreateFieldSelectResponse(`PVTSSF_${i}`, `select${i}`, []));
      query.mockResolvedValueOnce(makeProjectWithFieldsResponse());

      const result = await service.initializeProject({
        mode: 'create',
        projectRoot: tempDir,
      });

      expect(result.project.repository).toBe('autouser/autorepo');
    });
  });

  // ─── initializeProject — connect mode ───

  describe('initializeProject (connect mode)', () => {
    it('connects to existing project and reads fields', async () => {
      const query = client.query as ReturnType<typeof vi.fn>;

      // GET_REPOSITORY_OWNER
      query.mockResolvedValueOnce(makeRepoOwnerResponse());
      // GET_PROJECT_WITH_FIELDS (for getExistingProject)
      query.mockResolvedValueOnce(makeProjectWithFieldsResponse());
      // GET_PROJECT_WITH_FIELDS (for readProjectFields)
      query.mockResolvedValueOnce(makeProjectWithFieldsResponse());

      const result = await service.initializeProject({
        mode: 'connect',
        repository: 'testuser/testrepo',
        projectId: 'PVT_test123',
        projectRoot: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.fieldsCreated).toHaveLength(0); // connect mode doesn't create fields
    });

    it('throws when projectId is missing in connect mode', async () => {
      await expect(
        service.initializeProject({
          mode: 'connect',
          repository: 'testuser/testrepo',
          projectRoot: tempDir,
        }),
      ).rejects.toThrow('projectId is required');
    });

    it('throws when project not found', async () => {
      const query = client.query as ReturnType<typeof vi.fn>;

      // GET_REPOSITORY_OWNER
      query.mockResolvedValueOnce(makeRepoOwnerResponse());
      // GET_PROJECT_WITH_FIELDS returns null node
      query.mockResolvedValueOnce({ node: null });

      await expect(
        service.initializeProject({
          mode: 'connect',
          repository: 'testuser/testrepo',
          projectId: 'PVT_nonexistent',
          projectRoot: tempDir,
        }),
      ).rejects.toThrow('not found');
    });
  });

  // ─── Validation ───

  describe('validation', () => {
    it('rejects invalid repository format', async () => {
      await expect(
        service.initializeProject({
          mode: 'create',
          repository: 'invalid-format',
          projectRoot: tempDir,
        }),
      ).rejects.toThrow('Invalid repository format');
    });

    it('rejects repository with special characters', async () => {
      await expect(
        service.initializeProject({
          mode: 'create',
          repository: 'user/repo with spaces',
          projectRoot: tempDir,
        }),
      ).rejects.toThrow('Invalid repository format');
    });
  });

  // ─── Error handling ───

  describe('error handling', () => {
    it('wraps repository access error', async () => {
      const query = client.query as ReturnType<typeof vi.fn>;
      query.mockRejectedValueOnce(new Error('Not Found'));

      await expect(
        service.initializeProject({
          mode: 'create',
          repository: 'testuser/nonexistent',
          projectRoot: tempDir,
        }),
      ).rejects.toThrow('not found or not accessible');
    });
  });

  // ─── Config file validation ───

  describe('config file structure', () => {
    it('creates .ido4 directory', async () => {
      setupFullCreateMocks(client);

      await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const stat = await fs.stat(path.join(tempDir, '.ido4'));
      expect(stat.isDirectory()).toBe(true);
    });

    it('config has wave_config section', async () => {
      setupFullCreateMocks(client);

      const result = await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      const config = JSON.parse(await fs.readFile(result.configPath, 'utf-8'));
      expect(config.wave_config.autoDetect).toBe(true);
    });

    it('configPath points to .ido4/project-info.json', async () => {
      setupFullCreateMocks(client);

      const result = await service.initializeProject({
        mode: 'create',
        repository: 'testuser/testrepo',
        projectRoot: tempDir,
      });

      expect(result.configPath).toBe(path.join(tempDir, '.ido4', 'project-info.json'));
    });
  });

  // ─── FIELD_OPTIONS constants ───

  describe('FIELD_OPTIONS', () => {
    it('has 5 field categories', () => {
      expect(Object.keys(FIELD_OPTIONS)).toHaveLength(5);
    });

    it('STATUS has 7 options', () => {
      expect(FIELD_OPTIONS.STATUS).toHaveLength(7);
    });

    it('AI_SUITABILITY has 4 options', () => {
      expect(FIELD_OPTIONS.AI_SUITABILITY).toHaveLength(4);
    });

    it('EFFORT has 5 options', () => {
      expect(FIELD_OPTIONS.EFFORT).toHaveLength(5);
    });

    it('all options have name and color', () => {
      for (const [_category, options] of Object.entries(FIELD_OPTIONS)) {
        for (const option of options) {
          expect(option.name).toBeDefined();
          expect(option.color).toBeDefined();
        }
      }
    });
  });
});
