/**
 * TestCoverageValidation — Checks GitHub status checks for coverage.
 *
 * Quality gate: verifies the PR's last commit has a passing coverage check.
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IRepositoryRepository, IIssueRepository } from '../../../container/interfaces.js';

export class TestCoverageValidation implements ValidationStep {
  readonly name = 'TestCoverageValidation';

  constructor(
    private readonly repositoryRepository: IRepositoryRepository,
    _issueRepository: IIssueRepository,
    private readonly coverageCheckName: string = 'coverage',
  ) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const pr = await this.repositoryRepository.findPullRequestForIssue(context.issueNumber);

    if (!pr) {
      return {
        stepName: this.name,
        passed: false,
        message: `No pull request found for task #${context.issueNumber}. A PR with passing tests is required.`,
        severity: 'error',
      };
    }

    const checks = await this.repositoryRepository.getCommitStatusChecks(pr.number);

    // Find coverage check by name (case-insensitive partial match)
    const coverageCheck = checks.find((c) =>
      c.name.toLowerCase().includes(this.coverageCheckName.toLowerCase()),
    );

    if (!coverageCheck) {
      return {
        stepName: this.name,
        passed: false,
        message: `No "${this.coverageCheckName}" status check found on PR #${pr.number}.`,
        severity: 'warning',
        details: {
          prNumber: pr.number,
          availableChecks: checks.map((c) => c.name),
        },
      };
    }

    const isPassing = coverageCheck.conclusion === 'SUCCESS' ||
      coverageCheck.state === 'SUCCESS' ||
      coverageCheck.conclusion === 'NEUTRAL';

    if (!isPassing) {
      return {
        stepName: this.name,
        passed: false,
        message: `Coverage check "${coverageCheck.name}" is not passing (state: ${coverageCheck.conclusion ?? coverageCheck.state})`,
        severity: 'error',
        details: {
          prNumber: pr.number,
          checkName: coverageCheck.name,
          state: coverageCheck.state,
          conclusion: coverageCheck.conclusion,
        },
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `Coverage check "${coverageCheck.name}" is passing on PR #${pr.number}`,
      severity: 'info',
    };
  }
}
