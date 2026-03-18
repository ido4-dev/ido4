/**
 * Task execution data aggregator — gathers all context an agent needs
 * to execute a task: spec, upstream dependencies, epic siblings,
 * downstream dependents, and epic progress.
 */

import type { ServiceContainer, DependencyNode, TaskData, TaskDataWithComments } from '@ido4/core';
import { DependencyService, parseIdo4ContextComments } from '@ido4/core';
import type {
  TaskExecutionData, UpstreamContext, SiblingContext, DownstreamContext,
  EpicProgressData, ExecutionIntelligence, DependencySignal, SiblingSignal, DownstreamSignal,
} from './types.js';

export interface TaskExecutionAggregatorOptions {
  issueNumber: number;
  includeComments?: boolean;
}

export async function aggregateTaskExecutionData(
  container: ServiceContainer,
  options: TaskExecutionAggregatorOptions,
): Promise<TaskExecutionData> {
  const { issueNumber } = options;
  const includeComments = options.includeComments ?? true;

  // Phase 1: Fetch the task itself (with comments)
  const task = await container.issueRepository.getTaskWithDetails(issueNumber, {
    includeComments,
  });

  // Phase 2: Parallel — dependency analysis + all container tasks
  const [dependencyAnalysis, allContainerTasks] = await Promise.all([
    container.dependencyService.analyzeDependencies(issueNumber),
    loadEpicSiblingTasks(container, task),
  ]);

  // Phase 3: Fetch upstream dependency details (with comments) — error-isolated
  const upstream = await fetchUpstreamContext(container, dependencyAnalysis.dependencies, includeComments);

  // Phase 4: Build reverse dependency map and fetch downstream
  const downstream = await fetchDownstreamContext(container, issueNumber, allContainerTasks);

  // Phase 5: Build sibling context
  const siblings = await buildSiblingContext(container, task, allContainerTasks, issueNumber);

  // Phase 6: Epic progress
  const epicProgress = buildEpicProgress(container, task, allContainerTasks, issueNumber);

  // Phase 7: Execution intelligence — deterministic signals from the graph
  const executionIntelligence = buildExecutionIntelligence(task, upstream, siblings, downstream, epicProgress);

  // Phase 8: Summary
  const summary = buildExecutionSummary(task, upstream, siblings, downstream, epicProgress);

  return { task, upstream, siblings, downstream, epicProgress, summary, executionIntelligence };
}

/**
 * Load all tasks that share an epic/grouping container with the given task.
 * Returns empty array if the task has no grouping container assignment.
 */
async function loadEpicSiblingTasks(
  container: ServiceContainer,
  task: TaskData,
): Promise<TaskData[]> {
  // Find the grouping container (completionRule: 'none', no parent — e.g., epic/bet)
  const groupingContainer = container.profile.containers.find((c) => c.completionRule === 'none' && !c.parent);
  if (!groupingContainer) return [];

  const epicValue = task.containers[groupingContainer.id];
  if (!epicValue) return [];

  // List all tasks and filter by grouping container value
  const result = await container.taskService.listTasks({});
  return result.data.tasks.filter((t) => t.containers[groupingContainer.id] === epicValue);
}

async function fetchUpstreamContext(
  container: ServiceContainer,
  dependencyNodes: DependencyNode[],
  includeComments: boolean,
): Promise<UpstreamContext[]> {
  return Promise.all(
    dependencyNodes.map(async (node): Promise<UpstreamContext> => {
      try {
        const taskWithComments = await container.issueRepository.getTaskWithDetails(
          node.issueNumber,
          { includeComments },
        );
        const ido4Context = parseIdo4ContextComments(taskWithComments.comments);
        return {
          task: taskWithComments,
          relationship: 'dependency',
          satisfied: node.satisfied,
          ido4Context,
        };
      } catch {
        // Graceful degradation — return basic info from dependency node
        return {
          task: {
            id: '', itemId: '', number: node.issueNumber, title: node.title,
            body: '', status: node.status, containers: {}, comments: [],
          } as TaskDataWithComments,
          relationship: 'dependency',
          satisfied: node.satisfied,
          ido4Context: [],
        };
      }
    }),
  );
}

async function fetchDownstreamContext(
  container: ServiceContainer,
  issueNumber: number,
  allTasks: TaskData[],
): Promise<DownstreamContext[]> {
  // Build reverse dependency map — same pattern as WorkDistributionService
  const reverseMap = buildReverseDependencyMap(allTasks);
  const dependentNumbers = reverseMap.get(issueNumber) ?? [];

  const results = await Promise.all(
    dependentNumbers.map(async (depNum): Promise<DownstreamContext | null> => {
      try {
        // Try from already-loaded tasks first (cheap)
        const cached = allTasks.find((t) => t.number === depNum);
        if (cached) {
          return { task: cached, relationship: 'dependent' };
        }
        // Fallback: fetch individually
        const task = await container.issueRepository.getTask(depNum);
        return { task, relationship: 'dependent' };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is DownstreamContext => r !== null);
}

async function buildSiblingContext(
  container: ServiceContainer,
  _task: TaskData,
  allTasks: TaskData[],
  currentIssueNumber: number,
): Promise<SiblingContext[]> {
  const siblingTasks = allTasks.filter((t) => t.number !== currentIssueNumber);
  if (siblingTasks.length === 0) return [];

  return Promise.all(
    siblingTasks.map(async (sibling): Promise<SiblingContext> => {
      let ido4Context: SiblingContext['ido4Context'] = [];

      // For completed siblings, fetch comments to get their context
      if (container.workflowConfig.isTerminalStatus(sibling.status)) {
        try {
          const withComments = await container.issueRepository.getTaskWithDetails(
            sibling.number,
            { includeComments: true },
          );
          ido4Context = parseIdo4ContextComments(withComments.comments);
        } catch {
          // Graceful degradation
        }
      }

      return { task: sibling, relationship: 'epic-sibling', ido4Context };
    }),
  );
}

function buildEpicProgress(
  container: ServiceContainer,
  task: TaskData,
  allTasks: TaskData[],
  _currentIssueNumber: number,
): EpicProgressData | null {
  const groupingContainer = container.profile.containers.find((c) => c.completionRule === 'none' && !c.parent);
  if (!groupingContainer) return null;

  const epicValue = task.containers[groupingContainer.id];
  if (!epicValue) return null;

  // allTasks already filtered to this epic
  const completed = allTasks.filter((t) => container.workflowConfig.isTerminalStatus(t.status));
  const inProgress = allTasks.filter((t) => container.workflowConfig.isActiveStatus(t.status));
  const blocked = allTasks.filter((t) => container.workflowConfig.isBlockedStatus(t.status));

  return {
    epicName: epicValue,
    total: allTasks.length,
    completed: completed.length,
    inProgress: inProgress.length,
    blocked: blocked.length,
    remaining: allTasks.length - completed.length,
    completedTasks: completed.map((t) => ({ number: t.number, title: t.title })),
    remainingTasks: allTasks
      .filter((t) => !container.workflowConfig.isTerminalStatus(t.status))
      .map((t) => ({ number: t.number, title: t.title })),
  };
}

function buildReverseDependencyMap(tasks: TaskData[]): Map<number, number[]> {
  const reverseMap = new Map<number, number[]>();
  for (const task of tasks) {
    const deps = DependencyService.parseDependencies(task.dependencies);
    for (const dep of deps) {
      const existing = reverseMap.get(dep);
      if (existing) {
        existing.push(task.number);
      } else {
        reverseMap.set(dep, [task.number]);
      }
    }
  }
  return reverseMap;
}

// ─── Execution Intelligence ───

function buildExecutionIntelligence(
  task: TaskDataWithComments,
  upstream: UpstreamContext[],
  siblings: SiblingContext[],
  downstream: DownstreamContext[],
  epicProgress: EpicProgressData | null,
): ExecutionIntelligence {
  const dependencySignals = upstream.map((u) => buildDependencySignal(u, task));
  const siblingSignals = siblings.map((s) => buildSiblingSignal(s));
  const downstreamSignals = downstream.map((d) => buildDownstreamSignal(d));
  const riskFlags = computeRiskFlags(dependencySignals, siblingSignals, downstreamSignals, epicProgress);
  const criticalPath = computeCriticalPath(task, downstream, epicProgress);

  return { dependencySignals, siblingSignals, downstreamSignals, riskFlags, criticalPath };
}

function buildDependencySignal(u: UpstreamContext, currentTask: TaskDataWithComments): DependencySignal {
  const warnings: string[] = [];

  // Context analysis
  const blocks = u.ido4Context;
  const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1]! : null;
  const lastContextAge = lastBlock?.timestamp ? formatAge(lastBlock.timestamp) : null;

  // Warning: unsatisfied dependency
  if (!u.satisfied) {
    warnings.push(`NOT satisfied (status: ${u.task.status}) — your work depends on an incomplete task`);
  }

  // Warning: no context trail
  if (blocks.length === 0 && u.satisfied) {
    warnings.push('Completed with no context comments — verify actual implementation against spec before depending on it');
  }

  // Warning: stale context (> 7 days)
  if (lastBlock?.timestamp) {
    const ageMs = Date.now() - new Date(lastBlock.timestamp).getTime();
    if (ageMs > 7 * 24 * 60 * 60 * 1000) {
      warnings.push('Last context is over 7 days old — verify against actual code before depending on it');
    }
  }

  // Warning: repeated block/unblock pattern (instability)
  const blockCount = blocks.filter((b) => b.transition === 'block').length;
  const unblockCount = blocks.filter((b) => b.transition === 'unblock').length;
  if (blockCount >= 2 && unblockCount >= 2) {
    warnings.push(`Blocked and unblocked ${blockCount} times — interface may be unstable, design defensively`);
  }

  // Priority: same container = critical, has context = high, else normal
  const sameContainer = sharesContainer(u.task, currentTask);
  let priority: DependencySignal['priority'] = 'normal';
  let priorityReason = 'Informational dependency';

  if (sameContainer) {
    priority = 'critical';
    priorityReason = 'Same container — directly affects container completion';
  } else if (blocks.length > 0) {
    priority = 'high';
    priorityReason = 'Has context comments — likely interface-defining';
  }

  return {
    issueNumber: u.task.number,
    title: u.task.title,
    priority,
    priorityReason,
    satisfied: u.satisfied,
    status: u.task.status,
    contextBlocks: blocks.length,
    lastContextTransition: lastBlock?.transition ?? null,
    lastContextAge,
    warnings,
  };
}

function buildSiblingSignal(s: SiblingContext): SiblingSignal {
  const warnings: string[] = [];
  const hasContext = s.ido4Context.length > 0;

  if (isBlockedStatus(s.task.status)) {
    warnings.push('BLOCKED — check if your work could unblock this sibling');
  }

  if (!hasContext && isActiveStatus(s.task.status)) {
    warnings.push('Active with no context comments — coordinate before assuming shared patterns');
  }

  return {
    issueNumber: s.task.number,
    title: s.task.title,
    status: s.task.status,
    hasContext,
    warnings,
  };
}

function buildDownstreamSignal(d: DownstreamContext): DownstreamSignal {
  const isWaiting = !isTerminalStatus(d.task.status) && !isActiveStatus(d.task.status);

  return {
    issueNumber: d.task.number,
    title: d.task.title,
    status: d.task.status,
    isWaiting,
  };
}

function computeRiskFlags(
  deps: DependencySignal[],
  siblings: SiblingSignal[],
  downstream: DownstreamSignal[],
  epicProgress: EpicProgressData | null,
): string[] {
  const flags: string[] = [];

  // Unsatisfied dependencies
  const unsatisfied = deps.filter((d) => !d.satisfied);
  if (unsatisfied.length > 0) {
    flags.push(`${unsatisfied.length} unsatisfied dependency(s): ${unsatisfied.map((d) => `#${d.issueNumber}`).join(', ')}`);
  }

  // Blocked siblings
  const blockedSiblings = siblings.filter((s) => s.warnings.some((w) => w.startsWith('BLOCKED')));
  if (blockedSiblings.length > 0) {
    flags.push(`${blockedSiblings.length} blocked sibling(s): ${blockedSiblings.map((s) => `#${s.issueNumber}`).join(', ')} — unblocking may be higher leverage than your current task`);
  }

  // Many downstream dependents (extensibility pressure)
  if (downstream.length >= 3) {
    flags.push(`${downstream.length} downstream dependents — design interfaces for extensibility and document thoroughly`);
  }

  // Epic nearing completion (high responsibility)
  if (epicProgress && epicProgress.remaining <= 2 && epicProgress.remaining > 0) {
    flags.push(`Epic "${epicProgress.epicName}" is ${epicProgress.completed}/${epicProgress.total} done — your task is one of the last ${epicProgress.remaining} remaining`);
  }

  // Dependencies with unstable history
  const unstable = deps.filter((d) => d.warnings.some((w) => w.includes('unstable')));
  if (unstable.length > 0) {
    flags.push(`Unstable upstream(s): ${unstable.map((d) => `#${d.issueNumber}`).join(', ')} — use adapters or abstractions`);
  }

  return flags;
}

function computeCriticalPath(
  task: TaskDataWithComments,
  downstream: DownstreamContext[],
  epicProgress: EpicProgressData | null,
): string | null {
  if (!epicProgress) return null;

  const waitingDownstream = downstream.filter((d) =>
    epicProgress.remainingTasks.some((r) => r.number === d.task.number),
  );

  if (waitingDownstream.length === 0) return null;

  const total = epicProgress.remaining;
  const dependOnYou = waitingDownstream.length;

  return `${dependOnYou} of ${total} remaining epic tasks depend on #${task.number} completing first`;
}

// ─── Helpers ───

function sharesContainer(a: TaskData, b: TaskData): boolean {
  for (const [key, value] of Object.entries(a.containers)) {
    if (value && b.containers[key] === value) return true;
  }
  return false;
}

function isBlockedStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return lower === 'blocked';
}

function isActiveStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return lower.includes('progress') || lower.includes('review') || lower === 'building' || lower === 'qa';
}

function isTerminalStatus(status: string): boolean {
  const lower = status.toLowerCase();
  return lower === 'done' || lower === 'shipped' || lower === 'killed';
}

function formatAge(timestamp: string): string {
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Summary ───

function buildExecutionSummary(
  task: TaskDataWithComments,
  upstream: UpstreamContext[],
  siblings: SiblingContext[],
  downstream: DownstreamContext[],
  epicProgress: EpicProgressData | null,
): string {
  const parts: string[] = [`Task #${task.number}: "${task.title}"`];

  if (upstream.length > 0) {
    const satisfied = upstream.filter((u) => u.satisfied).length;
    parts.push(`${upstream.length} upstream deps (${satisfied} satisfied)`);
  }

  if (siblings.length > 0) {
    parts.push(`${siblings.length} epic siblings`);
  }

  if (downstream.length > 0) {
    parts.push(`${downstream.length} downstream dependents`);
  }

  if (epicProgress) {
    parts.push(`epic "${epicProgress.epicName}" ${epicProgress.completed}/${epicProgress.total} done`);
  }

  return parts.join(' | ');
}
