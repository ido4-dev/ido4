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
  OPTION_NAME_TO_KEY,
  buildStatusOptionsForProfile,
  buildStatusNameToKeyForProfile,
} from '../../infrastructure/github/queries/project-init-queries.js';
import type {
  RepositoryOwnerResponse,
  CreateProjectResponse,
  CreateFieldTextResponse,
  CreateFieldSingleSelectResponse,
  UpdateFieldSingleSelectResponse,
  GetProjectWithFieldsResponse,
  ProjectFieldNode,
  FieldOptionInput,
} from '../../infrastructure/github/queries/project-init-queries.js';
import type { MethodologyProfile } from '../../profiles/types.js';

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
  private readonly profile: MethodologyProfile;

  constructor(
    private readonly graphqlClient: IGraphQLClient,
    private readonly logger: ILogger,
    profile: MethodologyProfile,
  ) {
    this.profile = profile;
  }

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

    // 7. Inject AI assistant onboarding
    await this.injectAssistantOnboarding(options.projectRoot, projectUrl);

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

    // Determine text fields from profile container definitions
    const textFields = [...this.profile.containers.map(c => c.taskField), 'Dependencies', 'AI Context'];

    // Create text fields
    for (const fieldName of textFields) {
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

    // Build status options from the profile's state definitions
    const statusOptions: FieldOptionInput[] = buildStatusOptionsForProfile(this.profile);

    // Update the Status field with the resolved options
    await this.graphqlClient.mutate<UpdateFieldSingleSelectResponse>(
      UPDATE_FIELD_SINGLE_SELECT,
      {
        fieldId: statusField.id,
        options: statusOptions,
      },
    );

    this.logger.info('Status field configured', {
      fieldId: statusField.id,
      options: statusOptions.map(o => o.name),
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
    // Build field name → config key mapping from profile containers
    const fieldNameToConfigKey: Record<string, string> = { ...FIELD_NAME_TO_CONFIG_KEY };
    for (const container of this.profile.containers) {
      fieldNameToConfigKey[container.taskField] = `${container.id}_field_id`;
    }

    // Map field names to config field IDs
    const fieldIds: Record<string, string> = {};
    for (const field of fields) {
      const configKey = fieldNameToConfigKey[field.name];
      if (configKey) {
        fieldIds[configKey] = field.id;
      }
    }

    // Resolve status name → key mapping from profile
    const statusNameToKey = buildStatusNameToKeyForProfile(this.profile);

    // Extract status options from the native Status field
    const statusField = fields.find(f => f.name === 'Status' && f.options);
    const statusOptions: Record<string, { name: string; id: string }> = {};

    if (statusField?.options) {
      for (const option of statusField.options) {
        const key = statusNameToKey[option.name];
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

    // Write methodology-profile.json
    const profilePath = path.join(ido4Dir, 'methodology-profile.json');
    await fs.writeFile(profilePath, JSON.stringify({ id: this.profile.id, extends: this.profile.id }, null, 2));
    this.logger.info('Methodology profile written', { profilePath, profileId: this.profile.id });

    this.logger.info('Configuration files written', { configPath, gitWorkflowPath });
    return configPath;
  }

  /**
   * Inject ido4 governance section into the project's CLAUDE.md.
   * - If CLAUDE.md doesn't exist, creates it with the ido4 section
   * - If it exists but has no ido4 section, appends it
   * - If it exists with an ido4 section, updates it in place
   * Also writes canonical .ido4/assistant-onboarding.md for multi-environment support.
   */
  private async injectAssistantOnboarding(projectRoot: string, projectUrl: string): Promise<void> {
    const section = this.buildIdo4Section(projectUrl);

    // Always write canonical version
    const ido4Dir = path.join(projectRoot, '.ido4');
    await fs.writeFile(path.join(ido4Dir, 'assistant-onboarding.md'), section, 'utf-8');

    // Inject into CLAUDE.md
    const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
    const SECTION_START = '## ido4 Development Governance';
    const SECTION_END = '<!-- /ido4 -->';

    let content: string;
    try {
      content = await fs.readFile(claudeMdPath, 'utf-8');

      const startIdx = content.indexOf(SECTION_START);
      const endIdx = content.indexOf(SECTION_END);

      if (startIdx !== -1 && endIdx !== -1) {
        // Replace existing section (including end marker)
        content = content.substring(0, startIdx) + section + content.substring(endIdx + SECTION_END.length);
      } else if (startIdx !== -1) {
        // Start marker found but no end marker — replace from start to EOF
        content = content.substring(0, startIdx) + section;
      } else {
        // No ido4 section — append
        content = content.trimEnd() + '\n\n' + section;
      }
    } catch {
      // File doesn't exist — create with ido4 section only
      content = section;
    }

    await fs.writeFile(claudeMdPath, content, 'utf-8');
    this.logger.info('AI assistant onboarding injected', { claudeMdPath });
  }

  private buildIdo4Section(projectUrl: string): string {
    const profile = this.profile;

    // Find primary execution container (managed with completion rule)
    const primaryContainer = profile.containers.find(c => c.managed) ?? profile.containers[0];
    const containerLabel = primaryContainer?.id ?? 'container';
    const containerSingular = primaryContainer?.singular ?? 'Container';

    // Work item label
    const itemLabel = profile.workItems.primary.singular.toLowerCase();

    // Build principles list
    const principlesList = profile.principles
      .map(p => `- **${p.name}**: ${p.description}`)
      .join('\n');

    // Build container structure
    const containerStructure = profile.containers
      .map(c => `- **${c.singular}**: ${c.managed ? 'Execution' : 'Grouping'} container`)
      .join('\n');

    return `## ido4 Development Governance

This project uses **ido4** for specs-driven development governance (${profile.name} methodology).

### Workflow

1. **Check the board** before starting work: use the \`get_${containerLabel}_status\` tool or the \`/ido4:board\` skill
2. **Pick your next ${itemLabel}**: use \`get_next_task\` for a scored recommendation, or check the board
3. **Start work**: call \`start_task\` — read the full briefing (spec, dependencies, downstream needs) before writing code
4. **Work from the spec**: the GitHub issue body IS the specification — read it completely, understand acceptance criteria
5. **Write context**: add comments on the issue at key decisions (what you decided, why, what interfaces you created)
6. **Complete work**: verify acceptance criteria are met, tests pass, then call \`approve_task\`

### Principles

${principlesList}

These are non-negotiable governance rules enforced by the Business Rule Engine (BRE).

### ${containerSingular} Structure

${containerStructure}

### Available Skills

- \`/ido4:standup\` — Governance-aware briefing with risk detection
- \`/ido4:board\` — Flow intelligence and bottleneck analysis
- \`/ido4:compliance\` — Governance audit with quantitative scoring
- \`/ido4:health\` — Quick health check (RED/YELLOW/GREEN)
- \`/ido4:plan-${containerLabel}\` — ${containerSingular} composition with principle validation
- \`/ido4:retro-${containerLabel}\` — ${containerSingular} retrospective with data-backed analysis

### Configuration

- **Methodology**: ${profile.name} (\`.ido4/methodology-profile.json\`)
- **Project**: [GitHub Project](${projectUrl})
- **Audit trail**: \`.ido4/audit-log.jsonl\` (immutable governance events)
<!-- /ido4 -->`;
  }
}
