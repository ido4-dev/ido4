/**
 * Standup data aggregator — gathers all data the /standup skill needs
 * in a single composite call instead of 10-12 individual tool calls.
 */

import type { ServiceContainer } from '@ido4/core';
import type { StandupData, TaskReviewStatus, TaskBlockerAnalysis } from './types.js';
import { resolveActiveContainer, getReviewStateNames } from './wave-detection.js';

export interface StandupAggregatorOptions {
  containerName?: string;
  auditHoursBack?: number;
}

export async function aggregateStandupData(
  container: ServiceContainer,
  options?: StandupAggregatorOptions,
): Promise<StandupData> {
  const containerName = await resolveActiveContainer(container, options?.containerName);
  const hoursBack = options?.auditHoursBack ?? 24;
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  // Step 1: Parallel batch — all independent calls at once
  const [containerStatus, taskResult, auditTrail, analytics, agents, compliance] = await Promise.all([
    container.containerService.getContainerStatus(containerName),
    container.taskService.listTasks({ wave: containerName }),
    container.auditService.queryEvents({ since }),
    container.analyticsService.getContainerAnalytics(containerName),
    container.agentService.listAgents(),
    container.complianceService.computeComplianceScore({}),
  ]);

  const tasks = taskResult.data.tasks;

  // Step 2: Per-task iterations with error isolation
  const reviewStates = getReviewStateNames(container.profile);
  const inReviewTasks = tasks.filter((t) => reviewStates.has(t.status));
  const blockedTasks = tasks.filter((t) => container.workflowConfig.isBlockedStatus(t.status));

  const reviewStatuses: TaskReviewStatus[] = await Promise.all(
    inReviewTasks.map(async (task): Promise<TaskReviewStatus> => {
      try {
        const pullRequest = await container.issueRepository.findPullRequestForIssue(task.number);
        let reviews: TaskReviewStatus['reviews'] = [];
        if (pullRequest) {
          try {
            reviews = await container.repositoryRepository.getPullRequestReviews(pullRequest.number);
          } catch {
            // Review fetch failed — continue with empty reviews
          }
        }
        return { issueNumber: task.number, title: task.title, pullRequest, reviews };
      } catch {
        return { issueNumber: task.number, title: task.title, pullRequest: null, reviews: [] };
      }
    }),
  );

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

  // Step 3: Build summary
  const statusCounts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  const statusParts = Object.entries(statusCounts).map(([s, c]) => `${c} ${s.toLowerCase()}`);
  const summary = `${containerName}: ${tasks.length} tasks (${statusParts.join(', ')}), ${auditTrail.total} audit events (${hoursBack}h), ${agents.length} agents, compliance ${compliance.score}/${compliance.grade}`;

  return {
    containerStatus,
    tasks,
    reviewStatuses,
    blockerAnalyses,
    auditTrail,
    analytics,
    agents,
    compliance,
    summary,
  };
}
