import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IRepositoryRepository } from '../../../container/interfaces.js';

/** Validates a PR exists when git workflow requires it for review. */
export class ImplementationReadinessValidation implements ValidationStep {
  readonly name = 'ImplementationReadinessValidation';

  constructor(private readonly repositoryRepository: IRepositoryRepository) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    // Only check if git workflow requires PR for review
    if (!context.gitWorkflowConfig?.requiresPRForReview()) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Git workflow does not require PR for review',
        severity: 'info',
      };
    }

    const pr = await this.repositoryRepository.findPullRequestForIssue(context.issueNumber);

    if (!pr) {
      return {
        stepName: this.name,
        passed: false,
        message: `No pull request found for task #${context.issueNumber}. Create a PR before requesting review.`,
        severity: 'error',
      };
    }

    if (pr.state !== 'OPEN') {
      return {
        stepName: this.name,
        passed: false,
        message: `Pull request #${pr.number} is not open (state: ${pr.state})`,
        severity: 'error',
        details: { prNumber: pr.number, prState: pr.state },
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `Pull request #${pr.number} is open and ready for review`,
      severity: 'info',
      details: { prNumber: pr.number, prUrl: pr.url },
    };
  }
}
