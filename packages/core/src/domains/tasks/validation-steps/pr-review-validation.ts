/**
 * PRReviewValidation — Requires N approving reviews on linked PR.
 *
 * Quality gate: checks that the pull request associated with a task
 * has the required number of approving reviews before approval.
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IRepositoryRepository, IIssueRepository } from '../../../container/interfaces.js';

export class PRReviewValidation implements ValidationStep {
  readonly name = 'PRReviewValidation';

  constructor(
    private readonly repositoryRepository: IRepositoryRepository,
    _issueRepository: IIssueRepository,
    private readonly requiredApprovals: number = 1,
  ) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const pr = await this.repositoryRepository.findPullRequestForIssue(context.issueNumber);

    if (!pr) {
      return {
        stepName: this.name,
        passed: false,
        message: `No pull request found for task #${context.issueNumber}. A reviewed PR is required for approval.`,
        severity: 'error',
      };
    }

    const reviews = await this.repositoryRepository.getPullRequestReviews(pr.number);
    const approvedReviews = reviews.filter((r) => r.state === 'APPROVED');

    if (approvedReviews.length < this.requiredApprovals) {
      return {
        stepName: this.name,
        passed: false,
        message: `PR #${pr.number} has ${approvedReviews.length} approving review(s), but ${this.requiredApprovals} required.`,
        severity: 'error',
        details: {
          prNumber: pr.number,
          approvedCount: approvedReviews.length,
          requiredApprovals: this.requiredApprovals,
          reviewers: approvedReviews.map((r) => r.author),
        },
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `PR #${pr.number} has ${approvedReviews.length} approving review(s) (${this.requiredApprovals} required)`,
      severity: 'info',
      details: {
        prNumber: pr.number,
        approvedCount: approvedReviews.length,
        reviewers: approvedReviews.map((r) => r.author),
      },
    };
  }
}
