/**
 * Dependency graph analysis — pure functions for computing reverse dependencies,
 * depth layers, and cascade values from a task dependency graph.
 *
 * These algorithms are adapted from WorkDistributionService's scoring patterns
 * but operate on builder Task types rather than GitHub TaskData.
 */

import type { Task } from './types.js';

/** For each task, which other tasks depend on it. */
export function buildReverseDeps(tasks: readonly Task[]): Map<string, string[]> {
  const reverse = new Map<string, string[]>();
  for (const task of tasks) {
    if (!reverse.has(task.ref)) reverse.set(task.ref, []);
    for (const dep of task.dependsOn) {
      const list = reverse.get(dep) ?? [];
      list.push(task.ref);
      reverse.set(dep, list);
    }
  }
  return reverse;
}

/**
 * Dependency depth: layer 0 = no dependencies, layer N = depends on something in layer N-1.
 * Uses DFS with memoization.
 */
export function computeDepthLayers(tasks: readonly Task[]): Map<string, number> {
  const layers = new Map<string, number>();
  const taskRefs = new Set(tasks.map((t) => t.ref));
  const taskByRef = new Map(tasks.map((t) => [t.ref, t]));

  function depth(ref: string): number {
    if (layers.has(ref)) return layers.get(ref)!;
    const task = taskByRef.get(ref);
    if (!task) { layers.set(ref, 0); return 0; }

    let maxParentDepth = -1;
    for (const dep of task.dependsOn) {
      if (taskRefs.has(dep)) {
        maxParentDepth = Math.max(maxParentDepth, depth(dep));
      }
    }
    const d = maxParentDepth + 1;
    layers.set(ref, d);
    return d;
  }

  for (const task of tasks) depth(task.ref);
  return layers;
}

/**
 * Cascade value: how many downstream tasks depend on this one, depth-weighted.
 * BFS on the reverse dependency graph. Depth 1 dependents score 15, depth 2
 * score 8, depth 3+ score 4. Capped at 40. Adapted from WorkDistributionService.
 */
export function computeCascadeValues(
  tasks: readonly Task[],
  reverseDeps: ReadonlyMap<string, readonly string[]>,
): Map<string, number> {
  // Depth-weighted scoring adapted from WorkDistributionService:
  // Direct dependents (depth 1) are high-value unblocks, deeper ones less so.
  const DEPTH_WEIGHTS = [15, 8, 4];
  const values = new Map<string, number>();

  for (const task of tasks) {
    let total = 0;
    const visited = new Set<string>();
    const queue: Array<{ ref: string; depth: number }> = [{ ref: task.ref, depth: 0 }];

    while (queue.length > 0) {
      const { ref, depth } = queue.shift()!;
      for (const dependent of (reverseDeps.get(ref) ?? [])) {
        if (visited.has(dependent)) continue;
        visited.add(dependent);
        const weight = DEPTH_WEIGHTS[Math.min(depth, DEPTH_WEIGHTS.length - 1)]!;
        total += weight;
        queue.push({ ref: dependent, depth: depth + 1 });
      }
    }
    values.set(task.ref, Math.min(total, 40));
  }
  return values;
}
