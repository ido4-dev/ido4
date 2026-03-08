/**
 * Coordination data aggregator — gathers multi-agent coordination state
 * for the get_coordination_state tool and ido4://agents/coordination resource.
 *
 * Returns: agent statuses, active locks, recent events, handoff recommendations,
 * and the requesting agent's current task and next recommendation.
 */

import type { ServiceContainer, RegisteredAgent, TaskLock, TaskData } from '@ido4/core';
import type { PersistedAuditEvent } from '@ido4/core';

export interface AgentStatus {
  agentId: string;
  name: string;
  role: string;
  currentTask: { issueNumber: number; title: string } | null;
  lastHeartbeat: string;
  isStale: boolean;
  transitionCount24h: number;
}

export interface CoordinationData {
  agents: AgentStatus[];
  activeLocks: Array<TaskLock & { taskTitle: string }>;
  recentEvents: PersistedAuditEvent[];
  recentHandoffs: PersistedAuditEvent[];
  recentRecommendations: PersistedAuditEvent[];
  myCurrentTask: { issueNumber: number; title: string } | null;
  myNextRecommendation: {
    issueNumber: number;
    title: string;
    score: number;
    reasoning: string;
  } | null;
  summary: string;
}

export interface CoordinationAggregatorOptions {
  agentId?: string;
  since?: string;
  limit?: number;
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function aggregateCoordinationData(
  container: ServiceContainer,
  options?: CoordinationAggregatorOptions,
): Promise<CoordinationData> {
  const agentId = options?.agentId ?? process.env.IDO4_AGENT_ID ?? 'mcp-session';
  const since = options?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const eventLimit = options?.limit ?? 50;

  // Parallel: agents, recent events, active wave tasks
  const [agents, { events: recentEvents }] = await Promise.all([
    container.agentService.listAgents(),
    container.auditService.queryEvents({ since, limit: eventLimit }),
  ]);

  // Get active wave tasks for lock→title mapping
  let waveTasks: TaskData[] = [];
  try {
    const waves = await container.containerService.listContainers();
    const active = waves.find((w) => w.status === 'active');
    if (active) {
      const waveStatus = await container.containerService.getContainerStatus(active.name);
      waveTasks = waveStatus.tasks;
    }
  } catch {
    // No active wave — continue without task titles
  }

  // Build agent statuses with lock info and transition counts
  const agentStatuses: AgentStatus[] = await Promise.all(
    agents.map(async (agent: RegisteredAgent): Promise<AgentStatus> => {
      // Count transitions by this agent in the period
      const transitionCount = recentEvents.filter((e) =>
        e.event.actor.id === agent.agentId && e.event.type === 'task.transition',
      ).length;

      // Find agent's current lock
      let currentTask: AgentStatus['currentTask'] = null;
      for (const task of waveTasks) {
        try {
          const lock = await container.agentService.getTaskLock(task.number);
          if (lock && lock.agentId === agent.agentId) {
            currentTask = { issueNumber: task.number, title: task.title };
            break;
          }
        } catch {
          // Skip
        }
      }

      const isStale = Date.now() - new Date(agent.lastHeartbeat).getTime() > STALE_THRESHOLD_MS;

      return {
        agentId: agent.agentId,
        name: agent.name,
        role: agent.role,
        currentTask,
        lastHeartbeat: agent.lastHeartbeat,
        isStale,
        transitionCount24h: transitionCount,
      };
    }),
  );

  // Collect active locks
  const activeLocks: Array<TaskLock & { taskTitle: string }> = [];
  for (const task of waveTasks) {
    try {
      const lock = await container.agentService.getTaskLock(task.number);
      if (lock) {
        activeLocks.push({ ...lock, taskTitle: task.title });
      }
    } catch {
      // Skip
    }
  }

  // Filter events by type
  const recentHandoffs = recentEvents.filter((e) => e.event.type === 'work.handoff');
  const recentRecommendations = recentEvents.filter((e) => e.event.type === 'work.recommendation');

  // My current task
  const myStatus = agentStatuses.find((a) => a.agentId === agentId);
  const myCurrentTask = myStatus?.currentTask ?? null;

  // My next recommendation (get from work distribution if available)
  let myNextRecommendation: CoordinationData['myNextRecommendation'] = null;
  try {
    const recommendation = await container.workDistributionService.getNextTask(agentId);
    if (recommendation.recommendation) {
      myNextRecommendation = {
        issueNumber: recommendation.recommendation.issueNumber,
        title: recommendation.recommendation.title,
        score: recommendation.recommendation.score,
        reasoning: recommendation.recommendation.reasoning,
      };
    }
  } catch {
    // Work distribution unavailable — continue without
  }

  // Build summary
  const activeCount = agentStatuses.filter((a) => !a.isStale).length;
  const staleCount = agentStatuses.filter((a) => a.isStale).length;
  const lockCount = activeLocks.length;
  const parts = [
    `${agentStatuses.length} agents (${activeCount} active${staleCount > 0 ? `, ${staleCount} stale` : ''})`,
    `${lockCount} active locks`,
    `${recentEvents.length} events (24h)`,
    `${recentHandoffs.length} handoffs`,
  ];
  const summary = parts.join(', ');

  return {
    agents: agentStatuses,
    activeLocks,
    recentEvents,
    recentHandoffs,
    recentRecommendations,
    myCurrentTask,
    myNextRecommendation,
    summary,
  };
}
