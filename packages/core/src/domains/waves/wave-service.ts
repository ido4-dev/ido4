/**
 * WaveService — Wave management operations (implements IWaveService).
 *
 * Manages wave lifecycle: listing, status, creation, task assignment,
 * and completion validation.
 */

import type {
  IWaveService,
  IProjectRepository,
  IIssueRepository,
  IEpicValidator,
  IWorkflowConfig,
  WaveSummary,
  WaveStatusData,
  WaveCreateResult,
  WaveAssignResult,
  WaveCompletionResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import { InputSanitizer } from '../../shared/sanitizer/input-sanitizer.js';
import { ValidationError } from '../../shared/errors/index.js';

export class WaveService implements IWaveService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly issueRepository: IIssueRepository,
    private readonly epicValidator: IEpicValidator,
    private readonly workflowConfig: IWorkflowConfig,
    private readonly logger: ILogger,
  ) {}

  async listWaves(): Promise<WaveSummary[]> {
    const items = await this.projectRepository.getProjectItems();
    const waveMap = new Map<string, { total: number; completed: number }>();

    for (const item of items) {
      const wave = item.fieldValues['Wave'];
      if (!wave) continue;

      const counts = waveMap.get(wave) ?? { total: 0, completed: 0 };
      counts.total++;
      const status = item.fieldValues['Status'];
      if (status === this.workflowConfig.getStatusName('DONE')) {
        counts.completed++;
      }
      waveMap.set(wave, counts);
    }

    const summaries: WaveSummary[] = [];
    for (const [name, counts] of waveMap) {
      const completionPercentage = counts.total > 0
        ? Math.round((counts.completed / counts.total) * 100)
        : 0;

      let status: WaveSummary['status'] = 'not_started';
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

  async getWaveStatus(waveName: string): Promise<WaveStatusData> {
    return this.projectRepository.getWaveStatus(waveName);
  }

  async createWave(name: string, description?: string): Promise<WaveCreateResult> {
    const waveResult = InputSanitizer.validateWaveFormat(name);
    if (!waveResult.valid) {
      throw new ValidationError({
        message: waveResult.error ?? 'Invalid wave name format',
        context: { field: 'waveName', value: name },
      });
    }

    // Check uniqueness
    const existingWaves = await this.listWaves();
    const exists = existingWaves.some((w) => w.name === name);
    if (exists) {
      return { name, created: false };
    }

    this.logger.info('Wave created', { name, description });
    return { name, created: true };
  }

  async assignTaskToWave(issueNumber: number, waveName: string): Promise<WaveAssignResult> {
    const waveResult = InputSanitizer.validateWaveFormat(waveName);
    if (!waveResult.valid) {
      throw new ValidationError({
        message: waveResult.error ?? 'Invalid wave name format',
        context: { field: 'waveName', value: waveName },
      });
    }

    await this.issueRepository.updateTaskWave(issueNumber, waveName);

    const epicIntegrity = await this.epicValidator.validateWaveAssignmentEpicIntegrity(
      issueNumber,
      waveName,
    );

    this.logger.info('Task assigned to wave', {
      issueNumber,
      waveName,
      epicIntegrityMaintained: epicIntegrity.maintained,
    });

    return {
      issueNumber,
      wave: waveName,
      epicIntegrity,
    };
  }

  async validateWaveCompletion(waveName: string): Promise<WaveCompletionResult> {
    const waveStatus = await this.projectRepository.getWaveStatus(waveName);
    const doneName = this.workflowConfig.getStatusName('DONE');

    const nonDoneTasks = waveStatus.tasks.filter((t) => t.status !== doneName);
    const canComplete = nonDoneTasks.length === 0 && waveStatus.tasks.length > 0;

    const reasons: string[] = [];
    if (waveStatus.tasks.length === 0) {
      reasons.push('Wave has no tasks');
    }
    for (const task of nonDoneTasks) {
      reasons.push(`Task #${task.number} "${task.title}" is ${task.status}`);
    }

    return {
      wave: waveName,
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
