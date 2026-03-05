/**
 * Validation Scenarios — Named business rule invariants and complex test cases.
 *
 * Ported from CLI tests/fixtures/validation-test-matrix.ts
 */

import type { TaskData } from '../../src/index.js';
import { createMockTaskData } from '../helpers/mock-factories.js';

export interface ValidationTestCase {
  readonly name: string;
  readonly taskData: TaskData;
  readonly transition: 'refine' | 'ready' | 'start' | 'review' | 'approve' | 'complete' | 'block' | 'unblock' | 'return';
  readonly shouldPass: boolean;
  readonly expectedErrorCodes: readonly string[];
  readonly expectedFailedSteps: readonly string[];
  readonly description: string;
  readonly businessRuleViolations?: readonly string[];
}

/**
 * Complex validation scenarios testing multiple business rules together.
 */
export const validationTestMatrix: readonly ValidationTestCase[] = [
  // === REFINE TRANSITION SCENARIOS ===
  {
    name: 'refine_valid_backlog_task',
    taskData: createMockTaskData({ status: 'Backlog', title: 'Valid backlog task', body: 'Task with description for refinement' }),
    transition: 'refine',
    shouldPass: true,
    expectedErrorCodes: [],
    expectedFailedSteps: [],
    description: 'Valid refinement: backlog task with description',
  },
  {
    name: 'refine_missing_description',
    taskData: createMockTaskData({ status: 'Backlog', title: 'Task without description', body: '' }),
    transition: 'refine',
    shouldPass: false,
    expectedErrorCodes: ['MISSING_BASE_FIELDS'],
    expectedFailedSteps: ['BaseTaskFields'],
    description: 'Refinement fails: missing task description',
    businessRuleViolations: ['Task description required for refinement'],
  },
  {
    name: 'refine_invalid_status',
    taskData: createMockTaskData({ status: 'Done', body: 'Task description' }),
    transition: 'refine',
    shouldPass: false,
    expectedErrorCodes: ['INVALID_TRANSITION'],
    expectedFailedSteps: ['RefineFromBacklog', 'StatusTransition'],
    description: 'Refinement fails: invalid status transition',
  },

  // === READY TRANSITION SCENARIOS ===
  {
    name: 'ready_valid_from_refinement',
    taskData: createMockTaskData({ status: 'In Refinement', dependencies: 'No dependencies', effort: 'Medium' }),
    transition: 'ready',
    shouldPass: true,
    expectedErrorCodes: [],
    expectedFailedSteps: [],
    description: 'Valid ready: from refinement with all criteria',
  },
  {
    name: 'ready_missing_effort_estimation',
    taskData: createMockTaskData({ status: 'In Refinement', effort: undefined }),
    transition: 'ready',
    shouldPass: false,
    expectedErrorCodes: ['MISSING_EFFORT_ESTIMATE'],
    expectedFailedSteps: ['EffortEstimation'],
    description: 'Ready fails: missing effort estimation',
  },

  // === START TRANSITION SCENARIOS ===
  {
    name: 'start_valid_ready_task',
    taskData: createMockTaskData({ status: 'Ready for Dev', dependencies: 'No dependencies', wave: 'wave-001', aiSuitability: 'ai-only', riskLevel: 'Low' }),
    transition: 'start',
    shouldPass: true,
    expectedErrorCodes: [],
    expectedFailedSteps: [],
    description: 'Valid start: ready task with all constraints satisfied',
  },
  {
    name: 'start_incomplete_dependencies',
    taskData: createMockTaskData({ status: 'Ready for Dev', dependencies: '#123 (In Progress), #124 (Blocked)', wave: 'wave-001' }),
    transition: 'start',
    shouldPass: false,
    expectedErrorCodes: ['DEPENDENCY_NOT_SATISFIED'],
    expectedFailedSteps: ['Dependencies'],
    description: 'Start fails: incomplete dependencies',
  },
  {
    name: 'start_no_wave_assignment',
    taskData: createMockTaskData({ status: 'Ready for Dev', dependencies: 'No dependencies', wave: undefined }),
    transition: 'start',
    shouldPass: false,
    expectedErrorCodes: ['MISSING_WAVE_ASSIGNMENT'],
    expectedFailedSteps: ['WaveAssignment'],
    description: 'Start fails: no wave assignment',
  },
  {
    name: 'start_human_only_constraint',
    taskData: createMockTaskData({ status: 'Ready for Dev', dependencies: 'No dependencies', wave: 'wave-001', aiSuitability: 'human-only' }),
    transition: 'start',
    shouldPass: false,
    expectedErrorCodes: ['AI_SUITABILITY_VIOLATION'],
    expectedFailedSteps: ['AISuitability'],
    description: 'Start fails: human-only task cannot be started by AI',
  },

  // === BLOCK/UNBLOCK SCENARIOS ===
  {
    name: 'block_valid_active_task',
    taskData: createMockTaskData({ status: 'In Progress', wave: 'wave-001' }),
    transition: 'block',
    shouldPass: true,
    expectedErrorCodes: [],
    expectedFailedSteps: [],
    description: 'Valid block: active task can be blocked',
  },
  {
    name: 'unblock_valid_blocked_task',
    taskData: createMockTaskData({ status: 'Blocked', wave: 'wave-001' }),
    transition: 'unblock',
    shouldPass: true,
    expectedErrorCodes: [],
    expectedFailedSteps: [],
    description: 'Valid unblock: blocked task can be unblocked',
  },

  // === COMPLEX MULTI-RULE SCENARIOS ===
  {
    name: 'multiple_validation_failures',
    taskData: createMockTaskData({ status: 'Ready for Dev', dependencies: '#123 (In Progress)', wave: undefined, aiSuitability: 'human-only' }),
    transition: 'start',
    shouldPass: false,
    expectedErrorCodes: ['DEPENDENCY_NOT_SATISFIED', 'MISSING_WAVE_ASSIGNMENT', 'AI_SUITABILITY_VIOLATION'],
    expectedFailedSteps: ['Dependencies', 'WaveAssignment', 'AISuitability'],
    description: 'Multiple failures: dependencies, wave, and AI suitability',
    businessRuleViolations: [
      'Dependencies must be completed before starting',
      'Task must be assigned to a wave',
      'AI cannot start human-only tasks',
    ],
  },
  {
    name: 'epic_integrity_with_wave_conflict',
    taskData: createMockTaskData({ status: 'Ready for Dev', epic: 'Epic-Auth', wave: 'wave-003', dependencies: 'No dependencies', aiSuitability: 'ai-only' }),
    transition: 'start',
    shouldPass: false,
    expectedErrorCodes: ['EPIC_INTEGRITY_VIOLATION'],
    expectedFailedSteps: ['EpicIntegrity'],
    description: 'Epic Integrity violation: task in wrong wave for epic',
    businessRuleViolations: ['All tasks in Epic-Auth must be in same wave'],
  },
];

/**
 * Business rule invariants — fundamental rules that should NEVER be violated.
 */
export const businessRuleInvariants = [
  {
    name: 'completed_tasks_immutable',
    description: 'Completed tasks cannot be modified',
    testCases: [
      { status: 'Done', transition: 'start', shouldFail: true },
      { status: 'Done', transition: 'review', shouldFail: true },
      { status: 'Done', transition: 'refine', shouldFail: true },
      { status: 'Done', transition: 'block', shouldFail: true },
      { status: 'Done', transition: 'return', shouldFail: true },
    ],
  },
  {
    name: 'epic_integrity_enforced',
    description: 'Epic Integrity must be maintained across all transitions',
    testCases: [
      { epic: 'Epic-Auth', wave: 'wave-002', transition: 'start', shouldFail: true },
      { epic: 'Epic-Auth', wave: 'wave-002', transition: 'refine', shouldFail: true },
      { epic: 'Epic-Auth', wave: 'wave-002', transition: 'ready', shouldFail: true },
    ],
  },
  {
    name: 'dependencies_must_be_complete',
    description: 'Tasks with incomplete dependencies cannot be started',
    testCases: [
      { dependencies: '#123 (In Progress)', transition: 'start', shouldFail: true },
      { dependencies: '#123 (Blocked)', transition: 'start', shouldFail: true },
      { dependencies: '#123 (Backlog)', transition: 'start', shouldFail: true },
    ],
  },
  {
    name: 'human_only_constraint',
    description: 'AI cannot start human-only tasks',
    testCases: [
      { aiSuitability: 'human-only', transition: 'start', shouldFail: true },
    ],
  },
] as const;
