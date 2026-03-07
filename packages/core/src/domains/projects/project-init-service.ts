/**
 * ProjectInitService — Initializes a GitHub Project V2 for ido4 governance.
 *
 * Bootstraps standalone (no ServiceContainer) — creates its own GraphQL client.
 * Two modes: 'create' (new project) or 'connect' (existing project).
 *
 * Responsibilities:
 * 1. Auto-detect repository from git remote
 * 2. Create or connect to GitHub Project V2
 * 3. Create 8 custom fields (4 text + 4 single-select)
 * 4. Read back all field IDs including native Status options
 * 5. Write .ido4/project-info.json and .ido4/git-workflow.json
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IGraphQLClient, IProjectInitService, ProjectInitOptions, ProjectInitResult } from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import { ConfigurationError, GitHubAPIError, ValidationError } from '../../shared/errors/index.js';
import {
  GET_REPOSITORY_OWNER,
  CREATE_PROJECT,
  CREATE_FIELD_TEXT,
  CREATE_FIELD_SINGLE_SELECT,
  UPDATE_FIELD_SINGLE_SELECT,
  GET_PROJECT_WITH_FIELDS,
  FIELD_OPTIONS,
  STATUS_NAME_TO_KEY,
  OPTION_NAME_TO_KEY,
} from '../../infrastructure/github/queries/project-init-queries.js';
import type {
  RepositoryOwnerResponse,
  CreateProjectResponse,
  CreateFieldTextResponse,
  CreateFieldSingleSelectResponse,
  UpdateFieldSingleSelectResponse,
  GetProjectWithFieldsResponse,
  ProjectFieldNode,
} from '../../infrastructure/github/queries/project-init-queries.js';

/** Fields created during init — text fields */
const TEXT_FIELDS = ['Wave', 'Epic', 'Dependencies', 'AI Context'] as const;

/** Fields created during init — single-select fields with options */
const SINGLE_SELECT_FIELDS = [
  { name: 'AI Suitability', options: FIELD_OPTIONS.AI_SUITABILITY },
  { name: 'Risk Level', options: FIELD_OPTIONS.RISK_LEVEL },
  { name: 'Effort', options: FIELD_OPTIONS.EFFORT },
  { name: 'Task Type', options: FIELD_OPTIONS.TASK_TYPE },
] as const;

/** Map from field display name to config key prefix */
const FIELD_NAME_TO_CONFIG_KEY: Record<string, string> = {
  'Status': 'status_field_id',
  'Wave': 'wave_field_id',
  'Epic': 'epic_field_id',
  'Dependencies': 'dependencies_field_id',
  'AI Suitability': 'ai_suitability_field_id',
  'Risk Level': 'risk_level_field_id',
  'Effort': 'effort_field_id',
  'AI Context': 'ai_context_field_id',
  'Task Type': 'task_type_field_id',
};

export class ProjectInitService implements IProjectInitService {
  constructor(
    private readonly graphqlClient: IGraphQLClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Detect GitHub repository from git remote origin.
   * Parses both SSH and HTTPS URLs.
   */
  async detectRepository(projectRoot: string): Promise<string> {
    const remoteUrl = await this.getGitRemoteUrl(projectRoot);
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);

    if (!match) {
      throw new ConfigurationError({
        message: `Git remote '${remoteUrl}' is not a GitHub repository`,
        remediation: 'Provide the repository parameter explicitly (owner/repo format)',
      });
    }

    return `${match[1]}/${match[2]}`;
  }

  /**
   * Initialize a GitHub Project V2 for ido4 governance.
   */
  async initializeProject(options: ProjectInitOptions): Promise<ProjectInitResult> {
    // Validate options
    this.validateOptions(options);

    // 1. Resolve repository
    const repository = options.repository ?? await this.detectRepository(options.projectRoot);
    this.validateRepositoryFormat(repository);
    const [owner, repo] = repository.split('/') as [string, string];

    this.logger.info('Starting project initialization', { mode: options.mode, repository });

    // 2. Validate repository access
    const repoInfo = await this.getRepositoryInfo(owner, repo);

    // 3. Create or connect project
    let projectId: string;
    let projectNumber: number;
    let projectTitle: string;
    let projectUrl: string;

    if (options.mode === 'create') {
      const projectName = options.projectName ?? `${repo} AI Management`;
      const created = await this.createProject(repoInfo.ownerId, projectName);
      projectId = created.id;
      projectNumber = created.number;
      projectTitle = created.title;
      projectUrl = created.url;
    } else {
      // Connect mode — fetch existing project
      const existing = await this.getExistingProject(options.projectId!);
      projectId = existing.id;
      projectNumber = existing.number;
      projectTitle = existing.title;
      projectUrl = existing.url;
    }

    // 4. Create custom fields (only in create mode, connect mode reads existing)
    const fieldsCreated: string[] = [];
    if (options.mode === 'create') {
      await this.setupFields(projectId, fieldsCreated);
    }

    // 5. Read back all fields to capture IDs
    const projectWithFields = await this.readProjectFields(projectId);

    // 6. Build and write config
    const config = this.buildProjectConfig(
      { id: projectId, number: projectNumber, title: projectTitle, url: projectUrl },
      projectWithFields.fields,
      repository,
    );
    const configPath = await this.writeConfigFiles(options.projectRoot, config);

    this.logger.info('Project initialization complete', {
      projectId,
      projectTitle,
      fieldsCreated: fieldsCreated.length,
      configPath,
    });

    return {
      success: true,
      project: { id: projectId, number: projectNumber, title: projectTitle, url: projectUrl, repository },
      fieldsCreated,
      configPath,
    };
  }

  // ─── Private Methods ───

  private validateOptions(options: ProjectInitOptions): void {
    if (options.mode === 'connect' && !options.projectId) {
      throw new ValidationError({
        message: 'projectId is required when mode is "connect"',
        context: { field: 'projectId' },
        remediation: 'Provide a projectId starting with PVT_ when using connect mode',
      });
    }
  }

  private validateRepositoryFormat(repository: string): void {
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
      throw new ValidationError({
        message: `Invalid repository format: '${repository}'. Expected 'owner/repo'`,
        context: { field: 'repository', value: repository },
        remediation: 'Use the format owner/repo (e.g., microsoft/vscode)',
      });
    }
  }

  private getGitRemoteUrl(projectRoot: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', ['remote', 'get-url', 'origin'], { cwd: projectRoot, timeout: 10_000 }, (error, stdout) => {
        if (error) {
          reject(new ConfigurationError({
            message: 'Could not detect GitHub repository from git remote',
            remediation: 'Ensure you are in a git repository with a GitHub remote, or provide the repository parameter',
          }));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  private async getRepositoryInfo(owner: string, repo: string): Promise<{ ownerId: string; ownerLogin: string; existingProjects: Array<{ id: string; number: number; title: string; url: string }> }> {
    try {
      const response = await this.graphqlClient.query<RepositoryOwnerResponse>(
        GET_REPOSITORY_OWNER,
        { owner, name: repo },
      );

      return {
        ownerId: response.repository.owner.id,
        ownerLogin: response.repository.owner.login,
        existingProjects: response.repository.projectsV2.nodes,
      };
    } catch (error) {
      throw new GitHubAPIError({
        message: `Repository '${owner}/${repo}' not found or not accessible`,
        statusCode: 404,
        remediation: 'Check the repository name and ensure your GitHub token has access',
      });
    }
  }

  private async createProject(ownerId: string, title: string): Promise<{ id: string; number: number; title: string; url: string }> {
    const response = await this.graphqlClient.mutate<CreateProjectResponse>(
      CREATE_PROJECT,
      { ownerId, title },
    );

    const project = response.createProjectV2.projectV2;
    this.logger.info('Created GitHub Project V2', { id: project.id, title: project.title });
    return project;
  }

  private async getExistingProject(projectId: string): Promise<{ id: string; number: number; title: string; url: string }> {
    const response = await this.graphqlClient.query<GetProjectWithFieldsResponse>(
      GET_PROJECT_WITH_FIELDS,
      { projectId },
    );

    if (!response.node) {
      throw new ConfigurationError({
        message: `Project '${projectId}' not found`,
        remediation: 'Verify the project ID starts with PVT_ and you have access to it',
      });
    }

    return {
      id: response.node.id,
      number: response.node.number,
      title: response.node.title,
      url: response.node.url,
    };
  }

  private async setupFields(projectId: string, fieldsCreated: string[]): Promise<void> {
    // Configure the native Status field with ido4's required options
    await this.configureStatusField(projectId);
    fieldsCreated.push('Status (configured)');

    // Create text fields
    for (const fieldName of TEXT_FIELDS) {
      await this.createTextField(projectId, fieldName);
      fieldsCreated.push(fieldName);
    }

    // Create single-select fields
    for (const field of SINGLE_SELECT_FIELDS) {
      await this.createSingleSelectField(projectId, field.name, field.options as unknown as Array<{ name: string; color: string; description?: string }>);
      fieldsCreated.push(field.name);
    }
  }

  private async configureStatusField(projectId: string): Promise<void> {
    // Read the project fields to find the native Status field ID
    const { fields } = await this.readProjectFields(projectId);
    const statusField = fields.find(f => f.name === 'Status' && f.options);

    if (!statusField) {
      throw new ConfigurationError({
        message: 'Native Status field not found on the project',
        remediation: 'Ensure the GitHub Project V2 was created successfully',
      });
    }

    // Update the Status field with ido4's required options
    await this.graphqlClient.mutate<UpdateFieldSingleSelectResponse>(
      UPDATE_FIELD_SINGLE_SELECT,
      {
        fieldId: statusField.id,
        options: FIELD_OPTIONS.STATUS.map(opt => ({ name: opt.name, color: opt.color, description: opt.description })),
      },
    );

    this.logger.info('Status field configured', {
      fieldId: statusField.id,
      options: FIELD_OPTIONS.STATUS.map(o => o.name),
    });
  }

  private async createTextField(projectId: string, name: string): Promise<string> {
    const response = await this.graphqlClient.mutate<CreateFieldTextResponse>(
      CREATE_FIELD_TEXT,
      { projectId, name },
    );
    const fieldId = response.createProjectV2Field.projectV2Field.id;
    this.logger.debug('Created text field', { name, fieldId });
    return fieldId;
  }

  private async createSingleSelectField(
    projectId: string,
    name: string,
    options: Array<{ name: string; color: string; description?: string }>,
  ): Promise<string> {
    const response = await this.graphqlClient.mutate<CreateFieldSingleSelectResponse>(
      CREATE_FIELD_SINGLE_SELECT,
      { projectId, name, options },
    );
    const fieldId = response.createProjectV2Field.projectV2Field.id;
    this.logger.debug('Created single-select field', { name, fieldId, optionCount: options.length });
    return fieldId;
  }

  private async readProjectFields(projectId: string): Promise<{ fields: ProjectFieldNode[] }> {
    const response = await this.graphqlClient.query<GetProjectWithFieldsResponse>(
      GET_PROJECT_WITH_FIELDS,
      { projectId },
    );
    return { fields: response.node.fields.nodes };
  }

  private buildProjectConfig(
    project: { id: string; number: number; title: string; url: string },
    fields: ProjectFieldNode[],
    repository: string,
  ): Record<string, unknown> {
    // Map field names to config field IDs
    const fieldIds: Record<string, string> = {};
    for (const field of fields) {
      const configKey = FIELD_NAME_TO_CONFIG_KEY[field.name];
      if (configKey) {
        fieldIds[configKey] = field.id;
      }
    }

    // Extract status options from the native Status field
    const statusField = fields.find(f => f.name === 'Status' && f.options);
    const statusOptions: Record<string, { name: string; id: string }> = {};

    if (statusField?.options) {
      for (const option of statusField.options) {
        const key = STATUS_NAME_TO_KEY[option.name];
        if (key) {
          statusOptions[key] = { name: option.name, id: option.id };
        }
      }
    }

    // Extract option maps for all custom single-select fields
    const extractFieldOptions = (fieldName: string): Record<string, { name: string; id: string }> => {
      const field = fields.find(f => f.name === fieldName && f.options);
      const nameToKey = OPTION_NAME_TO_KEY[fieldName];
      if (!field?.options || !nameToKey) return {};

      const result: Record<string, { name: string; id: string }> = {};
      for (const option of field.options) {
        const key = nameToKey[option.name];
        if (key) {
          result[key] = { name: option.name, id: option.id };
        }
      }
      return result;
    };

    return {
      project: {
        id: project.id,
        number: project.number,
        repository,
        title: project.title,
        url: project.url,
      },
      fields: fieldIds,
      status_options: statusOptions,
      ai_suitability_options: extractFieldOptions('AI Suitability'),
      risk_level_options: extractFieldOptions('Risk Level'),
      effort_options: extractFieldOptions('Effort'),
      task_type_options: extractFieldOptions('Task Type'),
      wave_config: {
        format: 'wave-NNN-description',
        autoDetect: true,
      },
    };
  }

  private async writeConfigFiles(
    projectRoot: string,
    config: Record<string, unknown>,
  ): Promise<string> {
    const ido4Dir = path.join(projectRoot, '.ido4');
    await fs.mkdir(ido4Dir, { recursive: true });

    // Write project-info.json
    const configPath = path.join(ido4Dir, 'project-info.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Write git-workflow.json (defaults)
    const gitWorkflowPath = path.join(ido4Dir, 'git-workflow.json');
    const gitWorkflowConfig = {
      enabled: true,
      require_pr_for_review: true,
      show_git_suggestions: true,
      detect_git_context: true,
    };
    await fs.writeFile(gitWorkflowPath, JSON.stringify(gitWorkflowConfig, null, 2));

    this.logger.info('Configuration files written', { configPath, gitWorkflowPath });
    return configPath;
  }
}
