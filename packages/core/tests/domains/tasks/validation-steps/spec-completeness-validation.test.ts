import { describe, it, expect } from 'vitest';
import { SpecCompletenessValidation } from '../../../../src/domains/tasks/validation-steps/spec-completeness-validation.js';
import type { ValidationContext } from '../../../../src/domains/tasks/types.js';
import type { StepDependencies } from '../../../../src/domains/tasks/validation-step-registry.js';
import { createMockTaskData, createMockProjectConfig, createMockWorkflowConfig } from '../../../helpers/mock-factories.js';
import { HYDRO_PROFILE } from '../../../../src/profiles/hydro.js';
import { SCRUM_PROFILE } from '../../../../src/profiles/scrum.js';
import { SHAPE_UP_PROFILE } from '../../../../src/profiles/shape-up.js';

function createDeps(profileOverride?: StepDependencies['profile']): StepDependencies {
  return {
    issueRepository: {} as StepDependencies['issueRepository'],
    integrityValidator: {} as StepDependencies['integrityValidator'],
    repositoryRepository: {} as StepDependencies['repositoryRepository'],
    projectConfig: {} as StepDependencies['projectConfig'],
    workflowConfig: {} as StepDependencies['workflowConfig'],
    gitWorkflowConfig: {} as StepDependencies['gitWorkflowConfig'],
    profile: profileOverride ?? HYDRO_PROFILE,
  };
}

function createContext(bodyOverride: string): ValidationContext {
  return {
    issueNumber: 42,
    transition: 'ready',
    task: createMockTaskData({ body: bodyOverride }),
    config: createMockProjectConfig(),
    workflowConfig: createMockWorkflowConfig(),
  };
}

const SUBSTANTIVE_BODY = `## Acceptance Criteria

- The system must validate user input against the schema
- Error messages must include field name and constraint violated
- Valid submissions must return a 200 response with the created resource

## Implementation Notes

Use the existing validation middleware from the auth module. Follow the error handling pattern established in #38.`;

const LONG_UNSTRUCTURED_BODY = `This is a very long task description that does not have any structured content or markers whatsoever.
It continues with another line of plain text that provides no structure to the specification at all.
Yet another line of unstructured prose that simply describes things without any formatting or patterns.
And one final line to make sure the body is long enough to pass the length check but still has zero markers.`;

describe('SpecCompletenessValidation', () => {
  describe('body length check', () => {
    it('rejects body shorter than 200 characters', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext('Short body that is not detailed enough');

      const result = await step.validate(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('Specification incomplete');
      expect(result.message).toContain('characters');
    });

    it('rejects empty body', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext('');

      const result = await step.validate(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('rejects null body', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx: ValidationContext = {
        issueNumber: 42,
        transition: 'ready',
        task: createMockTaskData({ body: undefined as unknown as string }),
        config: createMockProjectConfig(),
        workflowConfig: createMockWorkflowConfig(),
      };

      const result = await step.validate(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
    });
  });

  describe('substantive lines check', () => {
    it('rejects body with fewer than 3 substantive lines', async () => {
      // Long enough but only 1 substantive line
      const body = 'A'.repeat(250);
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('substantive lines');
    });
  });

  describe('structured content check', () => {
    it('rejects long unstructured body with no markers', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext(LONG_UNSTRUCTURED_BODY);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('error');
      expect(result.message).toContain('no structured content markers');
    });

    it('passes body with markdown headers', async () => {
      const body = `## Requirements

This is a detailed specification for the feature.

### Database Changes

We need to add a new column to the users table for storing the preference data.

### API Changes

Add a new endpoint GET /api/preferences that returns the user preferences.`;
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
    });

    it('passes body with bullet lists', async () => {
      const body = `Feature requirements for the new dashboard component:

- Display active tasks grouped by container
- Show completion percentage for each container
- Support filtering by status and assignee
- Real-time updates via WebSocket connection

The component should follow the existing design system patterns and use the shared data fetching hooks.`;
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });

    it('passes body with checkboxes', async () => {
      const body = `Task specification with acceptance criteria:

- [ ] User can submit the form with valid data
- [ ] Validation errors are displayed inline
- [ ] Success message appears after submission
- [ ] Data is persisted to the database correctly

The form must follow the accessibility guidelines from the design system.`;
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });
  });

  describe('AC markers for Hydro profile', () => {
    it('passes body with Given/When/Then pattern', async () => {
      const body = `User authentication flow specification:

Given a user with valid credentials
When they submit the login form
Then they should be redirected to the dashboard with a valid session

Additional implementation details including error handling and rate limiting must follow the patterns from the auth module.`;
      const step = new SpecCompletenessValidation(undefined, createDeps(HYDRO_PROFILE));
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });

    it('passes body with acceptance criteria heading', async () => {
      const body = `New feature implementation for data export.

Acceptance Criteria:
The export must support CSV and JSON formats.
Large datasets should be streamed rather than buffered.
The exported file must include all visible columns.

Error handling should follow the existing patterns from the reporting module.`;
      const step = new SpecCompletenessValidation(undefined, createDeps(HYDRO_PROFILE));
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });

    it('includes Hydro remediation message on failure', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps(HYDRO_PROFILE));
      const ctx = createContext('too short');

      const result = await step.validate(ctx);

      expect(result.message).toContain('acceptance criteria');
      expect(result.message).toContain('Defer to human operator');
    });
  });

  describe('AC markers for Scrum profile', () => {
    it('passes body with must keyword', async () => {
      const body = `User story implementation for the checkout flow:

The checkout page must display the order summary before payment.
The system must validate the shipping address format.
Payment processing must timeout after 30 seconds with a clear error message.

Story points: 5. This is part of the Sprint Goal for checkout completion.`;
      const step = new SpecCompletenessValidation(undefined, createDeps(SCRUM_PROFILE));
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });

    it('includes Scrum remediation message on failure', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps(SCRUM_PROFILE));
      const ctx = createContext('too short');

      const result = await step.validate(ctx);

      expect(result.message).toContain('sprint-ready');
      expect(result.message).toContain('Defer to human operator');
    });
  });

  describe('pitch markers for Shape Up profile', () => {
    it('passes body with pitch markers (appetite, rabbit hole)', async () => {
      const body = `Search redesign pitch summary:

Problem: Users cannot find items when the catalog grows beyond 1000 products.
Solution: Implement faceted search with category filters.
Appetite: 4 weeks maximum.

Rabbit hole: Do not implement fuzzy matching or auto-complete at this stage.
No-go: Custom ranking algorithms are out of scope for this bet.`;
      const step = new SpecCompletenessValidation(undefined, createDeps(SHAPE_UP_PROFILE));
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });

    it('passes body with scope marker', async () => {
      const body = `Dashboard overhaul for the analytics module:

The scope of this task covers the chart rendering pipeline only.
We will replace the existing charting library with a lighter alternative.
The data fetching layer is out of scope and will be handled separately.

Implementation should follow the component patterns from the existing design system.`;
      const step = new SpecCompletenessValidation(undefined, createDeps(SHAPE_UP_PROFILE));
      const ctx = createContext(body);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
    });

    it('includes Shape Up remediation message on failure', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps(SHAPE_UP_PROFILE));
      const ctx = createContext('too short');

      const result = await step.validate(ctx);

      expect(result.message).toContain('shaped pitch');
      expect(result.message).toContain('Defer to human operator');
    });
  });

  describe('passing cases', () => {
    it('passes a well-structured substantive body', async () => {
      const step = new SpecCompletenessValidation(undefined, createDeps());
      const ctx = createContext(SUBSTANTIVE_BODY);

      const result = await step.validate(ctx);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
      expect(result.message).toContain('passed');
    });
  });

  describe('step metadata', () => {
    it('has correct name', () => {
      const step = new SpecCompletenessValidation(undefined, createDeps());
      expect(step.name).toBe('SpecCompletenessValidation');
    });
  });
});
