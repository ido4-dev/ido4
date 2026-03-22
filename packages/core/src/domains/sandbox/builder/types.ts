/**
 * Internal types for the scenario builder pipeline.
 *
 * These types are not exported from the package — they're shared between
 * the builder modules (dependency-graph, seeding, narrative, orchestrator).
 */

import type { IngestSpecResult } from '../../ingestion/types.js';
import type { MethodologyProfile } from '../../../profiles/types.js';
import type { ScenarioConfig } from '../types.js';

export interface Task {
  readonly ref: string;
  readonly issueNumber: number;
  readonly title: string;
  readonly dependsOn: readonly string[];
  readonly groupRef: string | null;
  /** Task body from the technical spec — contains code file references */
  readonly body: string;
}

/** Immutable context computed once, threaded through all builder functions. */
export interface BuildContext {
  readonly tasks: readonly Task[];
  readonly tasksByRef: ReadonlyMap<string, Task>;
  readonly groupTaskRefs: ReadonlyMap<string, readonly string[]>;
  readonly reverseDeps: ReadonlyMap<string, readonly string[]>;
  readonly cascadeValues: ReadonlyMap<string, number>;
  readonly layers: ReadonlyMap<string, number>;
  readonly profile: MethodologyProfile;
  readonly config: ScenarioConfig;
  readonly ingestion: IngestSpecResult;
  readonly execContainerType: string;
  readonly states: StateMapping;
  readonly containerNames: ContainerNames;
}

export interface StateMapping {
  readonly terminal: string;
  readonly active: string;
  readonly review: string;
  readonly ready: string;
  readonly blocked: string;
  readonly initial: string;
  /** Second terminal state if profile has one (e.g., KILLED in Shape Up) */
  readonly killed: string | null;
}

export interface ContainerNames {
  readonly completed: string | null;
  readonly active: string | null;
  readonly planned: readonly string[];
}

/**
 * Roles assigned to specific tasks to create a compelling governance demo.
 * Each role produces a distinct governance signal that skills can discover.
 */
export interface ScenarioRoles {
  /** Task with highest cascade value — in active state, blocking downstream work */
  readonly cascadeBlocker: string | null;
  /** Task in review state WITH a seeded PR — demonstrates stale review */
  readonly reviewBottleneck: string | null;
  /** Task in review state WITHOUT a PR — demonstrates status/PR mismatch */
  readonly falseStatus: string | null;
  /** Tasks blocked because their dependency (the cascade blocker) isn't done */
  readonly blocked: readonly string[];
  /** Tasks in the completed container — already done */
  readonly completed: readonly string[];
  /** Tasks in the active container, ready to start */
  readonly ready: readonly string[];
  /** Task moved to wrong container to violate capability integrity */
  readonly integrityViolation: string | null;
  /** Tasks with no container assignment (cooldown/backlog) */
  readonly unassigned: readonly string[];
  /** Tasks in a killed group (second terminal state) */
  readonly killed: readonly string[];
}
