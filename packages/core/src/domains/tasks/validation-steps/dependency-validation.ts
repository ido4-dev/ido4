import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IIssueRepository } from '../../../container/interfaces.js';
import { WORKFLOW_STATUSES } from '../types.js';

/** Validates all dependencies are Done before a task can start. */
export class DependencyValidation implements ValidationStep {
  readonly name = 'DependencyValidation';

  constructor(private readonly issueRepository: IIssueRepository) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const depsText = context.task.dependencies;
    if (!depsText || depsText.trim() === '' || depsText.toLowerCase().includes('no dependencies')) {
      return {
        stepName: this.name,
        passed: true,
        message: 'No dependencies to validate',
        severity: 'info',
      };
    }

    // Parse dependency numbers
    const depNumbers: number[] = [];
    const regex = /(?<!\w)#?(\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(depsText)) !== null) {
      const num = parseInt(match[1]!, 10);
      if (num > 0) depNumbers.push(num);
    }

    if (depNumbers.length === 0) {
      return {
        stepName: this.name,
        passed: true,
        message: 'No parseable dependencies found',
        severity: 'info',
      };
    }

    // Fetch all dependency statuses in parallel
    const results = await Promise.all(
      depNumbers.map(async (num) => {
        try {
          const task = await this.issueRepository.getTask(num);
          return { number: num, title: task.title, status: task.status, found: true };
        } catch {
          return { number: num, title: '', status: '', found: false };
        }
      }),
    );

    const incomplete = results.filter(
      (r) => !r.found || r.status !== WORKFLOW_STATUSES.DONE,
    );

    if (incomplete.length === 0) {
      return {
        stepName: this.name,
        passed: true,
        message: `All ${depNumbers.length} dependencies are completed`,
        severity: 'info',
      };
    }

    const details = incomplete.map(
      (r) => r.found ? `#${r.number} "${r.title}" (${r.status})` : `#${r.number} (not found)`,
    );

    return {
      stepName: this.name,
      passed: false,
      message: `${incomplete.length} dependency(ies) not completed: ${details.join(', ')}`,
      severity: 'error',
      details: { incomplete: incomplete.map((r) => r.number) },
    };
  }
}
