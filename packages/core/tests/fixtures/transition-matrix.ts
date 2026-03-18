/**
 * Transition Test Matrix — 63-entry status/transition validation matrix.
 *
 * Format: [fromStatus, transition, shouldPass, expectedErrorCode, description]
 * Covers all 9 transitions x 7 statuses.
 *
 * Ported from CLI tests/fixtures/task-test-scenarios.ts
 */

export const transitionTestMatrix: ReadonlyArray<
  readonly [string, string, boolean, string | null, string]
> = [
  // === REFINE TRANSITION (Backlog -> In Refinement) ===
  ['Backlog', 'refine', true, null, 'Valid refinement from backlog'],
  ['In Refinement', 'refine', false, 'INVALID_TRANSITION', 'Already in refinement'],
  ['Ready for Dev', 'refine', false, 'INVALID_TRANSITION', 'Cannot refine ready task'],
  ['In Progress', 'refine', false, 'INVALID_TRANSITION', 'Cannot refine active task'],
  ['In Review', 'refine', false, 'INVALID_TRANSITION', 'Cannot refine task in review'],
  ['Done', 'refine', false, 'INVALID_TRANSITION', 'Cannot refine completed task'],
  ['Blocked', 'refine', false, 'INVALID_TRANSITION', 'Cannot refine blocked task'],

  // === READY TRANSITION (In Refinement -> Ready for Dev) ===
  ['In Refinement', 'ready', true, null, 'Valid ready transition from refinement'],
  ['Backlog', 'ready', true, null, 'Valid fast-track: backlog to ready'],
  ['Ready for Dev', 'ready', false, 'INVALID_TRANSITION', 'Already ready for dev'],
  ['In Progress', 'ready', false, 'INVALID_TRANSITION', 'Cannot make active task ready'],
  ['In Review', 'ready', false, 'INVALID_TRANSITION', 'Cannot make reviewed task ready'],
  ['Done', 'ready', false, 'INVALID_TRANSITION', 'Cannot make completed task ready'],
  ['Blocked', 'ready', false, 'INVALID_TRANSITION', 'Cannot make blocked task ready'],

  // === START TRANSITION (Ready for Dev -> In Progress) ===
  ['Ready for Dev', 'start', true, null, 'Valid start from ready for dev'],
  ['Backlog', 'start', false, 'INVALID_TRANSITION', 'Cannot start task from backlog'],
  ['In Refinement', 'start', false, 'INVALID_TRANSITION', 'Cannot start unrefined task'],
  ['In Progress', 'start', false, 'INVALID_TRANSITION', 'Task already in progress'],
  ['In Review', 'start', false, 'INVALID_TRANSITION', 'Cannot restart reviewed task'],
  ['Done', 'start', false, 'INVALID_TRANSITION', 'Cannot start completed task'],
  ['Blocked', 'start', false, 'INVALID_TRANSITION', 'Cannot start blocked task'],

  // === REVIEW TRANSITION (In Progress -> In Review) ===
  ['In Progress', 'review', true, null, 'Valid review submission from in progress'],
  ['Backlog', 'review', false, 'INVALID_TRANSITION', 'Cannot review unstarted task'],
  ['In Refinement', 'review', false, 'INVALID_TRANSITION', 'Cannot review unstarted task'],
  ['Ready for Dev', 'review', false, 'INVALID_TRANSITION', 'Cannot review unstarted task'],
  ['In Review', 'review', false, 'INVALID_TRANSITION', 'Task already in review'],
  ['Done', 'review', false, 'INVALID_TRANSITION', 'Cannot review completed task'],
  ['Blocked', 'review', false, 'INVALID_TRANSITION', 'Cannot review blocked task'],

  // === APPROVE TRANSITION (In Review -> Done) ===
  ['In Review', 'approve', true, null, 'Valid approval from review'],
  ['Backlog', 'approve', false, 'INVALID_TRANSITION', 'Cannot approve unstarted task'],
  ['In Refinement', 'approve', false, 'INVALID_TRANSITION', 'Cannot approve unstarted task'],
  ['Ready for Dev', 'approve', false, 'INVALID_TRANSITION', 'Cannot approve unstarted task'],
  ['In Progress', 'approve', false, 'INVALID_TRANSITION', 'Cannot approve unreviewed task'],
  ['Done', 'approve', false, 'INVALID_TRANSITION', 'Task already approved/completed'],
  ['Blocked', 'approve', false, 'INVALID_TRANSITION', 'Cannot approve blocked task'],

  // === COMPLETE TRANSITION (Administrative completion) ===
  ['Done', 'complete', true, null, 'Valid administrative completion'],
  ['Backlog', 'complete', false, 'TASK_NOT_DONE', 'Cannot complete unfinished task'],
  ['In Refinement', 'complete', false, 'TASK_NOT_DONE', 'Cannot complete unfinished task'],
  ['Ready for Dev', 'complete', false, 'TASK_NOT_DONE', 'Cannot complete unfinished task'],
  ['In Progress', 'complete', false, 'TASK_NOT_DONE', 'Cannot complete unfinished task'],
  ['In Review', 'complete', false, 'TASK_NOT_DONE', 'Cannot complete unfinished task'],
  ['Blocked', 'complete', false, 'TASK_NOT_DONE', 'Cannot complete blocked task'],

  // === BLOCK TRANSITION (Any status -> Blocked) ===
  ['Backlog', 'block', true, null, 'Valid block from backlog'],
  ['In Refinement', 'block', true, null, 'Valid block from refinement'],
  ['Ready for Dev', 'block', true, null, 'Valid block from ready'],
  ['In Progress', 'block', true, null, 'Valid block from in progress'],
  ['In Review', 'block', true, null, 'Valid block from review'],
  ['Done', 'block', false, 'TASK_ALREADY_COMPLETED', 'Cannot block completed task'],
  ['Blocked', 'block', false, 'TASK_ALREADY_BLOCKED', 'Task already blocked'],

  // === UNBLOCK TRANSITION (Blocked -> Ready for Dev) ===
  ['Blocked', 'unblock', true, null, 'Valid unblock to ready for dev'],
  ['Backlog', 'unblock', false, 'TASK_NOT_BLOCKED', 'Cannot unblock non-blocked task'],
  ['In Refinement', 'unblock', false, 'TASK_NOT_BLOCKED', 'Cannot unblock non-blocked task'],
  ['Ready for Dev', 'unblock', false, 'TASK_NOT_BLOCKED', 'Cannot unblock non-blocked task'],
  ['In Progress', 'unblock', false, 'TASK_NOT_BLOCKED', 'Cannot unblock non-blocked task'],
  ['In Review', 'unblock', false, 'TASK_NOT_BLOCKED', 'Cannot unblock non-blocked task'],
  ['Done', 'unblock', false, 'TASK_ALREADY_COMPLETED', 'Cannot unblock completed task'],

  // === RETURN TRANSITION (Backward transitions) ===
  ['Ready for Dev', 'return', true, null, 'Valid return to refinement'],
  ['In Progress', 'return', true, null, 'Valid return to ready'],
  ['In Review', 'return', true, null, 'Valid return to progress'],
  ['Backlog', 'return', false, 'INVALID_BACKWARD_TRANSITION', 'Cannot return from backlog'],
  ['In Refinement', 'return', false, 'INVALID_BACKWARD_TRANSITION', 'Cannot return from refinement'],
  ['Done', 'return', false, 'TASK_ALREADY_COMPLETED', 'Cannot return completed task'],
  ['Blocked', 'return', false, 'TASK_BLOCKED', 'Cannot return blocked task'],
] as const;

/** Dependency-related test scenarios */
export const dependencyTestScenarios = [
  {
    name: 'no_dependencies',
    dependencies: 'No dependencies',
    shouldAllowStart: true,
    description: 'Task with no dependencies',
  },
  {
    name: 'completed_dependencies',
    dependencies: '#123 (Done), #124 (Done)',
    shouldAllowStart: true,
    description: 'All dependencies completed',
  },
  {
    name: 'incomplete_dependencies',
    dependencies: '#123 (Done), #124 (In Progress)',
    shouldAllowStart: false,
    description: 'Some dependencies incomplete',
  },
  {
    name: 'blocked_dependencies',
    dependencies: '#123 (Blocked)',
    shouldAllowStart: false,
    description: 'Dependencies are blocked',
  },
] as const;

/** Epic Integrity test scenarios */
export const containerIntegrityScenarios = [
  {
    name: 'same_wave_in_epic',
    epic: 'Epic-Auth',
    wave: 'wave-001',
    otherTasksInEpic: [{ wave: 'wave-001' }, { wave: 'wave-001' }],
    shouldPass: true,
    description: 'All tasks in epic assigned to same wave',
  },
  {
    name: 'different_wave_in_epic',
    epic: 'Epic-Auth',
    wave: 'wave-002',
    otherTasksInEpic: [{ wave: 'wave-001' }, { wave: 'wave-001' }],
    shouldPass: false,
    description: 'Epic Integrity violation: tasks in different waves',
  },
  {
    name: 'no_epic',
    epic: undefined,
    wave: 'wave-001',
    otherTasksInEpic: [],
    shouldPass: true,
    description: 'Task not in epic - no Epic Integrity constraints',
  },
] as const;

/** AI Suitability constraint scenarios */
export const aiSuitabilityScenarios = [
  { name: 'ai_only', aiSuitability: 'ai-only' as const, shouldAllowStart: true, description: 'AI-only task can be started' },
  { name: 'ai_reviewed', aiSuitability: 'ai-reviewed' as const, shouldAllowStart: true, description: 'AI-reviewed task can be started with oversight' },
  { name: 'hybrid', aiSuitability: 'hybrid' as const, shouldAllowStart: true, description: 'Hybrid task requires coordination' },
  { name: 'human_only', aiSuitability: 'human-only' as const, shouldAllowStart: false, description: 'Human-only task cannot be started by AI' },
  { name: 'unspecified', aiSuitability: undefined, shouldAllowStart: true, description: 'Unspecified AI suitability defaults to allowed' },
] as const;

/** Risk Level constraint scenarios */
export const riskLevelScenarios = [
  { name: 'low_risk', riskLevel: 'Low' as const, shouldAllowStart: true, description: 'Low risk task can be started' },
  { name: 'medium_risk', riskLevel: 'Medium' as const, shouldAllowStart: true, description: 'Medium risk task can be started' },
  { name: 'high_risk', riskLevel: 'High' as const, shouldAllowStart: true, description: 'High risk task can be started with warnings' },
  { name: 'unspecified_risk', riskLevel: undefined, shouldAllowStart: true, description: 'Unspecified risk level defaults to allowed' },
] as const;

/** Comprehensive workflow path scenarios */
export const workflowPathScenarios = [
  {
    name: 'standard_workflow',
    path: [
      { status: 'Backlog', transition: 'refine' },
      { status: 'In Refinement', transition: 'ready' },
      { status: 'Ready for Dev', transition: 'start' },
      { status: 'In Progress', transition: 'review' },
      { status: 'In Review', transition: 'approve' },
      { status: 'Done', transition: 'complete' },
    ],
    description: 'Standard task workflow from backlog to completion',
  },
  {
    name: 'fast_track_workflow',
    path: [
      { status: 'Backlog', transition: 'ready' },
      { status: 'Ready for Dev', transition: 'start' },
      { status: 'In Progress', transition: 'review' },
      { status: 'In Review', transition: 'approve' },
      { status: 'Done', transition: 'complete' },
    ],
    description: 'Fast-track workflow bypassing refinement',
  },
  {
    name: 'blocked_workflow',
    path: [
      { status: 'Ready for Dev', transition: 'start' },
      { status: 'In Progress', transition: 'block' },
      { status: 'Blocked', transition: 'unblock' },
      { status: 'Ready for Dev', transition: 'start' },
      { status: 'In Progress', transition: 'review' },
    ],
    description: 'Workflow with blocking and unblocking',
  },
  {
    name: 'return_workflow',
    path: [
      { status: 'In Review', transition: 'return' },
      { status: 'In Progress', transition: 'return' },
      { status: 'Ready for Dev', transition: 'return' },
      { status: 'In Refinement', transition: 'ready' },
    ],
    description: 'Backward workflow using return transitions',
  },
] as const;
