/**
 * ComplianceService — Deterministic governance compliance scoring.
 *
 * Computes a reproducible 0-100 compliance score from audit trail data.
 * No separate storage — the audit log IS the source of truth.
 *
 * Phase 3: Lifecycle and weights are now profile-driven.
 */

import type { IAuditService } from '../audit/audit-service.js';
import type { IAnalyticsService } from '../analytics/analytics-service.js';
import type { PersistedAuditEvent } from '../audit/audit-store.js';
import type { ILogger } from '../../shared/logger.js';
import type { IEventBus, Unsubscribe } from '../../shared/events/index.js';
import type { MethodologyProfile } from '../../profiles/types.js';

// ─── Public Interface ───

export interface IComplianceService {
  computeComplianceScore(options?: ComplianceScoreOptions): Promise<ComplianceScore>;
}

export interface ComplianceScoreOptions {
  /** ISO-8601 start of compliance period */
  since?: string;
  /** ISO-8601 end of compliance period */
  until?: string;
  /** Scope compliance to a specific container */
  containerName?: string;
  /** Scope compliance to a specific actor */
  actorId?: string;
}

export interface ComplianceScore {
  /** Overall compliance score: 0-100 */
  score: number;
  /** Letter grade derived from score */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Time period this score covers */
  period: { since: string; until: string };
  /** Per-category breakdown */
  categories: {
    brePassRate: CategoryScore;
    qualityGates: CategoryScore;
    processAdherence: CategoryScore;
    epicIntegrity: CategoryScore;
    flowEfficiency: CategoryScore;
  };
  /** Human-readable summary sentence */
  summary: string;
  /** Actionable improvement recommendations */
  recommendations: string[];
  /** Computation metadata */
  metadata: {
    totalTransitions: number;
    totalTasks: number;
    computedAt: string;
  };
}

export interface CategoryScore {
  /** Category score: 0-100 */
  score: number;
  /** Category weight: 0-1 */
  weight: number;
  /** Weighted contribution to final score: score × weight */
  contribution: number;
  /** Human-readable explanation */
  detail: string;
}

// ─── Constants ───

const QUALITY_GATE_STEPS = new Set([
  'PRReviewValidation',
  'TestCoverageValidation',
  'SecurityScanValidation',
]);


function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Implementation ───

export class ComplianceService implements IComplianceService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTtlMs = 30_000;
  private readonly unsubscribe: Unsubscribe;
  private readonly lifecycle: readonly string[];
  private readonly weights: Record<string, number>;
  private readonly closingTransitions: readonly string[];

  constructor(
    private readonly auditService: IAuditService,
    private readonly analyticsService: IAnalyticsService,
    eventBus: IEventBus,
    _logger: ILogger,
    profile: MethodologyProfile,
  ) {
    this.lifecycle = profile.compliance.lifecycle;
    this.weights = profile.compliance.weights;
    this.closingTransitions = profile.behaviors.closingTransitions;
    this.unsubscribe = eventBus.on('*', () => {
      this.cache.clear();
    });
  }

  async computeComplianceScore(options?: ComplianceScoreOptions): Promise<ComplianceScore> {
    const since = options?.since ?? new Date(0).toISOString();
    const until = options?.until ?? new Date().toISOString();

    const cacheKey = `compliance:${since}:${until}:${options?.containerName ?? ''}:${options?.actorId ?? ''}`;
    const cached = this.getCached<ComplianceScore>(cacheKey);
    if (cached) return cached;

    // 1. Fetch events
    const transitionEvents = await this.fetchTransitionEvents(since, until, options);
    const containerAssignmentEvents = await this.fetchContainerAssignmentEvents(since, until, options);

    // 2. Empty period → clean baseline
    if (transitionEvents.length === 0 && containerAssignmentEvents.length === 0) {
      const emptyResult = this.buildEmptyReport(since, until);
      this.setCache(cacheKey, emptyResult);
      return emptyResult;
    }

    // 3. Compute each category
    const brePassRate = this.computeBrePassRate(transitionEvents);
    const qualityGates = this.computeQualityGates(transitionEvents);
    const processAdherence = this.computeProcessAdherence(transitionEvents);
    const epicIntegrity = this.computeEpicIntegrity(containerAssignmentEvents);
    const flowEfficiency = await this.computeFlowEfficiency(transitionEvents);

    // 4. Weighted total
    const categories = { brePassRate, qualityGates, processAdherence, epicIntegrity, flowEfficiency };
    const rawScore =
      brePassRate.contribution +
      qualityGates.contribution +
      processAdherence.contribution +
      epicIntegrity.contribution +
      flowEfficiency.contribution;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    // 5. Recommendations
    const recommendations = this.generateRecommendations(categories);

    // 6. Unique task count
    const uniqueTasks = new Set<number>();
    for (const entry of transitionEvents) {
      const issueNumber = (entry.event as Record<string, unknown>).issueNumber;
      if (typeof issueNumber === 'number') uniqueTasks.add(issueNumber);
    }

    const result: ComplianceScore = {
      score,
      grade: scoreToGrade(score),
      period: { since, until },
      categories,
      summary: this.buildSummary(score, categories),
      recommendations,
      metadata: {
        totalTransitions: transitionEvents.length,
        totalTasks: uniqueTasks.size,
        computedAt: new Date().toISOString(),
      },
    };

    this.setCache(cacheKey, result);
    return result;
  }

  dispose(): void {
    this.unsubscribe();
  }

  /** Lookup weight by key, with fallback to 0 for profiles missing a category */
  private w(key: string): number {
    return this.weights[key] ?? 0;
  }

  // ─── Category Computations ───

  private computeBrePassRate(events: PersistedAuditEvent[]): CategoryScore {
    let passCount = 0;
    let totalWithValidation = 0;

    for (const entry of events) {
      const vr = (entry.event as Record<string, unknown>).validationResult as
        | { stepsRun: number; stepsFailed: number }
        | undefined;

      if (!vr || typeof vr.stepsRun !== 'number' || vr.stepsRun === 0) continue;

      totalWithValidation++;
      if (vr.stepsFailed === 0) {
        passCount++;
      }
    }

    const rawScore = totalWithValidation > 0
      ? (passCount / totalWithValidation) * 100
      : 100;
    const score = round2(rawScore);

    return {
      score,
      weight: this.w('brePassRate'),
      contribution: round2(score * this.w('brePassRate')),
      detail: totalWithValidation > 0
        ? `${passCount}/${totalWithValidation} transitions passed all BRE steps`
        : 'No validated transitions in period',
    };
  }

  private computeQualityGates(events: PersistedAuditEvent[]): CategoryScore {
    const closingEvents = events.filter((e) => {
      const transition = (e.event as Record<string, unknown>).transition;
      return typeof transition === 'string' && this.closingTransitions.includes(transition);
    });

    if (closingEvents.length === 0) {
      return {
        score: 100,
        weight: this.w('qualityGates'),
        contribution: round2(100 * this.w('qualityGates')),
        detail: 'No closing transitions in period',
      };
    }

    let passCount = 0;

    for (const entry of closingEvents) {
      const vr = (entry.event as Record<string, unknown>).validationResult as
        | { details?: Array<{ stepName: string; passed: boolean }> }
        | undefined;

      if (!vr?.details) {
        passCount++; // No validation details = can't evaluate gates
        continue;
      }

      const qualityGateSteps = vr.details.filter((d) => QUALITY_GATE_STEPS.has(d.stepName));

      if (qualityGateSteps.length === 0) {
        passCount++; // Quality gates not configured in pipeline
        continue;
      }

      if (qualityGateSteps.every((d) => d.passed)) {
        passCount++;
      }
    }

    const rawScore = (passCount / closingEvents.length) * 100;
    const score = round2(rawScore);

    return {
      score,
      weight: this.w('qualityGates'),
      contribution: round2(score * this.w('qualityGates')),
      detail: `${passCount}/${closingEvents.length} closing transitions satisfied quality gates`,
    };
  }

  private computeProcessAdherence(events: PersistedAuditEvent[]): CategoryScore {
    const byIssue = new Map<number, Set<string>>();

    for (const entry of events) {
      const ev = entry.event as Record<string, unknown>;
      const issueNumber = ev.issueNumber;
      const transition = ev.transition;
      if (typeof issueNumber !== 'number' || typeof transition !== 'string') continue;

      if (!byIssue.has(issueNumber)) {
        byIssue.set(issueNumber, new Set());
      }
      byIssue.get(issueNumber)!.add(transition);
    }

    // Only evaluate completed tasks (have a closing transition)
    let totalAdherence = 0;
    let tasksEvaluated = 0;

    for (const [, transitions] of byIssue) {
      const hasClosing = this.closingTransitions.some((ct) => transitions.has(ct));
      if (!hasClosing) continue;

      tasksEvaluated++;
      const stepsFollowed = this.lifecycle.filter((step) => transitions.has(step)).length;
      totalAdherence += (stepsFollowed / this.lifecycle.length) * 100;
    }

    if (tasksEvaluated === 0) {
      return {
        score: 100,
        weight: this.w('processAdherence'),
        contribution: round2(100 * this.w('processAdherence')),
        detail: 'No completed tasks to evaluate process adherence',
      };
    }

    const rawScore = totalAdherence / tasksEvaluated;
    const score = round2(rawScore);

    return {
      score,
      weight: this.w('processAdherence'),
      contribution: round2(score * this.w('processAdherence')),
      detail: `${tasksEvaluated} completed tasks evaluated, average ${score.toFixed(1)}% lifecycle adherence`,
    };
  }

  private computeEpicIntegrity(containerAssignmentEvents: PersistedAuditEvent[]): CategoryScore {
    if (containerAssignmentEvents.length === 0) {
      return {
        score: 100,
        weight: this.w('containerIntegrity'),
        contribution: round2(100 * this.w('containerIntegrity')),
        detail: 'No container assignments in period',
      };
    }

    let maintained = 0;
    for (const entry of containerAssignmentEvents) {
      if ((entry.event as Record<string, unknown>).integrityMaintained === true) {
        maintained++;
      }
    }

    const rawScore = (maintained / containerAssignmentEvents.length) * 100;
    const score = round2(rawScore);

    return {
      score,
      weight: this.w('containerIntegrity'),
      contribution: round2(score * this.w('containerIntegrity')),
      detail: `${maintained}/${containerAssignmentEvents.length} container assignments maintained integrity`,
    };
  }

  private async computeFlowEfficiency(events: PersistedAuditEvent[]): Promise<CategoryScore> {
    const issueNumbers = new Set<number>();
    for (const entry of events) {
      const issueNumber = (entry.event as Record<string, unknown>).issueNumber;
      if (typeof issueNumber === 'number') issueNumbers.add(issueNumber);
    }

    if (issueNumbers.size === 0) {
      return {
        score: 100,
        weight: this.w('flowEfficiency'),
        contribution: round2(100 * this.w('flowEfficiency')),
        detail: 'No tasks in period',
      };
    }

    let totalEfficiency = 0;
    let tasksEvaluated = 0;

    for (const issueNumber of issueNumbers) {
      const cycleData = await this.analyticsService.getTaskCycleTime(issueNumber);
      if (!cycleData || cycleData.cycleTimeHours === null || cycleData.cycleTimeHours === 0) {
        continue;
      }

      tasksEvaluated++;
      const activeTime = cycleData.cycleTimeHours - cycleData.blockingTimeHours;
      const efficiency = (activeTime / cycleData.cycleTimeHours) * 100;
      totalEfficiency += Math.max(0, efficiency);
    }

    if (tasksEvaluated === 0) {
      return {
        score: 100,
        weight: this.w('flowEfficiency'),
        contribution: round2(100 * this.w('flowEfficiency')),
        detail: 'No completed tasks with cycle time data',
      };
    }

    const rawScore = totalEfficiency / tasksEvaluated;
    const score = round2(rawScore);

    return {
      score,
      weight: this.w('flowEfficiency'),
      contribution: round2(score * this.w('flowEfficiency')),
      detail: `${tasksEvaluated} tasks evaluated, average ${score.toFixed(1)}% flow efficiency`,
    };
  }

  // ─── Data Fetching ───

  private async fetchTransitionEvents(
    since: string,
    until: string,
    options?: ComplianceScoreOptions,
  ): Promise<PersistedAuditEvent[]> {
    const { events } = await this.auditService.queryEvents({
      eventType: 'task.transition',
      since,
      until,
      actorId: options?.actorId,
      limit: 10000,
    });

    if (options?.containerName) {
      return this.filterByContainer(events, since, until, options.containerName);
    }

    return events;
  }

  private async fetchContainerAssignmentEvents(
    since: string,
    until: string,
    options?: ComplianceScoreOptions,
  ): Promise<PersistedAuditEvent[]> {
    const { events } = await this.auditService.queryEvents({
      eventType: 'container.assignment',
      since,
      until,
      actorId: options?.actorId,
      limit: 10000,
    });

    if (options?.containerName) {
      return events.filter((e) => {
        return (e.event as Record<string, unknown>).containerName === options.containerName;
      });
    }

    return events;
  }

  private async filterByContainer(
    events: PersistedAuditEvent[],
    since: string,
    until: string,
    containerName: string,
  ): Promise<PersistedAuditEvent[]> {
    const { events: containerEvents } = await this.auditService.queryEvents({
      eventType: 'container.assignment',
      since,
      until,
      limit: 10000,
    });

    const containerTaskNumbers = new Set<number>();
    for (const entry of containerEvents) {
      const ev = entry.event as Record<string, unknown>;
      if (ev.containerName === containerName && typeof ev.issueNumber === 'number') {
        containerTaskNumbers.add(ev.issueNumber);
      }
    }

    return events.filter((e) => {
      const issueNumber = (e.event as Record<string, unknown>).issueNumber;
      return typeof issueNumber === 'number' && containerTaskNumbers.has(issueNumber);
    });
  }

  // ─── Output Helpers ───

  private buildEmptyReport(since: string, until: string): ComplianceScore {
    const emptyCategory = (weight: number): CategoryScore => ({
      score: 100,
      weight,
      contribution: round2(100 * weight),
      detail: 'No events in period',
    });

    return {
      score: 100,
      grade: 'A',
      period: { since, until },
      categories: {
        brePassRate: emptyCategory(this.w('brePassRate')),
        qualityGates: emptyCategory(this.w('qualityGates')),
        processAdherence: emptyCategory(this.w('processAdherence')),
        epicIntegrity: emptyCategory(this.w('containerIntegrity')),
        flowEfficiency: emptyCategory(this.w('flowEfficiency')),
      },
      summary: 'No governance events in the specified period. Score reflects clean baseline.',
      recommendations: [],
      metadata: {
        totalTransitions: 0,
        totalTasks: 0,
        computedAt: new Date().toISOString(),
      },
    };
  }

  private generateRecommendations(categories: ComplianceScore['categories']): string[] {
    const recommendations: string[] = [];
    const sorted = Object.entries(categories).sort(([, a], [, b]) => a.score - b.score);

    for (const [name, cat] of sorted) {
      if (cat.score >= 90) continue;

      switch (name) {
        case 'brePassRate':
          recommendations.push(
            cat.score < 70
              ? 'BRE validation failures are high. Review blocked transitions and ensure tasks meet all validation requirements before transitioning.'
              : 'Some BRE validation steps are failing. Check task field completeness (acceptance criteria, effort, wave assignment) before transitions.',
          );
          break;
        case 'qualityGates':
          recommendations.push(
            'Quality gate satisfaction is below target. Ensure PRs have required reviews, test coverage meets thresholds, and security scans pass before approval.',
          );
          break;
        case 'processAdherence':
          recommendations.push(
            'Tasks are skipping lifecycle steps. Follow the full refine → ready → start → review → approve workflow for governance compliance.',
          );
          break;
        case 'epicIntegrity':
          recommendations.push(
            'Epic integrity violations detected during wave assignments. Ensure all tasks within an epic are assigned to the same wave.',
          );
          break;
        case 'flowEfficiency':
          recommendations.push(
            'High blocking time is reducing flow efficiency. Investigate blocked tasks and resolve impediments faster.',
          );
          break;
      }
    }

    return recommendations;
  }

  private buildSummary(score: number, categories: ComplianceScore['categories']): string {
    const grade = scoreToGrade(score);

    const lowest = Object.entries(categories).reduce(
      (min, [name, cat]) => (cat.score < min.score ? { name, score: cat.score } : min),
      { name: '', score: 101 },
    );

    if (score >= 90) {
      return `Governance compliance is excellent (${grade}, ${score}/100). All categories performing well.`;
    }
    if (score >= 70) {
      return `Governance compliance is acceptable (${grade}, ${score}/100). Lowest category: ${lowest.name} at ${lowest.score.toFixed(1)}%.`;
    }
    return `Governance compliance needs attention (${grade}, ${score}/100). Focus on ${lowest.name} (${lowest.score.toFixed(1)}%) for the highest impact improvement.`;
  }

  // ─── Cache ───

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
