import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  TaskTransitionSchema,
  BlockTaskSchema,
  ReturnTaskSchema,
  GetTaskSchema,
  ValidateTransitionSchema,
  ValidateAllTransitionsSchema,
} from '../../src/schemas/task-schemas.js';
import {
  ContainerNameSchema,
  CreateContainerSchema,
  AssignTaskToContainerSchema,
} from '../../src/schemas/container-schemas.js';
import {
  DependencySchema,
} from '../../src/schemas/dependency-schemas.js';

function parseSchema(schema: Record<string, z.ZodType>, data: unknown) {
  return z.object(schema).safeParse(data);
}

describe('Task Schemas', () => {
  describe('TaskTransitionSchema', () => {
    it('accepts valid input with all fields', () => {
      const result = parseSchema(TaskTransitionSchema, {
        issueNumber: 42,
        message: 'Starting work',
        skipValidation: false,
        dryRun: true,
      });
      expect(result.success).toBe(true);
    });

    it('accepts minimal input (issueNumber only)', () => {
      const result = parseSchema(TaskTransitionSchema, { issueNumber: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects negative issue number', () => {
      const result = parseSchema(TaskTransitionSchema, { issueNumber: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer issue number', () => {
      const result = parseSchema(TaskTransitionSchema, { issueNumber: 1.5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing issueNumber', () => {
      const result = parseSchema(TaskTransitionSchema, {});
      expect(result.success).toBe(false);
    });
  });

  describe('BlockTaskSchema', () => {
    it('accepts valid input with reason', () => {
      const result = parseSchema(BlockTaskSchema, {
        issueNumber: 42,
        reason: 'Waiting for API access',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing reason', () => {
      const result = parseSchema(BlockTaskSchema, { issueNumber: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe('ReturnTaskSchema', () => {
    it('accepts valid input with target status and reason', () => {
      const result = parseSchema(ReturnTaskSchema, {
        issueNumber: 42,
        targetStatus: 'In Refinement',
        reason: 'Needs more detail',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing targetStatus and reason', () => {
      const result = parseSchema(ReturnTaskSchema, { issueNumber: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe('GetTaskSchema', () => {
    it('accepts issueNumber with optional field', () => {
      const result = parseSchema(GetTaskSchema, {
        issueNumber: 42,
        field: 'status',
      });
      expect(result.success).toBe(true);
    });

    it('accepts issueNumber only', () => {
      const result = parseSchema(GetTaskSchema, { issueNumber: 42 });
      expect(result.success).toBe(true);
    });
  });

  describe('ValidateTransitionSchema', () => {
    it('accepts valid input', () => {
      const result = parseSchema(ValidateTransitionSchema, {
        issueNumber: 42,
        transition: 'start',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing transition', () => {
      const result = parseSchema(ValidateTransitionSchema, { issueNumber: 42 });
      expect(result.success).toBe(false);
    });
  });

  describe('ValidateAllTransitionsSchema', () => {
    it('accepts valid input', () => {
      const result = parseSchema(ValidateAllTransitionsSchema, { issueNumber: 42 });
      expect(result.success).toBe(true);
    });
  });
});

describe('Container Schemas', () => {
  describe('ContainerNameSchema', () => {
    it('accepts valid wave name', () => {
      const result = parseSchema(ContainerNameSchema, { waveName: 'Wave 1' });
      expect(result.success).toBe(true);
    });

    it('rejects missing waveName', () => {
      const result = parseSchema(ContainerNameSchema, {});
      expect(result.success).toBe(false);
    });
  });

  describe('CreateContainerSchema', () => {
    it('accepts name with description', () => {
      const result = parseSchema(CreateContainerSchema, {
        name: 'Wave 2',
        description: 'Second wave of features',
      });
      expect(result.success).toBe(true);
    });

    it('accepts name only', () => {
      const result = parseSchema(CreateContainerSchema, { name: 'Wave 2' });
      expect(result.success).toBe(true);
    });
  });

  describe('AssignTaskToContainerSchema', () => {
    it('accepts valid assignment', () => {
      const result = parseSchema(AssignTaskToContainerSchema, {
        issueNumber: 42,
        waveName: 'Wave 1',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing waveName', () => {
      const result = parseSchema(AssignTaskToContainerSchema, { issueNumber: 42 });
      expect(result.success).toBe(false);
    });
  });
});

describe('Dependency Schemas', () => {
  describe('DependencySchema', () => {
    it('accepts valid issue number', () => {
      const result = parseSchema(DependencySchema, { issueNumber: 42 });
      expect(result.success).toBe(true);
    });

    it('rejects zero', () => {
      const result = parseSchema(DependencySchema, { issueNumber: 0 });
      expect(result.success).toBe(false);
    });
  });
});
