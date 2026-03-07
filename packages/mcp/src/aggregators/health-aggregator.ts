/**
 * Health data aggregator — gathers all data the /health skill needs
 * in a single composite call. Parallel only — no per-task iterations.
 */

import type { ServiceContainer } from '@ido4/core';
import type { HealthData } from './types.js';
import { resolveActiveWave } from './wave-detection.js';

export interface HealthAggregatorOptions {
  waveName?: string;
}

export async function aggregateHealthData(
  container: ServiceContainer,
  options?: HealthAggregatorOptions,
): Promise<HealthData> {
  const waveName = await resolveActiveWave(container, options?.waveName);

  // All parallel — health is meant to be fast
  const [waveStatus, compliance, analytics, agents] = await Promise.all([
    container.waveService.getWaveStatus(waveName),
    container.complianceService.computeComplianceScore({}),
    container.analyticsService.getWaveAnalytics(waveName),
    container.agentService.listAgents(),
  ]);

  const { metrics } = waveStatus;
  const pct = metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0;
  const summary = `${waveName}: ${pct}% complete (${metrics.completed}/${metrics.total}), ${metrics.blocked} blocked, compliance ${compliance.score}/${compliance.grade}, ${agents.length} agents`;

  return {
    waveStatus,
    compliance,
    analytics,
    agents,
    summary,
  };
}
