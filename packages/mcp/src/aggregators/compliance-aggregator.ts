/**
 * Compliance data aggregator — gathers all data the /compliance skill needs
 * in a single composite call instead of 7+ individual tool calls.
 */

import type { ServiceContainer, TaskData } from '@ido4/core';
import type { ComplianceData, TaskBlockerAnalysis, EpicIntegrityCheck } from './types.js';

export interface ComplianceAggregatorOptions {
  since?: string;
  until?: string;
  actorId?: string;
  waveName?: string;
}

export async function aggregateComplianceData(
  container: ServiceContainer,
  options?: ComplianceAggregatorOptions,
): Promise<ComplianceData> {
  // Parallel: all independent calls at once
  const [compliance, auditTrail, waves, taskResult] = await Promise.all([
    container.complianceService.computeComplianceScore({
      since: options?.since,
      until: options?.until,
      actorId: options?.actorId,
      waveName: options?.waveName,
    }),
    container.auditService.queryEvents({
      since: options?.since,
      until: options?.until,
      actorId: options?.actorId,
    }),
    container.waveService.listWaves(),
    container.taskService.listTasks({}),
  ]);

  const tasks = taskResult.data.tasks;

  // Determine active wave for analytics
  const activeWave = waves.find((w) => w.status === 'active');
  const analyticsWave = options?.waveName ?? activeWave?.name ?? waves[0]?.name ?? 'unknown';
  const analytics = await container.analyticsService.getWaveAnalytics(analyticsWave);

  // Per-task: dependency analysis for blocked tasks
  const blockedTasks = tasks.filter((t) => t.status === 'Blocked');
  const blockerAnalyses: TaskBlockerAnalysis[] = await Promise.all(
    blockedTasks.map(async (task): Promise<TaskBlockerAnalysis> => {
      try {
        const dependencyAnalysis = await container.dependencyService.analyzeDependencies(task.number);
        return { issueNumber: task.number, title: task.title, dependencyAnalysis };
      } catch {
        return { issueNumber: task.number, title: task.title, dependencyAnalysis: null };
      }
    }),
  );

  // Per-epic: validate integrity for a representative task from each unique epic
  const epicMap = new Map<string, TaskData>();
  for (const task of tasks) {
    if (task.epic && !epicMap.has(task.epic)) {
      epicMap.set(task.epic, task);
    }
  }

  const epicIntegrityChecks: EpicIntegrityCheck[] = await Promise.all(
    Array.from(epicMap.entries()).map(async ([epicName, task]): Promise<EpicIntegrityCheck> => {
      try {
        const result = await container.epicService.validateEpicIntegrity(task);
        return { epicName, issueNumber: task.number, result };
      } catch {
        return {
          epicName,
          issueNumber: task.number,
          result: { maintained: false, violations: ['Epic integrity check failed'] },
        };
      }
    }),
  );

  const violationCount = epicIntegrityChecks.filter((c) => !c.result.maintained).length;
  const summary = `Compliance ${compliance.score}/${compliance.grade}, ${auditTrail.total} audit events, ${waves.length} waves, ${tasks.length} tasks, ${blockedTasks.length} blocked, ${epicMap.size} epics (${violationCount} violations)`;

  return {
    compliance,
    auditTrail,
    analytics,
    waves,
    tasks,
    blockerAnalyses,
    epicIntegrityChecks,
    summary,
  };
}
