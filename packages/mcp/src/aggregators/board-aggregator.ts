/**
 * Board data aggregator — gathers all data the /board skill needs
 * in a single composite call instead of 5-6 individual tool calls.
 */

import type { ServiceContainer } from '@ido4/core';
import type { BoardData, TaskAnnotation } from './types.js';
import { resolveActiveWave } from './wave-detection.js';

export interface BoardAggregatorOptions {
  waveName?: string;
}

export async function aggregateBoardData(
  container: ServiceContainer,
  options?: BoardAggregatorOptions,
): Promise<BoardData> {
  const waveName = await resolveActiveWave(container, options?.waveName);

  // Parallel: all independent calls at once
  const [waveStatus, taskResult, analytics, agents] = await Promise.all([
    container.waveService.getWaveStatus(waveName),
    container.taskService.listTasks({ wave: waveName }),
    container.analyticsService.getWaveAnalytics(waveName),
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
  const summary = `${waveName}: ${metrics.total} tasks | ${metrics.completed} done, ${metrics.inProgress} in progress, ${metrics.blocked} blocked, ${metrics.ready} ready`;

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
