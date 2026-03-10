/**
 * Shape Up Methodology Profile — Fixed Time, Variable Scope.
 *
 * 8 states (incl. Killed, Shipped), 3 containers (cycle, bet, scope),
 * bet-cycle integrity, circuit breaker principle.
 */

import type { MethodologyProfile } from './types.js';

export const SHAPE_UP_PROFILE: MethodologyProfile = {
  id: 'shape-up',
  name: 'Shape Up',
  version: '1.0',
  description: 'Basecamp Shape Up — fixed time, variable scope, appetite-driven cycles with circuit breaker',

  states: [
    { key: 'RAW',       name: 'Raw Idea',  category: 'todo' },
    { key: 'SHAPED',    name: 'Shaped',    category: 'todo' },
    { key: 'BET',       name: 'Bet On',    category: 'todo' },
    { key: 'BUILDING',  name: 'Building',  category: 'active' },
    { key: 'QA',        name: 'QA',        category: 'active' },
    { key: 'SHIPPED',   name: 'Shipped',   category: 'done' },
    { key: 'KILLED',    name: 'Killed',    category: 'done' },
    { key: 'BLOCKED',   name: 'Blocked',   category: 'blocked' },
  ],

  transitions: [
    { action: 'shape',   from: ['RAW'],                       to: 'SHAPED',   label: 'Shape the pitch' },
    { action: 'bet',     from: ['SHAPED'],                    to: 'BET',      label: 'Place a bet' },
    { action: 'start',   from: ['BET'],                       to: 'BUILDING', label: 'Start building' },
    { action: 'review',  from: ['BUILDING'],                  to: 'QA',       label: 'Submit for QA' },
    { action: 'ship',    from: ['QA'],                        to: 'SHIPPED',  label: 'Ship it' },
    { action: 'block',   from: ['BUILDING', 'QA'],            to: 'BLOCKED',  label: 'Flag blocker' },
    { action: 'unblock', from: ['BLOCKED'],                   to: 'BUILDING', label: 'Unblock' },
    { action: 'kill',    from: ['BUILDING', 'QA', 'BLOCKED'], to: 'KILLED',   label: 'Circuit breaker — kill scope' },
    { action: 'return',  from: ['QA'],  to: 'BUILDING', label: 'Return to building', backward: true },
    { action: 'return',  from: ['BET'], to: 'SHAPED',   label: 'Return to shaping',  backward: true },
  ],

  semantics: {
    initialState: 'RAW',
    terminalStates: ['SHIPPED', 'KILLED'],
    blockedStates: ['BLOCKED'],
    activeStates: ['BUILDING', 'QA'],
    readyStates: ['BET'],
    reviewStates: ['QA'],
  },

  workItems: {
    primary: { singular: 'Task', plural: 'Tasks' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'task',
    types: [
      { id: 'task', name: 'Task', standardLifecycle: true },
    ],
    hierarchy: [
      { typeId: 'task', children: ['task'], childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'cycle',
      singular: 'Cycle',
      plural: 'Cycles',
      taskField: 'Cycle',
      namePattern: '^cycle-\\d{3}-[a-z0-9-]+$',
      nameExample: 'cycle-001-notifications',
      singularity: true,
      completionRule: 'all-terminal',
      managed: true,
    },
    {
      id: 'bet',
      singular: 'Bet',
      plural: 'Bets',
      taskField: 'Bet',
      completionRule: 'none',
      managed: true,
    },
    {
      id: 'scope',
      singular: 'Scope',
      plural: 'Scopes',
      taskField: 'Scope',
      parent: 'bet',
      completionRule: 'none',
      managed: false,
    },
  ],

  integrityRules: [
    {
      id: 'bet-cycle-integrity',
      type: 'same-container',
      groupBy: 'bet',
      mustMatch: 'cycle',
      description: 'All tasks in the same bet must be in the same cycle',
      severity: 'error',
      principleId: 'bet-integrity',
    },
  ],

  principles: [
    {
      id: 'bet-integrity',
      name: 'Bet Integrity',
      description: 'All scopes within a bet must be in the same cycle',
      severity: 'error',
      enforcement: { type: 'integrity-rule', ref: 'bet-cycle-integrity' },
    },
    {
      id: 'cycle-singularity',
      name: 'Active Cycle Singularity',
      description: 'Only one cycle can be active at a time',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'cycle' },
    },
    {
      id: 'circuit-breaker',
      name: 'Circuit Breaker',
      description: 'If a bet is not shipped by the end of a cycle, it is killed. No extensions.',
      severity: 'error',
      enforcement: { type: 'validation-step', ref: 'CircuitBreakerValidation' },
    },
    {
      id: 'fixed-appetite',
      name: 'Fixed Appetite',
      description: 'Time is fixed, scope is variable. Never extend a cycle for unfinished work.',
      severity: 'warning',
    },
  ],

  pipelines: {
    shape: {
      steps: [
        'SourceStatusValidation:RAW',
        'StatusTransitionValidation:SHAPED',
      ],
    },
    bet: {
      steps: [
        'SourceStatusValidation:SHAPED',
        'StatusTransitionValidation:BET',
        'ContainerAssignmentValidation:cycle',
        'ContainerIntegrityValidation:bet-cycle-integrity',
      ],
    },
    start: {
      steps: [
        'SourceStatusValidation:BET',
        'StatusTransitionValidation:BUILDING',
        'ContainerSingularityValidation:cycle',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:QA',
      ],
    },
    ship: {
      steps: [
        'StatusTransitionValidation:SHIPPED',
        'ApprovalRequirementValidation',
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
        'StatusTransitionValidation:BUILDING',
      ],
    },
    kill: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:KILLED',
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
    lifecycle: ['shape', 'bet', 'start', 'review', 'ship'],
    weights: {
      brePassRate: 0.35,
      qualityGates: 0.25,
      processAdherence: 0.20,
      containerIntegrity: 0.10,
      flowEfficiency: 0.10,
    },
  },

  behaviors: {
    closingTransitions: ['ship', 'kill'],
    blockTransition: 'block',
    returnTransition: 'return',
  },
};
