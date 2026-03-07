/**
 * TaskLockValidation — Warns when a task is locked by another agent.
 *
 * Uses actor identity from ValidationContext to check if the current actor
 * is different from the lock holder.
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IAgentService } from '../../agents/agent-service.js';

export class TaskLockValidation implements ValidationStep {
  readonly name = 'TaskLockValidation';

  constructor(private readonly agentService: IAgentService) {}

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    const lock = await this.agentService.getTaskLock(context.issueNumber);

    if (!lock) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task #${context.issueNumber} is not locked by any agent`,
        severity: 'info',
      };
    }

    // Check if the current actor is the lock holder
    const currentActorId = context.actor?.id;
    if (currentActorId && currentActorId === lock.agentId) {
      return {
        stepName: this.name,
        passed: true,
        message: `Task #${context.issueNumber} is locked by current agent`,
        severity: 'info',
      };
    }

    return {
      stepName: this.name,
      passed: true, // Warning, not a blocker
      message: `Task #${context.issueNumber} is locked by agent "${lock.agentId}" (expires: ${lock.expiresAt})`,
      severity: 'warning',
      details: {
        lockedBy: lock.agentId,
        acquiredAt: lock.acquiredAt,
        expiresAt: lock.expiresAt,
      },
    };
  }
}
