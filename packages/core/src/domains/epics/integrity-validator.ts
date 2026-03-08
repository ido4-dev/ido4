/**
 * IntegrityValidator — Implements IIntegrityValidator for container assignment integrity checks.
 *
 * Validates that assigning a task to a container doesn't violate integrity rules
 * (e.g., Epic Integrity: all tasks in an epic MUST be in the same container).
 */

import type {
  IIntegrityValidator,
  IEpicService,
  IIssueRepository,
  IntegrityResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';

export class IntegrityValidator implements IIntegrityValidator {
  constructor(
    private readonly epicService: IEpicService,
    private readonly issueRepository: IIssueRepository,
    private readonly logger: ILogger,
  ) {}

  async validateAssignmentIntegrity(
    issueNumber: number,
    containerName: string,
  ): Promise<IntegrityResult> {
    const task = await this.issueRepository.getTask(issueNumber);

    if (!task.epic) {
      return { maintained: true, violations: [] };
    }

    const epicTasks = await this.epicService.getTasksInEpic(task.epic);

    // Simulate: what would the container set look like if this task were assigned?
    const containers = new Set<string>();
    for (const t of epicTasks) {
      if (t.number === issueNumber) {
        if (containerName) containers.add(containerName);
      } else if (t.wave) {
        containers.add(t.wave);
      }
    }

    if (containers.size <= 1) {
      return { maintained: true, violations: [] };
    }

    const containerList = [...containers];
    const violations = [
      `Assigning task #${issueNumber} to container "${containerName}" would split epic "${task.epic}" across containers: ${containerList.join(', ')}`,
    ];

    this.logger.debug('Container assignment would violate integrity', {
      issueNumber,
      containerName,
      epicName: task.epic,
      containers: containerList,
    });

    return { maintained: false, violations };
  }
}
