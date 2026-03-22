/**
 * ScenarioBuilder — Orchestrates algorithmic scenario construction from ingestion output.
 *
 * Pure function: IngestSpecResult + MethodologyProfile + ScenarioConfig → SandboxScenario.
 * No GitHub API calls, no side effects.
 *
 * Delegates to focused modules:
 * - builder/dependency-graph.ts — graph analysis (reverse deps, cascade values, layers)
 * - builder/seeding.ts — audit events, agents, PRs, context comments
 * - builder/narrative.ts — narrative text, memory seed
 * - builder/types.ts — shared internal types (Task, BuildContext, ScenarioRoles)
 */

import type { IngestSpecResult } from '../ingestion/types.js';
import type { MethodologyProfile } from '../../profiles/types.js';
import type {
  ScenarioConfig,
  SandboxScenario,
  ContainerInstanceDefinition,
  ViolationInjection,
} from './types.js';
import type { BuildContext, ScenarioRoles } from './builder/types.js';
import type { Task } from './builder/types.js';
import { parseSpec } from '../ingestion/spec-parser.js';
import { buildReverseDeps, computeDepthLayers, computeCascadeValues } from './builder/dependency-graph.js';
import { generateAuditEvents, generateAgents, generatePRSeeds, generateContextComments } from './builder/seeding.js';
import { generateNarrative, generateMemorySeed } from './builder/narrative.js';

// ─── Public API ───

export class ScenarioBuilder {
  static build(
    ingestionResult: IngestSpecResult,
    profile: MethodologyProfile,
    config: ScenarioConfig,
  ): SandboxScenario {
    const ctx = createBuildContext(ingestionResult, profile, config);
    const containerAssignments = assignContainers(ctx);

    const integrityViolationRef = findIntegrityViolationRef(ctx, containerAssignments);
    if (integrityViolationRef && ctx.containerNames.planned.length > 0) {
      containerAssignments[integrityViolationRef]![ctx.execContainerType] = ctx.containerNames.planned[0]!;
    }

    const roles = identifyRoles(ctx, containerAssignments, integrityViolationRef);
    const taskStates = assignStates(ctx, containerAssignments, roles);
    const violations = buildViolations(ctx, roles);

    return {
      id: config.id,
      name: config.name,
      description: config.description,
      profileId: config.profileId,
      technicalSpecContent: config.technicalSpecContent,
      containerInstances: buildContainerInstances(config),
      containerAssignments,
      taskStates,
      violations,
      auditEvents: generateAuditEvents(ctx, taskStates, roles),
      agents: generateAgents(ctx, roles),
      prSeeds: generatePRSeeds(ctx, roles),
      contextComments: generateContextComments(ctx, roles),
      narrative: generateNarrative(ctx, roles),
      memorySeed: generateMemorySeed(ctx, roles),
    };
  }
}

// ─── Context Construction ───

function createBuildContext(
  ingestion: IngestSpecResult,
  profile: MethodologyProfile,
  config: ScenarioConfig,
): BuildContext {
  // Parse spec to access task bodies (file references for context comments).
  // Structure comes from the ingestion result; bodies are content-only lookup.
  const parsed = parseSpec(config.technicalSpecContent);
  const bodyByRef = new Map<string, string>();
  for (const group of parsed.groups) {
    for (const task of group.tasks) {
      bodyByRef.set(task.ref, task.body);
    }
  }
  for (const task of parsed.orphanTasks) {
    bodyByRef.set(task.ref, task.body);
  }

  const tasks: Task[] = ingestion.created.tasks.map((t) => ({
    ref: t.ref,
    issueNumber: t.issueNumber,
    title: t.title,
    dependsOn: t.dependsOn,
    groupRef: t.groupRef,
    body: bodyByRef.get(t.ref) ?? '',
  }));

  const tasksByRef = new Map(tasks.map((t) => [t.ref, t]));

  const groupTaskRefs = new Map<string, string[]>();
  for (const task of tasks) {
    if (task.groupRef) {
      const refs = groupTaskRefs.get(task.groupRef) ?? [];
      refs.push(task.ref);
      groupTaskRefs.set(task.groupRef, refs);
    }
  }

  const reverseDeps = buildReverseDeps(tasks);
  const layers = computeDepthLayers(tasks);
  const cascadeValues = computeCascadeValues(tasks, reverseDeps);

  const execContainer = profile.containers.find((c: { singularity?: boolean }) => c.singularity === true);
  const execContainerType = execContainer?.id ?? profile.containers[0]?.id ?? 'wave';

  const terminalStates = profile.semantics.terminalStates;

  return {
    tasks, tasksByRef, groupTaskRefs, reverseDeps, cascadeValues, layers,
    profile, config, ingestion, execContainerType,
    states: {
      terminal: terminalStates[0]!,
      active: profile.semantics.activeStates[0]!,
      review: profile.semantics.reviewStates[0]!,
      ready: profile.semantics.readyStates[0]!,
      blocked: profile.semantics.blockedStates[0]!,
      initial: profile.semantics.initialState,
      killed: terminalStates.length > 1 ? terminalStates[1]! : null,
    },
    containerNames: {
      completed: config.executionContainers.find((c) => c.state === 'completed')?.name ?? null,
      active: config.executionContainers.find((c) => c.state === 'active')?.name ?? null,
      planned: config.executionContainers.filter((c) => c.state === 'planned').map((c) => c.name),
    },
  };
}

// ─── Container Assignment ───

/** Tasks with high cascade value stay in active even if they have no dependencies. */
const CASCADE_THRESHOLD = 10;

function assignContainers(ctx: BuildContext): Record<string, Record<string, string>> {
  const assignments: Record<string, Record<string, string>> = {};

  for (const task of ctx.tasks) {
    const layer = ctx.layers.get(task.ref) ?? 0;
    const cascade = ctx.cascadeValues.get(task.ref) ?? 0;

    let containerName: string | null;

    if (layer === 0 && ctx.containerNames.completed && cascade <= CASCADE_THRESHOLD) {
      containerName = ctx.containerNames.completed;
    } else if (layer <= 1 && ctx.containerNames.active) {
      containerName = ctx.containerNames.active;
    } else if (ctx.containerNames.planned.length > 0) {
      const idx = Math.min(layer - 2, ctx.containerNames.planned.length - 1);
      containerName = ctx.containerNames.planned[Math.max(0, idx)] ?? null;
    } else {
      containerName = ctx.containerNames.active;
    }

    if (containerName) {
      assignments[task.ref] = { [ctx.execContainerType]: containerName };
    }
  }

  if (ctx.config.groupingContainers) {
    assignGroupingContainers(ctx, assignments);
  }

  if (ctx.config.cooldownCount) {
    const allRefs = ctx.tasks.map((t) => t.ref);
    for (const ref of allRefs.slice(-ctx.config.cooldownCount)) {
      assignments[ref] = {};
    }
  }

  return assignments;
}

function assignGroupingContainers(
  ctx: BuildContext,
  assignments: Record<string, Record<string, string>>,
): void {
  if (!ctx.config.groupingContainers) return;

  const groupRefs = Array.from(ctx.groupTaskRefs.keys());
  const containers = ctx.config.groupingContainers;

  for (let i = 0; i < groupRefs.length && i < containers.length; i++) {
    const taskRefs = ctx.groupTaskRefs.get(groupRefs[i]!) ?? [];
    const container = containers[i]!;

    for (const ref of taskRefs) {
      if (assignments[ref]) {
        assignments[ref]![container.containerType] = container.name;
      }
    }
  }
}

// ─── Role Identification ───

function identifyRoles(
  ctx: BuildContext,
  assignments: Record<string, Record<string, string>>,
  integrityViolationRef: string | null,
): ScenarioRoles {
  const activeTasks = ctx.tasks.filter(
    (t) => assignments[t.ref]?.[ctx.execContainerType] === ctx.containerNames.active,
  );
  const completedRefs = ctx.tasks
    .filter((t) => assignments[t.ref]?.[ctx.execContainerType] === ctx.containerNames.completed)
    .map((t) => t.ref);
  const unassignedRefs = ctx.tasks
    .filter((t) => !assignments[t.ref] || Object.keys(assignments[t.ref]!).length === 0)
    .map((t) => t.ref);

  const cascadeBlocker = activeTasks.reduce<string | null>((best, t) => {
    if (!best) return t.ref;
    return (ctx.cascadeValues.get(t.ref) ?? 0) > (ctx.cascadeValues.get(best) ?? 0) ? t.ref : best;
  }, null);

  // Among tasks depending on the blocker, the first two get review roles,
  // the rest become blocked. This ensures the scenario has both a review
  // bottleneck (PR with no reviewers) and a false status (review without PR).
  const dependsOnBlocker = cascadeBlocker
    ? activeTasks.filter((t) => t.dependsOn.includes(cascadeBlocker) && t.ref !== cascadeBlocker)
    : [];

  const reviewBottleneck = dependsOnBlocker[0]?.ref ?? null;
  const falseStatus = dependsOnBlocker[1]?.ref ?? null;
  const blocked = dependsOnBlocker.slice(2).map((t) => t.ref);

  const ready = activeTasks
    .filter((t) => t.ref !== cascadeBlocker && !dependsOnBlocker.some((d) => d.ref === t.ref))
    .map((t) => t.ref);

  const killed = findKilledTaskRefs(ctx);

  return {
    cascadeBlocker,
    reviewBottleneck,
    falseStatus,
    blocked,
    completed: completedRefs,
    ready,
    integrityViolation: integrityViolationRef,
    unassigned: unassignedRefs,
    killed,
  };
}

/**
 * Find the task to move to a wrong container for an integrity violation.
 * Returns null if the profile has no same-container integrity rule.
 */
function findIntegrityViolationRef(
  ctx: BuildContext,
  assignments: Record<string, Record<string, string>>,
): string | null {
  const hasIntegrityRule = ctx.profile.integrityRules?.some(
    (r: { type: string }) => r.type === 'same-container',
  );
  if (!hasIntegrityRule || ctx.containerNames.planned.length === 0) return null;

  let largestGroup: string | null = null;
  let largestCount = 0;
  for (const [groupRef, taskRefs] of ctx.groupTaskRefs) {
    const activeCount = taskRefs.filter(
      (ref) => assignments[ref]?.[ctx.execContainerType] === ctx.containerNames.active,
    ).length;
    if (activeCount > largestCount) {
      largestCount = activeCount;
      largestGroup = groupRef;
    }
  }

  if (!largestGroup || largestCount <= 1) return null;

  const groupRefs = ctx.groupTaskRefs.get(largestGroup)!;
  const activeGroupRefs = groupRefs.filter(
    (ref) => assignments[ref]?.[ctx.execContainerType] === ctx.containerNames.active,
  );
  return activeGroupRefs[activeGroupRefs.length - 1] ?? null;
}

/**
 * Derive killed tasks from groupingContainers with state 'killed'.
 * No index coupling — uses the container state declaration.
 */
function findKilledTaskRefs(ctx: BuildContext): string[] {
  if (!ctx.config.groupingContainers) return [];

  const killed: string[] = [];
  const groupRefs = Array.from(ctx.groupTaskRefs.keys());

  for (let i = 0; i < ctx.config.groupingContainers.length && i < groupRefs.length; i++) {
    if (ctx.config.groupingContainers[i]!.state === 'killed') {
      const taskRefs = ctx.groupTaskRefs.get(groupRefs[i]!) ?? [];
      killed.push(...taskRefs);
    }
  }

  return killed;
}

// ─── State Assignment ───

function assignStates(
  ctx: BuildContext,
  assignments: Record<string, Record<string, string>>,
  roles: ScenarioRoles,
): Record<string, string> {
  const taskStates: Record<string, string> = {};

  for (const task of ctx.tasks) {
    if (roles.killed.includes(task.ref)) {
      taskStates[task.ref] = ctx.states.killed ?? ctx.states.terminal;
    } else if (roles.completed.includes(task.ref)) {
      taskStates[task.ref] = ctx.states.terminal;
    } else if (task.ref === roles.cascadeBlocker) {
      taskStates[task.ref] = ctx.states.active;
    } else if (roles.blocked.includes(task.ref)) {
      taskStates[task.ref] = ctx.states.blocked;
    } else if (task.ref === roles.reviewBottleneck || task.ref === roles.falseStatus) {
      taskStates[task.ref] = ctx.states.review;
    } else if (roles.ready.includes(task.ref)) {
      taskStates[task.ref] = ctx.states.ready;
    } else if (assignments[task.ref]?.[ctx.execContainerType] === ctx.containerNames.active) {
      taskStates[task.ref] = ctx.states.ready;
    } else {
      taskStates[task.ref] = ctx.states.initial;
    }
  }

  return taskStates;
}

// ─── Violations ───

function buildViolations(ctx: BuildContext, roles: ScenarioRoles): ViolationInjection[] {
  const violations: ViolationInjection[] = [];

  if (roles.integrityViolation) {
    const task = ctx.tasksByRef.get(roles.integrityViolation);
    const plannedName = ctx.containerNames.planned[0] ?? 'planned';
    violations.push({
      type: 'INTEGRITY_VIOLATION',
      taskRef: roles.integrityViolation,
      action: { kind: 'wrong_container', containerType: ctx.execContainerType, wrongValue: plannedName },
      description: `${task?.title ?? roles.integrityViolation} moved to ${plannedName}, breaking capability integrity`,
    });
  }

  if (roles.falseStatus) {
    const task = ctx.tasksByRef.get(roles.falseStatus);
    violations.push({
      type: 'FALSE_STATUS',
      taskRef: roles.falseStatus,
      action: { kind: 'false_status', status: ctx.states.review },
      description: `${task?.title ?? roles.falseStatus} shows ${ctx.states.review} but has no PR`,
    });
  }

  return violations;
}

// ─── Container Instances ───

function buildContainerInstances(config: ScenarioConfig): ContainerInstanceDefinition[] {
  const instances: ContainerInstanceDefinition[] = [];
  let counter = 1;

  for (const ec of config.executionContainers) {
    instances.push({
      ref: `EC${counter++}`,
      containerType: ec.containerType,
      name: ec.name,
      state: ec.state,
      description: ec.description,
      metadata: ec.metadata,
    });
  }

  if (config.groupingContainers) {
    for (const gc of config.groupingContainers) {
      instances.push({
        ref: `GC${counter++}`,
        containerType: gc.containerType,
        name: gc.name,
        state: gc.state,
      });
    }
  }

  return instances;
}
