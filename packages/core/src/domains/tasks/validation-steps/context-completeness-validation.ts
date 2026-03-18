/**
 * ContextCompletenessValidation — Blocks approval when no context comments exist.
 *
 * ERROR severity — agents must leave a knowledge trail before work is considered done.
 * Without context comments, the next agent starts from zero.
 *
 * Detection logic:
 * 1. Fetch issue comments via issueRepository
 * 2. Parse for ido4:context blocks (structured context markers)
 * 3. Require at least one block from a working transition (start, review, or equivalent)
 * 4. Require the context body to be >= 50 characters (prevents "Done." phoning-it-in)
 *
 * Uses: deps.issueRepository (same pattern as SubtaskCompletionValidation).
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { StepDependencies } from '../validation-step-registry.js';
import { parseIdo4ContextComments } from '../../../shared/utils/context-comment-parser.js';

const MIN_CONTEXT_LENGTH = 50;

export class ContextCompletenessValidation implements ValidationStep {
  readonly name = 'ContextCompletenessValidation';

  constructor(
    _param: string | undefined,
    private readonly deps: StepDependencies,
  ) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const { issueRepository } = this.deps;

    let comments;
    try {
      comments = await issueRepository.getIssueComments(context.issueNumber);
    } catch {
      // If comments can't be fetched (e.g., network issue), skip gracefully
      return {
        stepName: this.name,
        passed: true,
        message: 'Could not fetch issue comments — context completeness check skipped',
        severity: 'info',
      };
    }

    const contextBlocks = parseIdo4ContextComments(comments);

    if (contextBlocks.length === 0) {
      return {
        stepName: this.name,
        passed: false,
        message: `No ido4 context comments found on #${context.issueNumber}. Agents must write structured context (approach, decisions, interfaces, completion summary) using the transition tool's \`context\` parameter before approval. Defer to the implementing agent to add context.`,
        severity: 'error',
      };
    }

    // Check for at least one substantive context block (>= 50 chars)
    const substantiveBlocks = contextBlocks.filter((b) => b.body.length >= MIN_CONTEXT_LENGTH);

    if (substantiveBlocks.length === 0) {
      return {
        stepName: this.name,
        passed: false,
        message: `Found ${contextBlocks.length} context comment(s) on #${context.issueNumber}, but none are substantive (minimum ${MIN_CONTEXT_LENGTH} characters). Context must describe approach, interfaces, decisions, and completion state — not just "Done."`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `${substantiveBlocks.length} substantive context comment(s) found on #${context.issueNumber}`,
      severity: 'info',
    };
  }
}
