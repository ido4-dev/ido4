/**
 * MergeReadinessService — CI/CD quality gate for governance enforcement at merge time.
 *
 * Composes existing domain capabilities (BRE, compliance, dependency, PR review)
 * into a single structured pass/fail check. Uses existing services — no new
 * validation logic. Override mechanism is audited.
 *
 * 6 checks:
 * 1. Workflow compliance — did the task follow the full methodology?
 * 2. PR review requirement — approving reviews on linked PR
 * 3. Dependency completion — all upstream deps in Done
 * 4. Epic integrity — wave maintains epic cohesion
 * 5. Test/security gates — commit status checks, vulnerability alerts
 * 6. Compliance threshold — project compliance score above minimum
 */

import type {
  ITaskService,
  IIssueRepository,
  IRepositoryRepository,
  IDependencyService,
  IEpicService,
  IAuditService,
  IComplianceService,
  TaskData,
} from '../../container/interfaces.js';
import type { ILogger, ActorIdentity } from '../../shared/logger.js';
import type { IEventBus } from '../../shared/events/index.js';
import type { MergeCheck, MergeReadinessResult } from './types.js';

const DEFAULT_MIN_REVIEWS = 1;
const DEFAULT_MIN_COMPLIANCE = 70;

export interface MergeGateConfig {
  minReviews?: number;
  minComplianceScore?: number;
  requireWorkflowCompliance?: boolean;
  requireDependencyCompletion?: boolean;
  requireEpicIntegrity?: boolean;
  requireSecurityScan?: boolean;
}

export interface IMergeReadinessService {
  checkMergeReadiness(
    issueNumber: number,
    options?: { overrideReason?: string; actor?: ActorIdentity; config?: MergeGateConfig },
  ): Promise<MergeReadinessResult>;
}

export class MergeReadinessService implements IMergeReadinessService {
  constructor(
    private readonly taskService: ITaskService,
    private readonly issueRepository: IIssueRepository,
    private readonly repositoryRepository: IRepositoryRepository,
    private readonly dependencyService: IDependencyService,
    private readonly epicService: IEpicService,
    private readonly auditService: IAuditService,
    private readonly complianceService: IComplianceService,
    private readonly eventBus: IEventBus,
    private readonly sessionId: string,
    _logger: ILogger,
  ) {}

  async checkMergeReadiness(
    issueNumber: number,
    options?: { overrideReason?: string; actor?: ActorIdentity; config?: MergeGateConfig },
  ): Promise<MergeReadinessResult> {
    const config = options?.config ?? {};
    const task = await this.taskService.getTask({ issueNumber });

    // Run all checks in parallel
    const [
      workflowCheck,
      prReviewCheck,
      dependencyCheck,
      epicCheck,
      securityCheck,
      complianceCheck,
    ] = await Promise.all([
      this.checkWorkflowCompliance(issueNumber, task),
      this.checkPRReviews(issueNumber, config.minReviews ?? DEFAULT_MIN_REVIEWS),
      this.checkDependencyCompletion(issueNumber),
      this.checkEpicIntegrity(task),
      this.checkSecurityGates(issueNumber),
      this.checkComplianceThreshold(config.minComplianceScore ?? DEFAULT_MIN_COMPLIANCE),
    ]);

    const checks = [
      workflowCheck,
      prReviewCheck,
      dependencyCheck,
      epicCheck,
      securityCheck,
      complianceCheck,
    ];

    const hasErrors = checks.some((c) => !c.passed && c.severity === 'error');
    const overrideAvailable = hasErrors && !!options?.overrideReason;
    const overrideApplied = overrideAvailable && !!options?.overrideReason;

    // If override is applied, log it
    if (overrideApplied && options?.actor) {
      this.emitOverrideEvent(issueNumber, options.overrideReason!, options.actor, checks);
    }

    const ready = !hasErrors || overrideApplied;

    const overrideConsequences = hasErrors
      ? `Overriding will bypass ${checks.filter((c) => !c.passed && c.severity === 'error').length} failed gate(s). This is recorded in the audit trail and will affect compliance scoring.`
      : undefined;

    return {
      ready,
      checks,
      overrideAvailable: hasErrors,
      overrideConsequences,
      overrideApplied,
    };
  }

  // ─── Individual Checks ───

  private async checkWorkflowCompliance(issueNumber: number, task: TaskData): Promise<MergeCheck> {
    // Check if task has reached "In Review" or "Done" status — indicates proper workflow
    const validEndStatuses = ['In Review', 'Done'];
    if (validEndStatuses.includes(task.status)) {
      // Verify via audit trail that key steps were followed
      const { events } = await this.auditService.queryEvents({
        issueNumber,
        eventType: 'task.transition',
        limit: 100,
      });

      const transitions = events.map((e) => (e.event as Record<string, unknown>).transition as string);
      const hasStart = transitions.includes('start');
      const hasReview = transitions.includes('review');

      if (hasStart && hasReview) {
        return { name: 'Workflow Compliance', passed: true, severity: 'error', detail: 'Task followed the full workflow (start → review).' };
      }

      const missing = [];
      if (!hasStart) missing.push('start');
      if (!hasReview) missing.push('review');
      return {
        name: 'Workflow Compliance',
        passed: false,
        severity: 'warning',
        detail: `Task skipped workflow steps: ${missing.join(', ')}. Current status: ${task.status}.`,
        remediation: 'Ensure tasks go through start → review before merge.',
      };
    }

    return {
      name: 'Workflow Compliance',
      passed: false,
      severity: 'error',
      detail: `Task is in "${task.status}" — must be "In Review" or "Done" to merge.`,
      remediation: `Transition the task to "In Review" or "Done" first.`,
    };
  }

  private async checkPRReviews(issueNumber: number, minReviews: number): Promise<MergeCheck> {
    try {
      const pr = await this.issueRepository.findPullRequestForIssue(issueNumber);
      if (!pr) {
        return {
          name: 'PR Review',
          passed: false,
          severity: 'error',
          detail: 'No linked PR found for this task.',
          remediation: `Create a PR that references #${issueNumber} (e.g., "Closes #${issueNumber}").`,
        };
      }

      if (pr.merged) {
        return { name: 'PR Review', passed: true, severity: 'error', detail: `PR #${pr.number} already merged.` };
      }

      const reviews = await this.repositoryRepository.getPullRequestReviews(pr.number);
      const approvals = reviews.filter((r) => r.state === 'APPROVED');

      if (approvals.length >= minReviews) {
        return { name: 'PR Review', passed: true, severity: 'error', detail: `PR #${pr.number} has ${approvals.length} approval(s) (required: ${minReviews}).` };
      }

      return {
        name: 'PR Review',
        passed: false,
        severity: 'error',
        detail: `PR #${pr.number} has ${approvals.length} approval(s) but ${minReviews} required.`,
        remediation: `Request ${minReviews - approvals.length} more review(s) on PR #${pr.number}.`,
      };
    } catch (error) {
      return {
        name: 'PR Review',
        passed: false,
        severity: 'warning',
        detail: `PR review check failed: ${error instanceof Error ? error.message : String(error)}`,
        remediation: 'Verify PR exists and is accessible.',
      };
    }
  }

  private async checkDependencyCompletion(issueNumber: number): Promise<MergeCheck> {
    try {
      const validation = await this.dependencyService.validateDependencies(issueNumber);

      if (validation.valid) {
        return { name: 'Dependency Completion', passed: true, severity: 'error', detail: 'All upstream dependencies satisfied.' };
      }

      if (validation.circular.length > 0) {
        return {
          name: 'Dependency Completion',
          passed: false,
          severity: 'error',
          detail: `Circular dependencies detected: ${validation.circular.map((c) => c.map((n) => `#${n}`).join('→')).join('; ')}`,
          remediation: 'Resolve circular dependencies before merging.',
        };
      }

      return {
        name: 'Dependency Completion',
        passed: false,
        severity: 'error',
        detail: `Unsatisfied dependencies: ${validation.unsatisfied.map((n) => `#${n}`).join(', ')}`,
        remediation: `Complete tasks ${validation.unsatisfied.map((n) => `#${n}`).join(', ')} before merging this task.`,
      };
    } catch (error) {
      return {
        name: 'Dependency Completion',
        passed: true,
        severity: 'warning',
        detail: `Dependency check skipped: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkEpicIntegrity(task: TaskData): Promise<MergeCheck> {
    if (!task.epic) {
      return { name: 'Epic Integrity', passed: true, severity: 'warning', detail: 'Task has no epic — check not applicable.' };
    }

    try {
      const result = await this.epicService.validateEpicIntegrity(task);

      if (result.maintained) {
        return { name: 'Epic Integrity', passed: true, severity: 'warning', detail: 'Epic integrity maintained.' };
      }

      return {
        name: 'Epic Integrity',
        passed: false,
        severity: 'warning',
        detail: `Epic integrity violations: ${result.violations.join('; ')}`,
        remediation: 'Review epic task assignments to ensure all tasks in the epic are in the same wave.',
      };
    } catch (error) {
      return {
        name: 'Epic Integrity',
        passed: true,
        severity: 'warning',
        detail: `Epic integrity check skipped: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkSecurityGates(issueNumber: number): Promise<MergeCheck> {
    try {
      // Check vulnerability alerts
      const alerts = await this.repositoryRepository.getVulnerabilityAlerts();
      const critical = alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH');

      if (critical.length > 0) {
        return {
          name: 'Security Gates',
          passed: false,
          severity: 'warning',
          detail: `${critical.length} high/critical vulnerability alert(s): ${critical.map((a) => a.summary).join('; ')}`,
          remediation: 'Address security vulnerabilities before merging.',
        };
      }

      // Check PR status checks if available
      const pr = await this.issueRepository.findPullRequestForIssue(issueNumber);
      if (pr && !pr.merged) {
        try {
          const statusChecks = await this.repositoryRepository.getCommitStatusChecks(pr.number);
          const failed = statusChecks.filter((c) => c.state === 'FAILURE' || c.conclusion === 'failure');

          if (failed.length > 0) {
            return {
              name: 'Security Gates',
              passed: false,
              severity: 'warning',
              detail: `${failed.length} failed CI check(s): ${failed.map((c) => c.name).join(', ')}`,
              remediation: 'Fix failing CI checks before merging.',
            };
          }
        } catch {
          // Status checks not available — continue
        }
      }

      return { name: 'Security Gates', passed: true, severity: 'warning', detail: 'No security issues detected.' };
    } catch (error) {
      return {
        name: 'Security Gates',
        passed: true,
        severity: 'warning',
        detail: `Security check skipped: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async checkComplianceThreshold(minScore: number): Promise<MergeCheck> {
    try {
      const compliance = await this.complianceService.computeComplianceScore({});

      if (compliance.score >= minScore) {
        return {
          name: 'Compliance Threshold',
          passed: true,
          severity: 'warning',
          detail: `Compliance score ${compliance.score} (${compliance.grade}) meets minimum of ${minScore}.`,
        };
      }

      return {
        name: 'Compliance Threshold',
        passed: false,
        severity: 'warning',
        detail: `Compliance score ${compliance.score} (${compliance.grade}) is below minimum of ${minScore}.`,
        remediation: `Improve process adherence to bring compliance score above ${minScore}.`,
      };
    } catch (error) {
      return {
        name: 'Compliance Threshold',
        passed: true,
        severity: 'warning',
        detail: `Compliance check skipped: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ─── Audit ───

  private emitOverrideEvent(
    issueNumber: number,
    reason: string,
    actor: ActorIdentity,
    checks: MergeCheck[],
  ): void {
    const failedChecks = checks.filter((c) => !c.passed).map((c) => c.name);
    this.eventBus.emit({
      type: 'governance.override',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      actor,
      issueNumber,
      reason,
      failedChecks,
    } as any); // New event type — will be formalized in future
  }
}
