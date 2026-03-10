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
  TaskData,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import type { MethodologyProfile, SameContainerRule } from '../../profiles/types.js';

export class IntegrityValidator implements IIntegrityValidator {
  constructor(
    private readonly epicService: IEpicService,
    private readonly issueRepository: IIssueRepository,
    private readonly profile: MethodologyProfile,
    private readonly logger: ILogger,
  ) {}

  async validateAssignmentIntegrity(
    issueNumber: number,
    containerName: string,
  ): Promise<IntegrityResult> {
    const task = await this.issueRepository.getTask(issueNumber);

    // Find all same-container integrity rules from the profile
    const sameContainerRules = this.profile.integrityRules.filter(
      (r): r is SameContainerRule => r.type === 'same-container',
    );

    const allViolations: string[] = [];

    for (const rule of sameContainerRules) {
      const violations = await this.checkSameContainerRule(rule, task, issueNumber, containerName);
      allViolations.push(...violations);
    }

    if (allViolations.length === 0) {
      return { maintained: true, violations: [] };
    }

    return { maintained: false, violations: allViolations };
  }

  private async checkSameContainerRule(
    rule: SameContainerRule,
    task: TaskData,
    issueNumber: number,
    containerName: string,
  ): Promise<string[]> {
    const groupByValue = task.containers[rule.groupBy];
    if (!groupByValue) {
      return []; // Task not in the groupBy container — rule doesn't apply
    }

    const epicTasks = await this.epicService.getTasksInEpic(groupByValue);

    // Simulate: what would the mustMatch container set look like if this task were assigned?
    const mustMatchValues = new Set<string>();
    for (const t of epicTasks) {
      if (t.number === issueNumber) {
        if (containerName) mustMatchValues.add(containerName);
      } else {
        const value = t.containers[rule.mustMatch];
        if (value) mustMatchValues.add(value);
      }
    }

    if (mustMatchValues.size <= 1) {
      return [];
    }

    const containerList = [...mustMatchValues];
    this.logger.debug('Container assignment would violate integrity', {
      issueNumber,
      containerName,
      ruleId: rule.id,
      groupBy: groupByValue,
      containers: containerList,
    });

    return [
      `Assigning task #${issueNumber} to container "${containerName}" would split ${rule.groupBy} "${groupByValue}" across containers: ${containerList.join(', ')}`,
    ];
  }
}
