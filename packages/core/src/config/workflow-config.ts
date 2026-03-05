/**
 * WorkflowConfig — Implements IWorkflowConfig with cached transition map.
 *
 * Changes from CLI:
 * - Pre-computes transition map in constructor for O(1) lookups
 * - Caches workflow constants
 * - Uses scaffold's ConfigurationError
 */

import type { IProjectConfig, IWorkflowConfig } from '../container/interfaces.js';
import { ConfigurationError } from '../shared/errors/index.js';

type WorkflowStatusKey =
  | 'BACKLOG'
  | 'IN_REFINEMENT'
  | 'READY_FOR_DEV'
  | 'BLOCKED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE';

const STATUS_KEYS: readonly WorkflowStatusKey[] = [
  'BACKLOG', 'IN_REFINEMENT', 'READY_FOR_DEV', 'BLOCKED',
  'IN_PROGRESS', 'IN_REVIEW', 'DONE',
];

/** Defines all valid workflow transitions as [fromKey, toKey] pairs. */
const TRANSITION_PAIRS: ReadonlyArray<readonly [WorkflowStatusKey, WorkflowStatusKey]> = [
  // Forward transitions
  ['BACKLOG', 'IN_REFINEMENT'],         // refine
  ['BACKLOG', 'READY_FOR_DEV'],         // ready (fast-track)
  ['IN_REFINEMENT', 'READY_FOR_DEV'],   // ready
  ['READY_FOR_DEV', 'IN_PROGRESS'],     // start
  ['IN_PROGRESS', 'IN_REVIEW'],         // review
  ['IN_REVIEW', 'DONE'],               // approve
  ['DONE', 'DONE'],                     // complete (administrative)
  // Block/unblock
  ['BACKLOG', 'BLOCKED'],
  ['IN_REFINEMENT', 'BLOCKED'],
  ['READY_FOR_DEV', 'BLOCKED'],
  ['IN_PROGRESS', 'BLOCKED'],
  ['IN_REVIEW', 'BLOCKED'],
  ['BLOCKED', 'READY_FOR_DEV'],         // unblock
  // Return (backward)
  ['READY_FOR_DEV', 'IN_REFINEMENT'],
  ['IN_PROGRESS', 'READY_FOR_DEV'],
  ['IN_REVIEW', 'IN_PROGRESS'],
];

export class WorkflowConfig implements IWorkflowConfig {
  private readonly config: IProjectConfig;
  private readonly transitionMap: Set<string>;
  private readonly statusNameCache: Map<string, string>;
  /** Pre-computed reverse-lookup: status name → valid destination status names */
  private readonly nextTransitionsMap: Map<string, string[]>;

  constructor(config: IProjectConfig) {
    this.config = config;

    // Pre-compute transition map for O(1) lookups
    this.transitionMap = new Set<string>();
    this.statusNameCache = new Map<string, string>();
    const nextMap = new Map<string, Set<string>>();

    for (const key of STATUS_KEYS) {
      const option = config.status_options[key];
      if (option) {
        this.statusNameCache.set(key, option.name);
      }
    }

    for (const [fromKey, toKey] of TRANSITION_PAIRS) {
      const fromName = this.statusNameCache.get(fromKey);
      const toName = this.statusNameCache.get(toKey);
      if (fromName && toName) {
        this.transitionMap.add(`${fromName}->${toName}`);
        // Build reverse-lookup for getValidNextTransitions
        let destinations = nextMap.get(fromName);
        if (!destinations) {
          destinations = new Set<string>();
          nextMap.set(fromName, destinations);
        }
        destinations.add(toName);
      }
    }

    // Freeze into arrays for the public API
    this.nextTransitionsMap = new Map<string, string[]>();
    for (const [from, toSet] of nextMap) {
      this.nextTransitionsMap.set(from, [...toSet]);
    }
  }

  getStatusId(key: string): string {
    const option = this.config.status_options[key];
    if (!option) {
      throw new ConfigurationError({
        message: `Unknown status key: ${key}`,
        context: { statusKey: key, availableKeys: Object.keys(this.config.status_options) },
        remediation: `Use one of: ${Object.keys(this.config.status_options).join(', ')}`,
      });
    }
    return option.id;
  }

  getStatusName(key: string): string {
    const option = this.config.status_options[key];
    if (!option) {
      throw new ConfigurationError({
        message: `Unknown status key: ${key}`,
        context: { statusKey: key },
        remediation: `Use one of: ${Object.keys(this.config.status_options).join(', ')}`,
      });
    }
    return option.name;
  }

  getFieldId(key: string): string {
    const fieldKey = `${key}_field_id` as const;
    const id = this.config.fields[fieldKey];
    if (!id) {
      throw new ConfigurationError({
        message: `Unknown field key: ${key}`,
        context: { fieldKey: key },
        remediation: `Use one of: ${this.getAvailableFieldKeys().join(', ')}`,
      });
    }
    return id;
  }

  isValidTransition(from: string, to: string): boolean {
    return this.transitionMap.has(`${from}->${to}`);
  }

  getAllStatusValues(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of STATUS_KEYS) {
      const name = this.statusNameCache.get(key);
      if (name) {
        result[key] = name;
      }
    }
    return result;
  }

  getValidNextTransitions(fromStatus: string): string[] {
    return this.nextTransitionsMap.get(fromStatus) ?? [];
  }

  private getAvailableFieldKeys(): string[] {
    return Object.keys(this.config.fields)
      .filter((k) => k.endsWith('_field_id'))
      .map((k) => k.replace(/_field_id$/, ''));
  }
}
