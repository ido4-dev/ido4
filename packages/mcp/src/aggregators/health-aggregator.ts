/**
 * Health data aggregator — gathers all data the /health skill needs
 * in a single composite call. Parallel only — no per-task iterations.
 */

import type { ServiceContainer } from '@ido4/core';
import type { HealthData } from './types.js';
import { resolveActiveContainer } from './wave-detection.js';

export interface HealthAggregatorOptions {
  containerName?: string;
}

export async function aggregateHealthData(
  container: ServiceContainer,
  options?: HealthAggregatorOptions,
): Promise<HealthData> {
  const containerName = await resolveActiveContainer(container, options?.containerName);

  // All parallel — health is meant to be fast
  const [waveStatus, compliance, analytics, agents] = await Promise.all([
    container.containerService.getContainerStatus(containerName),
    container.complianceService.computeComplianceScore({}),
    container.analyticsService.getContainerAnalytics(containerName),
    container.agentService.listAgents(),
  ]);

  const { metrics } = waveStatus;
  const pct = metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0;
  const summary = `${containerName}: ${pct}% complete (${metrics.completed}/${metrics.total}), ${metrics.blocked} blocked, compliance ${compliance.score}/${compliance.grade}, ${agents.length} agents`;

  return {
    waveStatus,
    compliance,
    analytics,
    agents,
    summary,
  };
}
