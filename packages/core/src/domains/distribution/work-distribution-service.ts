/**
 * WorkDistributionService — Intelligent task recommendation and handoff coordination.
 *
 * Scores candidate tasks across 4 dimensions:
 * - Cascade value (0-40): downstream tasks unblocked
 * - Epic momentum (0-25): prefer finishing in-progress epics
 * - Capability match (0-20): agent role vs task characteristics
 * - Dependency freshness (0-15): recently-unblocked momentum
 *
 * Every recommendation is audited via event bus. Recommendations are advisory —
 * the agent (or human) decides whether to follow them.
 */

import type {
  IContainerService,
  IAgentService,
  ITaskService,
  IAuditService,
  IWorkflowConfig,
  TaskData,
  RegisteredAgent,
} from '../../container/interfaces.js';
import type { MethodologyProfile } from '../../profiles/types.js';
import type { ILogger, ActorIdentity } from '../../shared/logger.js';
import type { IEventBus } from '../../shared/events/index.js';
import type {
  WorkRecommendation,
  TaskRecommendation,
  ScoreBreakdown,
  HandoffResult,
} from './types.js';
import { DependencyService } from '../dependencies/dependency-service.js';
import { BusinessRuleError } from '../../shared/errors/index.js';

// Score weight caps
const MAX_CASCADE = 40;
const MAX_EPIC_MOMENTUM = 25;
const MAX_CAPABILITY = 20;
const MAX_FRESHNESS = 15;

// Freshness window
const FRESHNESS_HOURS = 24;

export interface IWorkDistributionService {
  getNextTask(agentId: string, containerName?: string): Promise<WorkRecommendation>;
  completeAndHandoff(issueNumber: number, agentId: string, actor: ActorIdentity): Promise<HandoffResult>;
}

export class WorkDistributionService implements IWorkDistributionService {
  private readonly closingTransitions: readonly string[];

  constructor(
    private readonly containerService: IContainerService,
    private readonly agentService: IAgentService,
    private readonly taskService: ITaskService,
    private readonly auditService: IAuditService,
    private readonly eventBus: IEventBus,
    private readonly sessionId: string,
    private readonly logger: ILogger,
    private readonly workflowConfig: IWorkflowConfig,
    profile: MethodologyProfile,
  ) {
    this.closingTransitions = profile.behaviors.closingTransitions;
  }

  async getNextTask(agentId: string, containerName?: string): Promise<WorkRecommendation> {
    const activeContainer = await this.resolveActiveContainer(containerName);
    const containerStatus = await this.containerService.getContainerStatus(activeContainer);
    const allTasks = containerStatus.tasks;

    // Build reverse dependency map (what depends on each task)
    const reverseDeps = this.buildReverseDependencyMap(allTasks);

    // Identify locked tasks
    const lockedTasks: number[] = [];
    const lockMap = new Map<number, string>(); // issueNumber -> agentId
    for (const task of allTasks) {
      const lock = await this.agentService.getTaskLock(task.number);
      if (lock) {
        lockedTasks.push(task.number);
        lockMap.set(task.number, lock.agentId);
      }
    }

    // Filter candidates: Ready or todo-category statuses, not locked by another agent
    const candidates = allTasks.filter((task) => {
      const isActionable = this.isActionableStatus(task.status);
      if (!isActionable) return false;
      const lockOwner = lockMap.get(task.number);
      if (lockOwner && lockOwner !== agentId) return false;
      return true;
    });

    if (candidates.length === 0) {
      const result: WorkRecommendation = {
        recommendation: null,
        alternatives: [],
        context: { activeContainer, agentId, lockedTasks, totalCandidates: 0 },
      };
      this.emitRecommendationEvent(agentId, null, activeContainer, 0);
      return result;
    }

    // Get agent info for capability matching
    const agent = await this.agentService.getAgent(agentId);

    // Get recent audit events for freshness scoring
    const since = new Date(Date.now() - FRESHNESS_HOURS * 60 * 60 * 1000).toISOString();
    const { events: recentEvents } = await this.auditService.queryEvents({
      eventType: 'task.transition',
      since,
      limit: 1000,
    });

    // Build set of recently-completed task numbers
    const recentlyCompleted = new Set<number>();
    for (const entry of recentEvents) {
      const event = entry.event as Record<string, unknown>;
      const transition = event.transition;
      if (typeof transition === 'string' && this.closingTransitions.includes(transition) && typeof event.issueNumber === 'number') {
        recentlyCompleted.add(event.issueNumber as number);
      }
    }

    // Score all candidates
    const scored: TaskRecommendation[] = candidates.map((task) => {
      const breakdown = this.scoreTask(task, allTasks, reverseDeps, agent, recentlyCompleted);
      const score = breakdown.cascadeValue + breakdown.epicMomentum
        + breakdown.capabilityMatch + breakdown.dependencyFreshness;
      const reasoning = this.buildReasoning(task, breakdown, allTasks, reverseDeps);
      return { issueNumber: task.number, title: task.title, reasoning, score, scoreBreakdown: breakdown };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const recommendation = scored[0]!;
    const alternatives = scored.slice(1, 4); // Top 3 alternatives

    const result: WorkRecommendation = {
      recommendation,
      alternatives,
      context: { activeContainer, agentId, lockedTasks, totalCandidates: candidates.length },
    };

    this.emitRecommendationEvent(agentId, recommendation, activeContainer, candidates.length);
    return result;
  }

  async completeAndHandoff(issueNumber: number, agentId: string, actor: ActorIdentity): Promise<HandoffResult> {
    // Step 1: Approve the task (goes through full BRE)
    await this.taskService.approveTask({ issueNumber, actor });

    // Get task details for the response
    const task = await this.taskService.getTask({ issueNumber });

    // Step 2: Release the agent's lock
    try {
      await this.agentService.releaseTask(agentId, issueNumber);
    } catch {
      // Lock may not exist (agent didn't lock, or lock expired) — continue
      this.logger.debug('Lock release skipped during handoff', { agentId, issueNumber });
    }

    // Step 3: Find newly unblocked tasks
    const activeContainer = await this.resolveActiveContainer();
    const containerStatus = await this.containerService.getContainerStatus(activeContainer);
    const allTasks = containerStatus.tasks;
    const reverseDeps = this.buildReverseDependencyMap(allTasks);

    const dependents = reverseDeps.get(issueNumber) ?? [];
    const agents = await this.agentService.listAgents();

    const newlyUnblocked: HandoffResult['newlyUnblocked'] = [];
    for (const depNumber of dependents) {
      const depTask = allTasks.find((t) => t.number === depNumber);
      if (!depTask) continue;

      // Check if ALL dependencies of this task are now satisfied (Done)
      const taskDeps = DependencyService.parseDependencies(depTask.dependencies);
      const allSatisfied = taskDeps.every((d) => {
        const depTaskData = allTasks.find((t) => t.number === d);
        return depTaskData ? this.isTerminalStatus(depTaskData.status) : false;
      });

      if (allSatisfied && this.isBlockedOrReady(depTask.status)) {
        // Suggest which agent should pick it up
        const { agent: bestAgent, reasoning } = this.suggestAgentForTask(depTask, agents, agentId);
        newlyUnblocked.push({
          issueNumber: depNumber,
          title: depTask.title,
          recommendedAgent: bestAgent,
          reasoning,
        });
      }
    }

    // Step 4: Get the completing agent's next task recommendation
    const agentNextTask = await this.getNextTask(agentId);

    // Step 5: Emit handoff event
    this.emitHandoffEvent(
      agentId, issueNumber,
      newlyUnblocked.map((t) => t.issueNumber),
      agentNextTask.recommendation?.issueNumber ?? null,
    );

    return {
      completed: { issueNumber, title: task.title },
      newlyUnblocked,
      agentNextTask,
    };
  }

  // ─── Scoring Functions ───

  private scoreTask(
    task: TaskData,
    allTasks: TaskData[],
    reverseDeps: Map<number, number[]>,
    agent: RegisteredAgent | null,
    recentlyCompleted: Set<number>,
  ): ScoreBreakdown {
    return {
      cascadeValue: this.scoreCascade(task, allTasks, reverseDeps),
      epicMomentum: this.scoreEpicMomentum(task, allTasks),
      capabilityMatch: this.scoreCapabilityMatch(task, agent),
      dependencyFreshness: this.scoreDependencyFreshness(task, recentlyCompleted),
    };
  }

  /**
   * Cascade value (0-40): How many downstream tasks does completing this unblock?
   * Direct dependents score higher than depth-2 dependents.
   */
  private scoreCascade(
    task: TaskData,
    allTasks: TaskData[],
    reverseDeps: Map<number, number[]>,
  ): number {
    const directDependents = reverseDeps.get(task.number) ?? [];
    if (directDependents.length === 0) return 0;

    // Count non-Done dependents at each depth
    let score = 0;
    const visited = new Set<number>();
    const queue: Array<{ num: number; depth: number }> = directDependents.map((num) => ({ num, depth: 1 }));

    while (queue.length > 0) {
      const { num, depth } = queue.shift()!;
      if (visited.has(num)) continue;
      visited.add(num);

      const depTask = allTasks.find((t) => t.number === num);
      if (!depTask || this.isTerminalStatus(depTask.status)) continue;

      // Depth-weighted: depth 1 = 15 points, depth 2 = 8 points, depth 3+ = 4 points
      if (depth === 1) score += 15;
      else if (depth === 2) score += 8;
      else score += 4;

      // Continue BFS for deeper dependents
      const nextDeps = reverseDeps.get(num) ?? [];
      for (const next of nextDeps) {
        if (!visited.has(next)) {
          queue.push({ num: next, depth: depth + 1 });
        }
      }
    }

    return Math.min(score, MAX_CASCADE);
  }

  /**
   * Epic momentum (0-25): Prefer tasks in epics that are already in progress.
   * Higher completion ratio = higher score. Finishing an epic is high leverage.
   */
  private scoreEpicMomentum(task: TaskData, allTasks: TaskData[]): number {
    if (!task.containers['epic']) return 0;

    const epicTasks = allTasks.filter((t) => t.containers['epic'] === task.containers['epic']);
    if (epicTasks.length <= 1) return 5; // Solo task in epic — small bonus

    const doneCount = epicTasks.filter((t) => this.isTerminalStatus(t.status)).length;
    const ratio = doneCount / epicTasks.length;

    // Last task in epic gets max score (finishing momentum)
    const remaining = epicTasks.filter((t) => !this.isTerminalStatus(t.status)).length;
    if (remaining === 1) return MAX_EPIC_MOMENTUM;

    // Scale: 0% done = 0, 50% done = 12, 80% done = 20
    return Math.min(Math.round(ratio * MAX_EPIC_MOMENTUM), MAX_EPIC_MOMENTUM);
  }

  /**
   * Capability match (0-20): Does the agent's declared role match the task?
   * Soft matching — no capabilities = neutral score (10).
   */
  private scoreCapabilityMatch(task: TaskData, agent: RegisteredAgent | null): number {
    if (!agent) return 10; // No agent info — neutral

    const NEUTRAL = 10;
    let score = NEUTRAL;

    // Role-based matching
    if (agent.role === 'coding' && task.taskType === 'FEATURE') score += 4;
    if (agent.role === 'coding' && task.taskType === 'BUG') score += 3;
    if (agent.role === 'review' && task.status === 'In Refinement') score += 5;
    if (agent.role === 'testing' && task.taskType === 'TESTING') score += 5;
    if (agent.role === 'documentation' && task.taskType === 'DOCUMENTATION') score += 5;

    // Risk-based: high-risk tasks get a small bonus for specialized agents
    if (task.riskLevel === 'CRITICAL' && agent.role === 'coding') score += 2;
    if (task.riskLevel === 'HIGH' && agent.role === 'coding') score += 1;

    // Capability keyword matching (if agent declares capabilities)
    if (agent.capabilities && agent.capabilities.length > 0 && task.title) {
      const titleLower = task.title.toLowerCase();
      const hasMatch = agent.capabilities.some((cap) => titleLower.includes(cap.toLowerCase()));
      if (hasMatch) score += 3;
    }

    return Math.min(score, MAX_CAPABILITY);
  }

  /**
   * Dependency freshness (0-15): Was a dependency just completed?
   * Tasks that were recently unblocked have momentum — pick them up now.
   */
  private scoreDependencyFreshness(task: TaskData, recentlyCompleted: Set<number>): number {
    const deps = DependencyService.parseDependencies(task.dependencies);
    if (deps.length === 0) return 0;

    const freshCount = deps.filter((d) => recentlyCompleted.has(d)).length;
    if (freshCount === 0) return 0;

    // At least one fresh dependency — scale by proportion
    const ratio = freshCount / deps.length;
    return Math.min(Math.round(ratio * MAX_FRESHNESS), MAX_FRESHNESS);
  }

  // ─── Status Helpers (profile-aware) ───

  private isActionableStatus(status: string): boolean {
    return this.workflowConfig.isReadyStatus(status) ||
      (!this.workflowConfig.isTerminalStatus(status) &&
       !this.workflowConfig.isBlockedStatus(status) &&
       !this.workflowConfig.isActiveStatus(status));
  }

  private isBlockedOrReady(status: string): boolean {
    return this.workflowConfig.isBlockedStatus(status) || this.workflowConfig.isReadyStatus(status);
  }

  private isTerminalStatus(status: string): boolean {
    return this.workflowConfig.isTerminalStatus(status);
  }

  // ─── Helpers ───

  private buildReverseDependencyMap(tasks: TaskData[]): Map<number, number[]> {
    const reverseMap = new Map<number, number[]>();
    for (const task of tasks) {
      const deps = DependencyService.parseDependencies(task.dependencies);
      for (const dep of deps) {
        if (!reverseMap.has(dep)) reverseMap.set(dep, []);
        reverseMap.get(dep)!.push(task.number);
      }
    }
    return reverseMap;
  }

  private buildReasoning(
    task: TaskData,
    breakdown: ScoreBreakdown,
    allTasks: TaskData[],
    reverseDeps: Map<number, number[]>,
  ): string {
    const parts: string[] = [];

    if (breakdown.cascadeValue > 0) {
      const dependents = reverseDeps.get(task.number) ?? [];
      const nonDone = dependents.filter((d) => {
        const t = allTasks.find((at) => at.number === d);
        return t && !this.isTerminalStatus(t.status);
      });
      parts.push(`Unblocks ${nonDone.length} downstream task${nonDone.length !== 1 ? 's' : ''} (${nonDone.map((d) => `#${d}`).join(', ')})`);
    }

    if (breakdown.epicMomentum > 0 && task.containers['epic']) {
      const epicTasks = allTasks.filter((t) => t.containers['epic'] === task.containers['epic']);
      const doneCount = epicTasks.filter((t) => this.isTerminalStatus(t.status)).length;
      parts.push(`Advances ${task.containers['epic']} epic (${doneCount}/${epicTasks.length} done)`);
    }

    if (breakdown.dependencyFreshness > 0) {
      parts.push('Dependencies recently completed — momentum');
    }

    if (breakdown.capabilityMatch > 12) {
      parts.push('Strong capability match');
    }

    return parts.length > 0 ? parts.join('; ') : 'Available candidate';
  }

  private suggestAgentForTask(
    task: TaskData,
    agents: RegisteredAgent[],
    excludeAgentId: string,
  ): { agent: string | null; reasoning: string } {
    if (agents.length === 0) {
      return { agent: null, reasoning: 'No agents registered' };
    }

    // Filter to non-excluded, non-stale agents
    const available = agents.filter((a) => a.agentId !== excludeAgentId);
    if (available.length === 0) {
      return { agent: excludeAgentId, reasoning: 'Only available agent' };
    }

    // Simple capability match
    let bestAgent = available[0]!;
    let bestScore = 0;

    for (const agent of available) {
      let score = 0;
      if (agent.role === 'coding' && (task.taskType === 'FEATURE' || task.taskType === 'BUG')) score += 3;
      if (agent.role === 'testing' && task.taskType === 'TESTING') score += 3;
      if (agent.capabilities?.some((cap) => task.title.toLowerCase().includes(cap.toLowerCase()))) score += 2;
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    const reasoning = bestScore > 0
      ? `${bestAgent.name} matches task characteristics (${bestAgent.role})`
      : `${bestAgent.name} — next available agent`;

    return { agent: bestAgent.agentId, reasoning };
  }

  private async resolveActiveContainer(containerName?: string): Promise<string> {
    if (containerName) return containerName;

    const containers = await this.containerService.listContainers();
    const active = containers.find((c) => c.status === 'active');

    if (!active) {
      throw new BusinessRuleError({
        message: 'No active container found. Provide a containerName parameter or activate a container.',
        rule: 'ACTIVE_CONTAINER_REQUIRED',
        remediation: 'Use create_container or assign_task_to_container to set up an active container.',
      });
    }

    return active.name;
  }

  private emitRecommendationEvent(
    agentId: string,
    recommendation: TaskRecommendation | null,
    containerName: string,
    totalCandidates: number,
  ): void {
    this.eventBus.emit({
      type: 'work.recommendation',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      actor: { type: 'system', id: 'work-distribution', name: 'Work Distribution Service' },
      agentId,
      recommendedIssue: recommendation?.issueNumber ?? null,
      score: recommendation?.score ?? null,
      containerName,
      totalCandidates,
    });
  }

  private emitHandoffEvent(
    agentId: string,
    completedIssue: number,
    newlyUnblocked: number[],
    nextRecommendation: number | null,
  ): void {
    this.eventBus.emit({
      type: 'work.handoff',
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      actor: { type: 'system', id: 'work-distribution', name: 'Work Distribution Service' },
      agentId,
      completedIssue,
      newlyUnblocked,
      nextRecommendation,
    });
  }
}
