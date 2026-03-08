/**
 * Board data aggregator — gathers all data the /board skill needs
 * in a single composite call instead of 5-6 individual tool calls.
 */

import type { ServiceContainer } from '@ido4/core';
import type { BoardData, TaskAnnotation } from './types.js';
import { resolveActiveContainer } from './wave-detection.js';

export interface BoardAggregatorOptions {
  containerName?: string;
}

export async function aggregateBoardData(
  container: ServiceContainer,
  options?: BoardAggregatorOptions,
): Promise<BoardData> {
  const containerName = await resolveActiveContainer(container, options?.containerName);

  // Parallel: all independent calls at once
  const [waveStatus, taskResult, analytics, agents] = await Promise.all([
    container.containerService.getContainerStatus(containerName),
    container.taskService.listTasks({ wave: containerName }),
    container.analyticsService.getContainerAnalytics(containerName),
    container.agentService.listAgents(),
  ]);

  const tasks = taskResult.data.tasks;

  // Per-task: PR lookup for In Review, lock lookup for In Progress
  const annotatedTasks = tasks.filter((t) => t.status === 'In Review' || t.status === 'In Progress');

  const annotations: TaskAnnotation[] = await Promise.all(
    annotatedTasks.map(async (task): Promise<TaskAnnotation> => {
      let pullRequest: TaskAnnotation['pullRequest'] = null;
      let lock: TaskAnnotation['lock'] = null;

      if (task.status === 'In Review') {
        try {
          pullRequest = await container.issueRepository.findPullRequestForIssue(task.number);
        } catch {
          // PR lookup failed — continue with null
        }
      }

      if (task.status === 'In Progress') {
        try {
          lock = await container.agentService.getTaskLock(task.number);
        } catch {
          // Lock lookup failed — continue with null
        }
      }

      return { issueNumber: task.number, pullRequest, lock };
    }),
  );

  const projectUrl = container.projectConfig.project.url ?? null;

  const { metrics } = waveStatus;
  const summary = `${containerName}: ${metrics.total} tasks | ${metrics.completed} done, ${metrics.inProgress} in progress, ${metrics.blocked} blocked, ${metrics.ready} ready`;

  return {
    waveStatus,
    tasks,
    annotations,
    analytics,
    agents,
    projectUrl,
    summary,
  };
}
