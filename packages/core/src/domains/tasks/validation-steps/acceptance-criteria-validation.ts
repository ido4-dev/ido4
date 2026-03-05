import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';

const AC_MARKERS = [
  /given\s+.+\s+when\s+.+\s+then/i,
  /acceptance\s+criteria/i,
  /definition\s+of\s+done/i,
  /should\s+be\s+able\s+to/i,
  /must\s+/i,
  /expected\s+behavior/i,
  /\[ \]/,  // Checkbox pattern
];

const MIN_DESCRIPTION_LENGTH = 100;

export class AcceptanceCriteriaValidation implements ValidationStep {
  readonly name = 'AcceptanceCriteriaValidation';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const body = context.task.body ?? '';

    if (body.length < MIN_DESCRIPTION_LENGTH) {
      return {
        stepName: this.name,
        passed: false,
        message: `Task description is too short (${body.length} chars, minimum ${MIN_DESCRIPTION_LENGTH}). Add acceptance criteria or a Definition of Done.`,
        severity: 'warning',
      };
    }

    const hasMultipleLines = body.split('\n').filter((l) => l.trim().length > 0).length >= 2;
    if (!hasMultipleLines) {
      return {
        stepName: this.name,
        passed: false,
        message: 'Task description should have multiple lines with structured acceptance criteria',
        severity: 'warning',
      };
    }

    const hasACMarker = AC_MARKERS.some((marker) => marker.test(body));
    if (!hasACMarker) {
      return {
        stepName: this.name,
        passed: true,
        message: 'Task description is present but no standard acceptance criteria markers found. Consider using Given/When/Then or checkbox patterns.',
        severity: 'warning',
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: 'Acceptance criteria are present',
      severity: 'info',
    };
  }
}
