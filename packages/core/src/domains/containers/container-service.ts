/**
 * ContainerService — Container management operations (implements IContainerService).
 *
 * Manages container lifecycle: listing, status, creation, task assignment,
 * and completion validation.
 */

import type {
  IContainerService,
  IProjectRepository,
  IIssueRepository,
  IIntegrityValidator,
  IWorkflowConfig,
  ContainerSummary,
  ContainerStatusData,
  ContainerCreateResult,
  ContainerAssignResult,
  ContainerCompletionResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import { InputSanitizer } from '../../shared/sanitizer/input-sanitizer.js';
import { ValidationError } from '../../shared/errors/index.js';

export class ContainerService implements IContainerService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly issueRepository: IIssueRepository,
    private readonly integrityValidator: IIntegrityValidator,
    private readonly workflowConfig: IWorkflowConfig,
    private readonly logger: ILogger,
  ) {}

  async listContainers(): Promise<ContainerSummary[]> {
    const items = await this.projectRepository.getProjectItems();
    const containerMap = new Map<string, { total: number; completed: number }>();

    for (const item of items) {
      const container = item.fieldValues['Wave'];
      if (!container) continue;

      const counts = containerMap.get(container) ?? { total: 0, completed: 0 };
      counts.total++;
      const status = item.fieldValues['Status'];
      if (status === this.workflowConfig.getStatusName('DONE')) {
        counts.completed++;
      }
      containerMap.set(container, counts);
    }

    const summaries: ContainerSummary[] = [];
    for (const [name, counts] of containerMap) {
      const completionPercentage = counts.total > 0
        ? Math.round((counts.completed / counts.total) * 100)
        : 0;

      let status: ContainerSummary['status'] = 'not_started';
      if (counts.completed === counts.total && counts.total > 0) {
        status = 'completed';
      } else if (counts.completed > 0) {
        status = 'active';
      }

      summaries.push({
        name,
        taskCount: counts.total,
        completedCount: counts.completed,
        completionPercentage,
        status,
      });
    }

    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getContainerStatus(name: string): Promise<ContainerStatusData> {
    return this.projectRepository.getContainerStatus(name);
  }

  async createContainer(name: string, description?: string): Promise<ContainerCreateResult> {
    const formatResult = InputSanitizer.validateContainerFormat(name);
    if (!formatResult.valid) {
      throw new ValidationError({
        message: formatResult.error ?? 'Invalid container name format',
        context: { field: 'containerName', value: name },
      });
    }

    // Check uniqueness
    const existing = await this.listContainers();
    const exists = existing.some((c) => c.name === name);
    if (exists) {
      return { name, created: false };
    }

    this.logger.info('Container created', { name, description });
    return { name, created: true };
  }

  async assignTaskToContainer(issueNumber: number, containerName: string): Promise<ContainerAssignResult> {
    const formatResult = InputSanitizer.validateContainerFormat(containerName);
    if (!formatResult.valid) {
      throw new ValidationError({
        message: formatResult.error ?? 'Invalid container name format',
        context: { field: 'containerName', value: containerName },
      });
    }

    await this.issueRepository.updateTaskContainer(issueNumber, containerName);

    const integrity = await this.integrityValidator.validateAssignmentIntegrity(
      issueNumber,
      containerName,
    );

    this.logger.info('Task assigned to container', {
      issueNumber,
      containerName,
      integrityMaintained: integrity.maintained,
    });

    return {
      issueNumber,
      container: containerName,
      integrity,
    };
  }

  async validateContainerCompletion(name: string): Promise<ContainerCompletionResult> {
    const containerStatus = await this.projectRepository.getContainerStatus(name);
    const doneName = this.workflowConfig.getStatusName('DONE');

    const nonDoneTasks = containerStatus.tasks.filter((t) => t.status !== doneName);
    const canComplete = nonDoneTasks.length === 0 && containerStatus.tasks.length > 0;

    const reasons: string[] = [];
    if (containerStatus.tasks.length === 0) {
      reasons.push('Container has no tasks');
    }
    for (const task of nonDoneTasks) {
      reasons.push(`Task #${task.number} "${task.title}" is ${task.status}`);
    }

    return {
      container: name,
      canComplete,
      reasons,
      tasks: nonDoneTasks.map((t) => ({
        number: t.number,
        title: t.title,
        status: t.status,
      })),
    };
  }
}
