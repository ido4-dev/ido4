/**
 * Task domain types.
 *
 * Defines the validation pipeline types used by the BRE (Business Rule Engine).
 */

export type TransitionType =
  | 'refine'
  | 'ready'
  | 'start'
  | 'review'
  | 'approve'
  | 'complete'
  | 'block'
  | 'unblock'
  | 'return';

export interface ValidationResult {
  canProceed: boolean;
  transition: TransitionType;
  reason: string;
  details: ValidationStepResult[];
  suggestions: string[];
  metadata: Record<string, unknown>;
}

export interface ValidationStepResult {
  stepName: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  details?: Record<string, unknown>;
}

export interface ValidationStep {
  readonly name: string;
  validate(context: ValidationContext): Promise<ValidationStepResult>;
}

export interface ValidationContext {
  issueNumber: number;
  transition: TransitionType;
  task: import('../../container/interfaces.js').TaskData;
  config: import('../../container/interfaces.js').IProjectConfig;
  workflowConfig: import('../../container/interfaces.js').IWorkflowConfig;
  gitWorkflowConfig?: import('../../container/interfaces.js').IGitWorkflowConfig;
  /** Optional actor identity for agent-aware validation (e.g., TaskLockValidation) */
  actor?: import('../../shared/logger.js').ActorIdentity;
}

export const WORKFLOW_STATUSES = {
  BACKLOG: 'Backlog',
  IN_REFINEMENT: 'In Refinement',
  READY_FOR_DEV: 'Ready for Dev',
  BLOCKED: 'Blocked',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
} as const;

export type WorkflowStatusKey = keyof typeof WORKFLOW_STATUSES;
export type WorkflowStatusValue = (typeof WORKFLOW_STATUSES)[WorkflowStatusKey];
