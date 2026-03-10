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
  containerName?: string;
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
      containerName: options?.containerName,
    }),
    container.auditService.queryEvents({
      since: options?.since,
      until: options?.until,
      actorId: options?.actorId,
    }),
    container.containerService.listContainers(),
    container.taskService.listTasks({}),
  ]);

  const tasks = taskResult.data.tasks;

  // Determine active wave for analytics
  const activeContainer = waves.find((w) => w.status === 'active');
  const analyticsContainer = options?.containerName ?? activeContainer?.name ?? waves[0]?.name ?? 'unknown';
  const analytics = await container.analyticsService.getContainerAnalytics(analyticsContainer);

  // Per-task: dependency analysis for blocked tasks
  const blockedTasks = tasks.filter((t) => container.workflowConfig.isBlockedStatus(t.status));
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

  // Per-integrity-group: validate integrity for a representative task from each unique grouping container
  // Derive grouping container from profile's same-container integrity rules
  const sameContainerRules = container.profile.integrityRules.filter((r) => r.type === 'same-container');
  const groupByContainerId = sameContainerRules[0]?.groupBy;

  const epicMap = new Map<string, TaskData>();
  if (groupByContainerId) {
    for (const task of tasks) {
      const groupValue = task.containers[groupByContainerId];
      if (groupValue && !epicMap.has(groupValue)) {
        epicMap.set(groupValue, task);
      }
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
