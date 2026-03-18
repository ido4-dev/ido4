/**
 * Hydro Methodology Profile — Wave-Based Development Governance.
 *
 * 7 states, 2 containers (wave, epic), 2 integrity rules, 5 principles.
 * Exact behavioral parity with the current hardcoded engine.
 */

import type { MethodologyProfile } from './types.js';

export const HYDRO_PROFILE: MethodologyProfile = {
  id: 'hydro',
  name: 'Hydro — Wave-Based Governance',
  version: '1.0',
  description: 'Wave-based development governance with epic integrity, dependency coherence, and deterministic BRE validation',

  states: [
    { key: 'BACKLOG',        name: 'Backlog',        category: 'todo' },
    { key: 'IN_REFINEMENT',  name: 'In Refinement',  category: 'todo' },
    { key: 'READY_FOR_DEV',  name: 'Ready for Dev',  category: 'todo' },
    { key: 'IN_PROGRESS',    name: 'In Progress',    category: 'active' },
    { key: 'IN_REVIEW',      name: 'In Review',      category: 'active' },
    { key: 'DONE',           name: 'Done',           category: 'done' },
    { key: 'BLOCKED',        name: 'Blocked',        category: 'blocked' },
  ],

  transitions: [
    { action: 'refine',  from: ['BACKLOG'],                          to: 'IN_REFINEMENT', label: 'Move to refinement' },
    { action: 'ready',   from: ['IN_REFINEMENT', 'BACKLOG'],        to: 'READY_FOR_DEV', label: 'Mark ready for development' },
    { action: 'start',   from: ['READY_FOR_DEV'],                   to: 'IN_PROGRESS',   label: 'Start work' },
    { action: 'review',  from: ['IN_PROGRESS'],                     to: 'IN_REVIEW',     label: 'Submit for review' },
    { action: 'approve', from: ['IN_REVIEW'],                       to: 'DONE',          label: 'Approve and complete' },
    { action: 'complete',from: ['DONE'],                             to: 'DONE',          label: 'Administrative completion' },
    { action: 'block',   from: ['BACKLOG', 'IN_REFINEMENT', 'READY_FOR_DEV', 'IN_PROGRESS', 'IN_REVIEW'], to: 'BLOCKED', label: 'Block task' },
    { action: 'unblock', from: ['BLOCKED'],                          to: 'READY_FOR_DEV', label: 'Unblock task' },
    { action: 'return',  from: ['READY_FOR_DEV'], to: 'IN_REFINEMENT', label: 'Return to refinement', backward: true },
    { action: 'return',  from: ['IN_PROGRESS'],   to: 'READY_FOR_DEV', label: 'Return to ready',      backward: true },
    { action: 'return',  from: ['IN_REVIEW'],     to: 'IN_PROGRESS',   label: 'Return to progress',   backward: true },
  ],

  semantics: {
    initialState: 'BACKLOG',
    terminalStates: ['DONE'],
    blockedStates: ['BLOCKED'],
    activeStates: ['IN_PROGRESS', 'IN_REVIEW'],
    readyStates: ['READY_FOR_DEV'],
    reviewStates: ['IN_REVIEW'],
  },

  workItems: {
    primary: { singular: 'Task', plural: 'Tasks' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'task',
    types: [
      { id: 'task',     name: 'Task',     standardLifecycle: true },
      { id: 'feature',  name: 'Feature',  standardLifecycle: true },
      { id: 'bug',      name: 'Bug',      standardLifecycle: true },
      { id: 'spike',    name: 'Spike',    standardLifecycle: true },
      { id: 'refactor', name: 'Refactor', standardLifecycle: true },
    ],
    hierarchy: [
      { typeId: 'task', children: ['task'], childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'wave',
      singular: 'Wave',
      plural: 'Waves',
      taskField: 'Wave',
      namePattern: '^wave-\\d{3}-[a-z0-9-]+$',
      nameExample: 'wave-001-auth-system',
      singularity: true,
      completionRule: 'all-terminal',
      managed: true,
    },
    {
      id: 'epic',
      singular: 'Epic',
      plural: 'Epics',
      taskField: 'Epic',
      completionRule: 'none',
      managed: true,
    },
  ],

  integrityRules: [
    {
      id: 'epic-wave-integrity',
      type: 'same-container',
      groupBy: 'epic',
      mustMatch: 'wave',
      description: 'All tasks in the same epic must be in the same wave',
      severity: 'error',
      principleId: 'epic-integrity',
    },
    {
      id: 'dependency-wave-ordering',
      type: 'ordering',
      containerType: 'wave',
      description: "A task's wave must be numerically >= its dependency tasks' waves",
      severity: 'warning',
      principleId: 'dependency-coherence',
    },
  ],

  principles: [
    {
      id: 'epic-integrity',
      name: 'Epic Integrity',
      description: 'All tasks within an epic MUST be assigned to the same wave',
      severity: 'error',
      enforcement: { type: 'integrity-rule', ref: 'epic-wave-integrity' },
    },
    {
      id: 'wave-singularity',
      name: 'Active Wave Singularity',
      description: 'Only one wave can be active at a time',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'wave' },
    },
    {
      id: 'dependency-coherence',
      name: 'Dependency Coherence',
      description: "A task's wave must be numerically >= its dependency tasks' waves",
      severity: 'warning',
      enforcement: { type: 'integrity-rule', ref: 'dependency-wave-ordering' },
    },
    {
      id: 'self-contained-execution',
      name: 'Self-Contained Execution',
      description: 'Each wave contains all dependencies needed for its tasks',
      severity: 'warning',
      enforcement: { type: 'validation-step', ref: 'SelfContainedExecutionValidation' },
    },
    {
      id: 'atomic-completion',
      name: 'Atomic Completion',
      description: 'A wave is complete only when ALL its tasks are in terminal state',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'wave' },
    },
  ],

  pipelines: {
    refine: {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'BaseTaskFieldsValidation',
        'StatusTransitionValidation:IN_REFINEMENT',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    ready: {
      steps: [
        'SourceStatusValidation:IN_REFINEMENT,BACKLOG',
        'FastTrackValidation',
        'AcceptanceCriteriaValidation',
        'SpecCompletenessValidation',
        'EffortEstimationValidation',
        'DependencyIdentificationValidation',
        'StatusTransitionValidation:READY_FOR_DEV',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    start: {
      steps: [
        'SourceStatusValidation:READY_FOR_DEV',
        'SpecCompletenessValidation',
        'StatusTransitionValidation:IN_PROGRESS',
        'DependencyValidation',
        'ContainerAssignmentValidation:wave',
        'ContainerSingularityValidation:wave',
        'AISuitabilityValidation',
        'RiskLevelValidation',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:IN_REVIEW',
        'ImplementationReadinessValidation',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    approve: {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'ContextCompletenessValidation',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    complete: {
      steps: [
        'StatusAlreadyDoneValidation',
        'SubtaskCompletionValidation',
      ],
    },
    block: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskAlreadyBlockedValidation',
        'StatusTransitionValidation:BLOCKED',
      ],
    },
    unblock: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskNotBlockedValidation',
        'StatusTransitionValidation:READY_FOR_DEV',
      ],
    },
    return: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskBlockedValidation',
        'BackwardTransitionValidation',
      ],
    },
  },

  compliance: {
    lifecycle: ['refine', 'ready', 'start', 'review', 'approve'],
    weights: {
      brePassRate: 0.40,
      qualityGates: 0.20,
      processAdherence: 0.20,
      containerIntegrity: 0.10,
      flowEfficiency: 0.10,
    },
  },

  behaviors: {
    closingTransitions: ['approve'],
    blockTransition: 'block',
    returnTransition: 'return',
  },
};
