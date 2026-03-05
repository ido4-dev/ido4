import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IIssueRepository } from '../../../container/interfaces.js';

/** Validates all sub-issues are closed before completing a task. */
export class SubtaskCompletionValidation implements ValidationStep {
  readonly name = 'SubtaskCompletionValidation';

  constructor(private readonly issueRepository: IIssueRepository) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const subIssues = await this.issueRepository.getSubIssues(context.issueNumber);

    if (subIssues.length === 0) {
      return {
        stepName: this.name,
        passed: true,
        message: 'No sub-issues to validate',
        severity: 'info',
      };
    }

    const openSubIssues = subIssues.filter((si) => si.state === 'OPEN');

    if (openSubIssues.length === 0) {
      return {
        stepName: this.name,
        passed: true,
        message: `All ${subIssues.length} sub-issues are closed`,
        severity: 'info',
      };
    }

    const openList = openSubIssues.map((si) => `#${si.number} "${si.title}"`).join(', ');

    return {
      stepName: this.name,
      passed: false,
      message: `${openSubIssues.length} of ${subIssues.length} sub-issues still open: ${openList}`,
      severity: 'error',
      details: { openSubIssues: openSubIssues.map((si) => si.number) },
    };
  }
}
