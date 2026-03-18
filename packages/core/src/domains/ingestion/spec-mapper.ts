/**
 * Spec Mapper — Transforms a ParsedSpec into a MappedSpec using the active methodology profile.
 *
 * Handles value mapping (effort, risk, ai, type), group → container mapping,
 * and topological sorting of tasks by dependency graph.
 */

import type { MethodologyProfile, ContainerTypeDefinition } from '../../profiles/types.js';
import type {
  ParsedSpec,
  ParsedTask,
  MappedSpec,
  MappedGroupIssue,
  MappedTask,
  MappingError,
} from './types.js';

// ─── Value Mapping Tables ───

const EFFORT_MAP: Record<string, string> = {
  s: 'Small',
  m: 'Medium',
  l: 'Large',
  xl: 'Large',
};

const RISK_MAP: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'High',
};

const AI_MAP: Record<string, string> = {
  full: 'AI_ONLY',
  assisted: 'AI_REVIEWED',
  pair: 'HYBRID',
  human: 'HUMAN_ONLY',
};

const TYPE_MAP: Record<string, string> = {
  feature: 'FEATURE',
  bug: 'BUG',
  research: 'RESEARCH',
  infrastructure: 'INFRASTRUCTURE',
};

// ─── Container Detection ───

export function findGroupingContainer(profile: MethodologyProfile): ContainerTypeDefinition | null {
  return profile.containers.find(c => c.completionRule === 'none' && !c.parent) ?? null;
}

// ─── Topological Sort (Kahn's Algorithm) ───

export function topologicalSort(tasks: MappedTask[]): MappedTask[] | { cycle: string[] } {
  const refToTask = new Map<string, MappedTask>();
  for (const t of tasks) refToTask.set(t.ref, t);

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.ref, 0);
    adjacency.set(t.ref, []);
  }

  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      if (refToTask.has(dep)) {
        adjacency.get(dep)!.push(t.ref);
        inDegree.set(t.ref, (inDegree.get(t.ref) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [ref, degree] of inDegree) {
    if (degree === 0) queue.push(ref);
  }

  const result: MappedTask[] = [];
  while (queue.length > 0) {
    const ref = queue.shift()!;
    result.push(refToTask.get(ref)!);
    for (const neighbor of adjacency.get(ref)!) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (result.length < tasks.length) {
    const remaining = tasks.filter(t => !result.some(r => r.ref === t.ref));
    return { cycle: remaining.map(t => t.ref) };
  }

  return result;
}

// ─── Mapper ───

export function mapSpec(parsed: ParsedSpec, profile: MethodologyProfile): MappedSpec {
  const errors: MappingError[] = [];
  const warnings: string[] = [];

  const groupingContainer = findGroupingContainer(profile);
  const initialStatus = profile.semantics.initialState;

  // Collect all known task refs for dependency validation
  const allRefs = new Set<string>();
  for (const group of parsed.groups) {
    for (const task of group.tasks) allRefs.add(task.ref);
  }
  for (const task of parsed.orphanTasks) allRefs.add(task.ref);

  // Map groups
  const groupIssues: MappedGroupIssue[] = [];
  for (const group of parsed.groups) {
    if (group.tasks.length === 0) continue;

    groupIssues.push({
      ref: `group:${group.name}`,
      title: group.name,
      body: group.description || `Group: ${group.name}`,
      containerTypeId: groupingContainer?.id ?? null,
    });
  }

  // Map tasks
  const allMappedTasks: MappedTask[] = [];

  function mapTask(task: ParsedTask): MappedTask {
    // Validate dependency refs
    const validDeps: string[] = [];
    for (const dep of task.dependsOn) {
      if (allRefs.has(dep)) {
        validDeps.push(dep);
      } else {
        errors.push({
          ref: task.ref,
          message: `Dependency "${dep}" not found in spec`,
        });
      }
    }

    // Map values
    const effort = task.effort ? EFFORT_MAP[task.effort.toLowerCase()] : undefined;
    const riskLevel = task.risk ? RISK_MAP[task.risk.toLowerCase()] : undefined;
    const aiSuitability = task.aiSuitability ? AI_MAP[task.aiSuitability.toLowerCase()] : undefined;
    const taskType = task.taskType ? TYPE_MAP[task.taskType.toLowerCase()] : undefined;

    // Warn on unknown values
    if (task.effort && !effort) {
      warnings.push(`Task ${task.ref}: unknown effort value "${task.effort}"`);
    }
    if (task.risk && !riskLevel) {
      warnings.push(`Task ${task.ref}: unknown risk value "${task.risk}"`);
    }
    if (task.aiSuitability && !aiSuitability) {
      warnings.push(`Task ${task.ref}: unknown ai value "${task.aiSuitability}"`);
    }
    if (task.taskType && !taskType) {
      warnings.push(`Task ${task.ref}: unknown type value "${task.taskType}"`);
    }

    // Critical risk warning
    if (task.risk?.toLowerCase() === 'critical') {
      warnings.push(`Task ${task.ref}: critical risk mapped to High — consider adding a critical-risk label`);
    }

    const groupRef = task.groupName
      ? `group:${task.groupName}`
      : null;

    return {
      ref: task.ref,
      groupRef,
      dependsOn: validDeps,
      request: {
        title: task.title,
        body: task.body,
        initialStatus,
        containers: {},
        dependencies: validDeps.length > 0 ? validDeps.join(', ') : undefined,
        effort,
        riskLevel,
        aiSuitability,
        taskType,
      },
    };
  }

  for (const group of parsed.groups) {
    for (const task of group.tasks) {
      allMappedTasks.push(mapTask(task));
    }
  }
  for (const task of parsed.orphanTasks) {
    allMappedTasks.push(mapTask(task));
  }

  // Topological sort
  const sortResult = topologicalSort(allMappedTasks);
  if (!Array.isArray(sortResult)) {
    errors.push({
      ref: sortResult.cycle.join(', '),
      message: `Circular dependency detected among: ${sortResult.cycle.join(', ')}`,
    });
    // Return unsorted — caller should treat this as fatal
    return { groupIssues, tasks: allMappedTasks, errors, warnings };
  }

  return { groupIssues, tasks: sortResult, errors, warnings };
}
