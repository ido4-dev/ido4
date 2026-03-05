/**
 * EpicValidator — Implements IEpicValidator for wave assignment epic integrity checks.
 *
 * Validates that assigning a task to a wave doesn't violate Epic Integrity
 * (Unbreakable Principle #1: all tasks in an epic MUST be in the same wave).
 */

import type {
  IEpicValidator,
  IEpicService,
  IIssueRepository,
  EpicIntegrityResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';

export class EpicValidator implements IEpicValidator {
  constructor(
    private readonly epicService: IEpicService,
    private readonly issueRepository: IIssueRepository,
    private readonly logger: ILogger,
  ) {}

  async validateWaveAssignmentEpicIntegrity(
    issueNumber: number,
    waveName: string,
  ): Promise<EpicIntegrityResult> {
    const task = await this.issueRepository.getTask(issueNumber);

    if (!task.epic) {
      return { maintained: true, violations: [] };
    }

    const epicTasks = await this.epicService.getTasksInEpic(task.epic);

    // Simulate: what would the wave set look like if this task were assigned to waveName?
    const waves = new Set<string>();
    for (const t of epicTasks) {
      if (t.number === issueNumber) {
        // Use the proposed wave for this task
        if (waveName) waves.add(waveName);
      } else if (t.wave) {
        waves.add(t.wave);
      }
    }

    if (waves.size <= 1) {
      return { maintained: true, violations: [] };
    }

    const waveList = [...waves];
    const violations = [
      `Assigning task #${issueNumber} to wave "${waveName}" would split epic "${task.epic}" across waves: ${waveList.join(', ')}`,
    ];

    this.logger.debug('Wave assignment would violate epic integrity', {
      issueNumber,
      waveName,
      epicName: task.epic,
      waves: waveList,
    });

    return { maintained: false, violations };
  }
}
