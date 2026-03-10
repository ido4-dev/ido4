/**
 * WorkflowConfig — Implements IWorkflowConfig, now profile-driven.
 *
 * Constructor takes (profile, config). Derives STATUS_KEYS and TRANSITION_PAIRS
 * from profile.states and profile.transitions. Adds semantic methods.
 *
 * All existing methods preserved with identical behavior for Hydro profile.
 */

import type { IProjectConfig, IWorkflowConfig } from '../container/interfaces.js';
import type { MethodologyProfile } from '../profiles/types.js';
import { ConfigurationError } from '../shared/errors/index.js';

export class WorkflowConfig implements IWorkflowConfig {
  private readonly config: IProjectConfig;
  private readonly profile: MethodologyProfile;
  private readonly transitionMap: Set<string>;
  private readonly statusNameCache: Map<string, string>;
  private readonly statusKeyCache: Map<string, string>;
  /** Pre-computed reverse-lookup: status name → valid destination status names */
  private readonly nextTransitionsMap: Map<string, string[]>;
  /** Derived status keys from profile */
  private readonly statusKeys: readonly string[];

  constructor(profile: MethodologyProfile, config: IProjectConfig) {
    this.config = config;
    this.profile = profile;

    // Derive STATUS_KEYS from profile
    this.statusKeys = profile.states.map((s) => s.key);

    // Pre-compute caches
    this.transitionMap = new Set<string>();
    this.statusNameCache = new Map<string, string>();
    this.statusKeyCache = new Map<string, string>();
    const nextMap = new Map<string, Set<string>>();

    for (const key of this.statusKeys) {
      const option = config.status_options[key];
      if (option) {
        this.statusNameCache.set(key, option.name);
        this.statusKeyCache.set(option.name, key);
      }
    }

    // Derive TRANSITION_PAIRS from profile.transitions
    for (const transition of profile.transitions) {
      const toName = this.statusNameCache.get(transition.to);
      if (!toName) continue;

      for (const fromKey of transition.from) {
        const fromName = this.statusNameCache.get(fromKey);
        if (!fromName) continue;

        this.transitionMap.add(`${fromName}->${toName}`);

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
    for (const key of this.statusKeys) {
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

  // ─── New Semantic Methods ───

  getTargetStateKey(fromStateKey: string, action: string): string | undefined {
    for (const t of this.profile.transitions) {
      if (t.action === action && t.from.includes(fromStateKey)) {
        return t.to;
      }
    }
    return undefined;
  }

  isTerminalStatus(statusName: string): boolean {
    const key = this.statusKeyCache.get(statusName);
    if (!key) return false;
    return this.profile.semantics.terminalStates.includes(key);
  }

  isBlockedStatus(statusName: string): boolean {
    const key = this.statusKeyCache.get(statusName);
    if (!key) return false;
    return this.profile.semantics.blockedStates.includes(key);
  }

  isReadyStatus(statusName: string): boolean {
    const key = this.statusKeyCache.get(statusName);
    if (!key) return false;
    return this.profile.semantics.readyStates.includes(key);
  }

  isActiveStatus(statusName: string): boolean {
    const key = this.statusKeyCache.get(statusName);
    if (!key) return false;
    return this.profile.semantics.activeStates.includes(key);
  }

  getStatusKey(statusName: string): string | undefined {
    return this.statusKeyCache.get(statusName);
  }

  private getAvailableFieldKeys(): string[] {
    return Object.keys(this.config.fields)
      .filter((k) => k.endsWith('_field_id'))
      .map((k) => k.replace(/_field_id$/, ''));
  }
}
