/**
 * Scrum Methodology Profile — Sprint-Based Execution with Type-Scoped Pipelines.
 *
 * 6 states, 1 container (sprint), 5 work item types with different DoR/DoD
 * per type via type-scoped pipeline overrides.
 */

import type { MethodologyProfile } from './types.js';

export const SCRUM_PROFILE: MethodologyProfile = {
  id: 'scrum',
  name: 'Scrum',
  version: '1.0',
  description: 'Standard Scrum with sprint-based execution, user stories, and type-specific quality gates',

  states: [
    { key: 'BACKLOG',      name: 'Product Backlog', category: 'todo' },
    { key: 'SPRINT',       name: 'Sprint Backlog',  category: 'todo' },
    { key: 'IN_PROGRESS',  name: 'In Progress',     category: 'active' },
    { key: 'IN_REVIEW',    name: 'In Review',       category: 'active' },
    { key: 'DONE',         name: 'Done',            category: 'done' },
    { key: 'BLOCKED',      name: 'Blocked',         category: 'blocked' },
  ],

  transitions: [
    { action: 'plan',     from: ['BACKLOG'],                              to: 'SPRINT',       label: 'Add to sprint backlog' },
    { action: 'start',    from: ['SPRINT'],                               to: 'IN_PROGRESS',  label: 'Start working' },
    { action: 'review',   from: ['IN_PROGRESS'],                          to: 'IN_REVIEW',    label: 'Submit for review' },
    { action: 'approve',  from: ['IN_REVIEW'],                            to: 'DONE',         label: 'Accept and complete' },
    { action: 'block',    from: ['SPRINT', 'IN_PROGRESS', 'IN_REVIEW'],   to: 'BLOCKED',      label: 'Block' },
    { action: 'unblock',  from: ['BLOCKED'],                              to: 'SPRINT',       label: 'Unblock' },
    { action: 'return',   from: ['IN_REVIEW'],    to: 'IN_PROGRESS',  label: 'Request changes',           backward: true },
    { action: 'return',   from: ['IN_PROGRESS'],  to: 'SPRINT',       label: 'Return to sprint backlog',  backward: true },
  ],

  semantics: {
    initialState: 'BACKLOG',
    terminalStates: ['DONE'],
    blockedStates: ['BLOCKED'],
    activeStates: ['IN_PROGRESS', 'IN_REVIEW'],
    readyStates: ['SPRINT'],
    reviewStates: ['IN_REVIEW'],
  },

  workItems: {
    primary: { singular: 'User Story', plural: 'User Stories' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'story',
    types: [
      { id: 'story',     name: 'User Story',      standardLifecycle: true },
      { id: 'bug',       name: 'Bug',             standardLifecycle: true },
      { id: 'spike',     name: 'Spike',           standardLifecycle: true },
      { id: 'chore',     name: 'Chore',           standardLifecycle: true },
      { id: 'tech-debt', name: 'Technical Debt',  standardLifecycle: true },
    ],
    hierarchy: [
      { typeId: 'story', children: ['story', 'bug', 'chore'], childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'sprint',
      singular: 'Sprint',
      plural: 'Sprints',
      taskField: 'Sprint',
      namePattern: '^Sprint \\d+$',
      nameExample: 'Sprint 14',
      singularity: true,
      completionRule: 'all-terminal',
      managed: true,
    },
  ],

  integrityRules: [],

  principles: [
    {
      id: 'sprint-singularity',
      name: 'Sprint Singularity',
      description: 'Only one sprint can be active at a time',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'sprint' },
    },
  ],

  pipelines: {
    // --- Default pipelines (apply to all types unless overridden) ---
    plan: {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'SpecCompletenessValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },
    start: {
      steps: [
        'SourceStatusValidation:SPRINT',
        'SpecCompletenessValidation',
        'StatusTransitionValidation:IN_PROGRESS',
        'DependencyValidation',
        'ContainerAssignmentValidation:sprint',
        'ContainerSingularityValidation:sprint',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:IN_REVIEW',
        'ImplementationReadinessValidation',
      ],
    },
    approve: {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'ContextCompletenessValidation',
        'SubtaskCompletionValidation',
      ],
    },

    // --- Type-scoped pipeline overrides ---

    // DoR for stories: must have acceptance criteria + effort estimation
    'plan:story': {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'AcceptanceCriteriaValidation',
        'SpecCompletenessValidation',
        'EffortEstimationValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },

    // DoR for bugs: must have repro steps (checked via BaseTaskFieldsValidation)
    'plan:bug': {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'BaseTaskFieldsValidation',
        'SpecCompletenessValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },

    // DoR for spikes: minimal — just get them into the sprint
    'plan:spike': {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'StatusTransitionValidation:SPRINT',
      ],
    },

    // Bugs skip dependency validation on start
    'start:bug': {
      steps: [
        'SourceStatusValidation:SPRINT',
        'SpecCompletenessValidation',
        'StatusTransitionValidation:IN_PROGRESS',
        'ContainerAssignmentValidation:sprint',
        'ContainerSingularityValidation:sprint',
      ],
    },

    // Spikes have relaxed DoD: no PR approval required
    'approve:spike': {
      steps: [
        'StatusTransitionValidation:DONE',
      ],
    },

    // Tech debt needs architectural review (2 reviewers)
    'approve:tech-debt': {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'ContextCompletenessValidation',
        'PRReviewValidation:2',
      ],
    },

    block: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:BLOCKED',
      ],
    },
    unblock: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },
    return: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'BackwardTransitionValidation',
      ],
    },
  },

  compliance: {
    lifecycle: ['plan', 'start', 'review', 'approve'],
    weights: {
      brePassRate: 0.40,
      qualityGates: 0.25,
      processAdherence: 0.25,
      flowEfficiency: 0.10,
    },
  },

  behaviors: {
    closingTransitions: ['approve'],
    blockTransition: 'block',
    returnTransition: 'return',
  },
};
