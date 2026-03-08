// Source-status guards
export { RefineFromBacklogValidation } from './refine-from-backlog-validation.js';
export { ReadyFromRefinementOrBacklogValidation } from './ready-from-refinement-or-backlog-validation.js';
export { StartFromReadyForDevValidation } from './start-from-ready-for-dev-validation.js';

// Generic transition validation
export { StatusTransitionValidation } from './status-transition-validation.js';

// Task-state guards
export { TaskAlreadyCompletedValidation } from './task-already-completed-validation.js';
export { TaskAlreadyBlockedValidation } from './task-already-blocked-validation.js';
export { TaskNotBlockedValidation } from './task-not-blocked-validation.js';
export { TaskBlockedValidation } from './task-blocked-validation.js';
export { StatusAlreadyDoneValidation } from './status-already-done-validation.js';
export { BackwardTransitionValidation } from './backward-transition-validation.js';

// Field requirement validations
export { BaseTaskFieldsValidation } from './base-task-fields-validation.js';
export { AcceptanceCriteriaValidation } from './acceptance-criteria-validation.js';
export { EffortEstimationValidation } from './effort-estimation-validation.js';
export { DependencyIdentificationValidation } from './dependency-identification-validation.js';
export { WaveAssignmentValidation } from './wave-assignment-validation.js';

// Constraint validations
export { AISuitabilityValidation } from './ai-suitability-validation.js';
export { RiskLevelValidation } from './risk-level-validation.js';
export { FastTrackValidation } from './fast-track-validation.js';
export { ApprovalRequirementValidation } from './approval-requirement-validation.js';

// Service-injected validations
export { EpicIntegrityValidation } from './epic-integrity-validation.js';
export { DependencyValidation } from './dependency-validation.js';
export { ImplementationReadinessValidation } from './implementation-readiness-validation.js';
export { SubtaskCompletionValidation } from './subtask-completion-validation.js';

// Quality gate validations
export { PRReviewValidation } from './pr-review-validation.js';
export { TestCoverageValidation } from './test-coverage-validation.js';
export { SecurityScanValidation } from './security-scan-validation.js';

// Multi-agent validations
export { TaskLockValidation } from './task-lock-validation.js';

// Registry registration helper
import type { ValidationStepRegistry } from '../validation-step-registry.js';
import { RefineFromBacklogValidation } from './refine-from-backlog-validation.js';
import { ReadyFromRefinementOrBacklogValidation } from './ready-from-refinement-or-backlog-validation.js';
import { StartFromReadyForDevValidation } from './start-from-ready-for-dev-validation.js';
import { StatusTransitionValidation } from './status-transition-validation.js';
import { TaskAlreadyCompletedValidation } from './task-already-completed-validation.js';
import { TaskAlreadyBlockedValidation } from './task-already-blocked-validation.js';
import { TaskNotBlockedValidation } from './task-not-blocked-validation.js';
import { TaskBlockedValidation } from './task-blocked-validation.js';
import { StatusAlreadyDoneValidation } from './status-already-done-validation.js';
import { BackwardTransitionValidation } from './backward-transition-validation.js';
import { BaseTaskFieldsValidation } from './base-task-fields-validation.js';
import { AcceptanceCriteriaValidation } from './acceptance-criteria-validation.js';
import { EffortEstimationValidation } from './effort-estimation-validation.js';
import { DependencyIdentificationValidation } from './dependency-identification-validation.js';
import { WaveAssignmentValidation } from './wave-assignment-validation.js';
import { AISuitabilityValidation } from './ai-suitability-validation.js';
import { RiskLevelValidation } from './risk-level-validation.js';
import { FastTrackValidation } from './fast-track-validation.js';
import { ApprovalRequirementValidation } from './approval-requirement-validation.js';
import { EpicIntegrityValidation } from './epic-integrity-validation.js';
import { DependencyValidation } from './dependency-validation.js';
import { ImplementationReadinessValidation } from './implementation-readiness-validation.js';
import { SubtaskCompletionValidation } from './subtask-completion-validation.js';
import { PRReviewValidation } from './pr-review-validation.js';
import { TestCoverageValidation } from './test-coverage-validation.js';
import { SecurityScanValidation } from './security-scan-validation.js';
import { TaskLockValidation } from './task-lock-validation.js';

/** Register all built-in validation steps with a registry */
export function registerAllBuiltinSteps(registry: ValidationStepRegistry): void {
  // Stateless steps (no constructor dependencies)
  registry.register('RefineFromBacklogValidation', () => new RefineFromBacklogValidation());
  registry.register('ReadyFromRefinementOrBacklogValidation', () => new ReadyFromRefinementOrBacklogValidation());
  registry.register('StartFromReadyForDevValidation', () => new StartFromReadyForDevValidation());
  registry.register('StatusTransitionValidation', (_deps, param) => new StatusTransitionValidation(param!));
  registry.register('TaskAlreadyCompletedValidation', () => new TaskAlreadyCompletedValidation());
  registry.register('TaskAlreadyBlockedValidation', () => new TaskAlreadyBlockedValidation());
  registry.register('TaskNotBlockedValidation', () => new TaskNotBlockedValidation());
  registry.register('TaskBlockedValidation', () => new TaskBlockedValidation());
  registry.register('StatusAlreadyDoneValidation', () => new StatusAlreadyDoneValidation());
  registry.register('BackwardTransitionValidation', () => new BackwardTransitionValidation());
  registry.register('BaseTaskFieldsValidation', () => new BaseTaskFieldsValidation());
  registry.register('AcceptanceCriteriaValidation', () => new AcceptanceCriteriaValidation());
  registry.register('EffortEstimationValidation', () => new EffortEstimationValidation());
  registry.register('DependencyIdentificationValidation', () => new DependencyIdentificationValidation());
  registry.register('WaveAssignmentValidation', () => new WaveAssignmentValidation());
  registry.register('AISuitabilityValidation', () => new AISuitabilityValidation());
  registry.register('RiskLevelValidation', () => new RiskLevelValidation());
  registry.register('FastTrackValidation', () => new FastTrackValidation());
  registry.register('ApprovalRequirementValidation', () => new ApprovalRequirementValidation());

  // Service-injected steps
  registry.register('EpicIntegrityValidation', (deps) => new EpicIntegrityValidation(deps.integrityValidator));
  registry.register('DependencyValidation', (deps) => new DependencyValidation(deps.issueRepository));
  registry.register('ImplementationReadinessValidation', (deps) => new ImplementationReadinessValidation(deps.repositoryRepository));
  registry.register('SubtaskCompletionValidation', (deps) => new SubtaskCompletionValidation(deps.issueRepository));

  // Quality gate steps
  registry.register('PRReviewValidation', (deps) => new PRReviewValidation(deps.repositoryRepository, deps.issueRepository));
  registry.register('TestCoverageValidation', (deps) => new TestCoverageValidation(deps.repositoryRepository, deps.issueRepository));
  registry.register('SecurityScanValidation', (deps) => new SecurityScanValidation(deps.repositoryRepository));

  // Multi-agent steps (only active when agentService is available)
  registry.register('TaskLockValidation', (deps) => {
    if (!deps.agentService) {
      // Return a pass-through step when agent service is not available
      return { name: 'TaskLockValidation', validate: async () => ({ stepName: 'TaskLockValidation', passed: true, message: 'Agent service not configured', severity: 'info' as const }) };
    }
    return new TaskLockValidation(deps.agentService);
  });
}
