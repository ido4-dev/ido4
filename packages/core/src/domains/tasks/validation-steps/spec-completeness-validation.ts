/**
 * SpecCompletenessValidation — Blocks transitions when specs are inadequate.
 *
 * ERROR severity — refinement gates must guarantee spec quality so that
 * downstream execute prompts can assume good specs and focus on reasoning.
 *
 * Detection logic (3 checks, all must pass):
 * 1. Body length >= 200 chars (a real spec is a paragraph+)
 * 2. Substantive lines: >= 3 lines with >10 chars each
 * 3. Structured content: at least one marker (methodology-specific)
 *
 * Requires: profile in StepDependencies (for methodology-aware marker detection).
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { StepDependencies } from '../validation-step-registry.js';

const MIN_BODY_LENGTH = 200;
const MIN_SUBSTANTIVE_LINES = 3;
const MIN_LINE_LENGTH = 10;

/** Generic structural markers — all profiles */
const GENERIC_MARKERS = [
  /^#{1,6}\s+/m,          // markdown headers
  /^\d+\.\s+/m,           // numbered lists
  /^[-*]\s+/m,            // bullet lists
  /^- \[[ x]\]/m,         // checkboxes
  /```/,                  // code blocks
];

/** AC markers for Hydro and Scrum */
const AC_MARKERS = [
  /given\s+.+\s+when\s+.+\s+then/i,
  /acceptance\s+criteria/i,
  /\bmust\b/i,
  /expected\s+behavior/i,
  /^- \[[ x]\]/m,         // checkboxes (also AC in practice)
];

/** Pitch markers for Shape Up */
const PITCH_MARKERS = [
  /\bappetite\b/i,
  /\brabbit\s+hole\b/i,
  /\bno-go\b/i,
  /\bproblem\b/i,
  /\bsolution\b/i,
  /\bscope\b/i,
  /\bpitch\b/i,
];

export class SpecCompletenessValidation implements ValidationStep {
  readonly name = 'SpecCompletenessValidation';

  constructor(
    _param: string | undefined,
    private readonly deps: StepDependencies,
  ) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const body = context.task.body ?? '';
    const profileId = this.deps.profile.id;

    // Check 1: Body length
    if (body.length < MIN_BODY_LENGTH) {
      return {
        stepName: this.name,
        passed: false,
        message: `Specification incomplete: body is ${body.length} characters (minimum ${MIN_BODY_LENGTH}). ${this.getRemediationMessage(profileId)}`,
        severity: 'error',
      };
    }

    // Check 2: Substantive lines (>10 chars each, need >= 3)
    const substantiveLines = body.split('\n').filter((l) => l.trim().length > MIN_LINE_LENGTH);
    if (substantiveLines.length < MIN_SUBSTANTIVE_LINES) {
      return {
        stepName: this.name,
        passed: false,
        message: `Specification incomplete: only ${substantiveLines.length} substantive lines (minimum ${MIN_SUBSTANTIVE_LINES}). The spec needs structured detail, not a single paragraph. ${this.getRemediationMessage(profileId)}`,
        severity: 'error',
      };
    }

    // Check 3: Structured content markers (methodology-specific)
    if (!this.hasStructuredContent(body, profileId)) {
      return {
        stepName: this.name,
        passed: false,
        message: `Specification incomplete: no structured content markers found. ${this.getRemediationMessage(profileId)}`,
        severity: 'error',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Specification completeness check passed',
      severity: 'info',
    };
  }

  private hasStructuredContent(body: string, profileId: string): boolean {
    // Generic markers apply to all profiles
    if (GENERIC_MARKERS.some((m) => m.test(body))) {
      return true;
    }

    // Methodology-specific markers
    if (profileId === 'shape-up') {
      return PITCH_MARKERS.some((m) => m.test(body));
    }

    // Hydro, Scrum, and any other profile: AC markers
    return AC_MARKERS.some((m) => m.test(body));
  }

  private getRemediationMessage(profileId: string): string {
    if (profileId === 'shape-up') {
      return 'A shaped pitch must include: problem statement, solution direction, appetite, rabbit holes, and no-gos. Defer to human operator for spec completion before proceeding.';
    }
    if (profileId === 'scrum') {
      return 'A sprint-ready item must include: acceptance criteria (Given/When/Then or checklist), effort estimate, and clear definition of done. Defer to human operator for spec completion before proceeding.';
    }
    // Hydro and others
    return 'A development-ready spec must include: acceptance criteria, structured requirements (headers, checklists), and clear expected behavior. Defer to human operator for spec completion before proceeding.';
  }
}
