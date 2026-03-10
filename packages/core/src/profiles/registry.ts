/**
 * ProfileRegistry — Built-in profile lookup, resolution, and validation.
 *
 * Provides:
 * - getBuiltin(id) — lookup by ID
 * - listBuiltin() — list all IDs
 * - resolve(file) — resolve a MethodologyProfileFile (with optional extends) into a MethodologyProfile
 * - validate(profile) — comprehensive consistency checks
 */

import type { MethodologyProfile, MethodologyProfileFile, WorkItemsDefinition } from './types.js';
import { HYDRO_PROFILE } from './hydro.js';
import { SHAPE_UP_PROFILE } from './shape-up.js';
import { SCRUM_PROFILE } from './scrum.js';
import { ConfigurationError } from '../shared/errors/index.js';

const BUILTIN_PROFILES: ReadonlyMap<string, MethodologyProfile> = new Map([
  ['hydro', HYDRO_PROFILE],
  ['shape-up', SHAPE_UP_PROFILE],
  ['scrum', SCRUM_PROFILE],
]);

export class ProfileRegistry {
  static getBuiltin(id: string): MethodologyProfile {
    const profile = BUILTIN_PROFILES.get(id);
    if (!profile) {
      throw new ConfigurationError({
        message: `Unknown methodology profile: "${id}"`,
        context: { profileId: id, available: [...BUILTIN_PROFILES.keys()] },
        remediation: `Use one of: ${[...BUILTIN_PROFILES.keys()].join(', ')}`,
      });
    }
    return profile;
  }

  static listBuiltin(): string[] {
    return [...BUILTIN_PROFILES.keys()];
  }

  static resolve(file: MethodologyProfileFile): MethodologyProfile {
    let base: MethodologyProfile | undefined;

    if (file.extends) {
      base = ProfileRegistry.getBuiltin(file.extends);
    }

    const profile: MethodologyProfile = base
      ? {
          ...base,
          id: file.id,
          name: file.name ?? base.name,
          version: file.version ?? base.version,
          description: file.description ?? base.description,
          states: file.states ?? base.states,
          transitions: file.transitions ?? base.transitions,
          semantics: file.semantics
            ? { ...base.semantics, ...file.semantics }
            : base.semantics,
          containers: file.containers ?? base.containers,
          integrityRules: file.integrityRules ?? base.integrityRules,
          principles: file.principles ?? base.principles,
          workItems: file.workItems
            ? { ...base.workItems, ...file.workItems } as WorkItemsDefinition
            : base.workItems,
          pipelines: file.pipelines
            ? { ...base.pipelines, ...file.pipelines }
            : base.pipelines,
          compliance: file.compliance
            ? { ...base.compliance, ...file.compliance } as MethodologyProfile['compliance']
            : base.compliance,
          behaviors: file.behaviors
            ? { ...base.behaviors, ...file.behaviors }
            : base.behaviors,
        }
      : ProfileRegistry.coerceToProfile(file);

    ProfileRegistry.validate(profile);
    return profile;
  }

  static validate(profile: MethodologyProfile): void {
    const errors: string[] = [];

    // 1. State keys unique
    const stateKeys = new Set(profile.states.map((s) => s.key));
    if (stateKeys.size !== profile.states.length) {
      errors.push('Duplicate state keys detected');
    }

    // 2. Semantic states reference valid keys
    if (!stateKeys.has(profile.semantics.initialState)) {
      errors.push(`initialState "${profile.semantics.initialState}" is not a valid state key`);
    }
    for (const key of profile.semantics.terminalStates) {
      if (!stateKeys.has(key)) errors.push(`terminalState "${key}" not found in states`);
    }
    for (const key of profile.semantics.blockedStates) {
      if (!stateKeys.has(key)) errors.push(`blockedState "${key}" not found in states`);
    }
    for (const key of profile.semantics.activeStates) {
      if (!stateKeys.has(key)) errors.push(`activeState "${key}" not found in states`);
    }
    for (const key of profile.semantics.readyStates) {
      if (!stateKeys.has(key)) errors.push(`readyState "${key}" not found in states`);
    }
    for (const key of profile.semantics.reviewStates) {
      if (!stateKeys.has(key)) errors.push(`reviewState "${key}" not found in states`);
    }

    // 3. Terminal states must match 'done' category
    const doneStates = new Set(
      profile.states.filter((s) => s.category === 'done').map((s) => s.key),
    );
    const terminalSet = new Set(profile.semantics.terminalStates);
    for (const key of doneStates) {
      if (!terminalSet.has(key)) {
        errors.push(`State "${key}" has category 'done' but is not in terminalStates`);
      }
    }
    for (const key of terminalSet) {
      if (!doneStates.has(key)) {
        errors.push(`terminalState "${key}" does not have category 'done'`);
      }
    }

    // 4. Transitions reference valid state keys
    for (const t of profile.transitions) {
      for (const from of t.from) {
        if (!stateKeys.has(from)) {
          errors.push(`Transition "${t.action}": from state "${from}" not found`);
        }
      }
      if (!stateKeys.has(t.to)) {
        errors.push(`Transition "${t.action}": to state "${t.to}" not found`);
      }
    }

    // 5. Container type IDs unique
    const containerIds = new Set(profile.containers.map((c) => c.id));
    if (containerIds.size !== profile.containers.length) {
      errors.push('Duplicate container type IDs detected');
    }

    // 6. Container parent references valid IDs
    for (const c of profile.containers) {
      if (c.parent && !containerIds.has(c.parent)) {
        errors.push(`Container "${c.id}" references unknown parent "${c.parent}"`);
      }
    }

    // 7. Integrity rules reference valid container IDs
    for (const rule of profile.integrityRules) {
      switch (rule.type) {
        case 'same-container':
          if (!containerIds.has(rule.groupBy)) {
            errors.push(`Integrity rule "${rule.id}": groupBy "${rule.groupBy}" not found`);
          }
          if (!containerIds.has(rule.mustMatch)) {
            errors.push(`Integrity rule "${rule.id}": mustMatch "${rule.mustMatch}" not found`);
          }
          break;
        case 'ordering':
          if (!containerIds.has(rule.containerType)) {
            errors.push(`Integrity rule "${rule.id}": containerType "${rule.containerType}" not found`);
          }
          break;
        case 'containment':
          if (!containerIds.has(rule.child)) {
            errors.push(`Integrity rule "${rule.id}": child "${rule.child}" not found`);
          }
          if (!containerIds.has(rule.parent)) {
            errors.push(`Integrity rule "${rule.id}": parent "${rule.parent}" not found`);
          }
          break;
      }
    }

    // 8. Work item defaultType references a valid type
    const typeIds = new Set(profile.workItems.types.map((t) => t.id));
    if (!typeIds.has(profile.workItems.defaultType)) {
      errors.push(`defaultType "${profile.workItems.defaultType}" not found in work item types`);
    }

    // 9. Compliance weights sum to ~1.0
    const weightSum = Object.values(profile.compliance.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      errors.push(`Compliance weights sum to ${weightSum}, expected 1.0`);
    }

    // 10. Compliance lifecycle actions exist in transitions
    const transitionActions = new Set(profile.transitions.map((t) => t.action));
    for (const action of profile.compliance.lifecycle) {
      if (!transitionActions.has(action)) {
        errors.push(`Compliance lifecycle action "${action}" not found in transitions`);
      }
    }

    if (errors.length > 0) {
      throw new ConfigurationError({
        message: `Invalid methodology profile "${profile.id}": ${errors.join('; ')}`,
        context: { profileId: profile.id, errors },
        remediation: 'Fix the profile definition to resolve the listed issues.',
      });
    }
  }

  private static coerceToProfile(file: MethodologyProfileFile): MethodologyProfile {
    if (
      !file.states || !file.transitions || !file.semantics ||
      !file.containers || !file.workItems || !file.pipelines ||
      !file.compliance || !file.behaviors
    ) {
      throw new ConfigurationError({
        message: `Custom profile "${file.id}" must provide all required fields (or use "extends")`,
        context: { profileId: file.id },
        remediation: 'Either extend a built-in profile or provide all required fields.',
      });
    }

    return {
      id: file.id,
      name: file.name ?? file.id,
      version: file.version ?? '1.0',
      description: file.description ?? '',
      states: file.states,
      transitions: file.transitions,
      semantics: {
        ...(file.semantics as MethodologyProfile['semantics']),
        reviewStates: (file.semantics as MethodologyProfile['semantics']).reviewStates ?? [],
      },
      containers: file.containers,
      integrityRules: file.integrityRules ?? [],
      principles: file.principles ?? [],
      workItems: file.workItems as WorkItemsDefinition,
      pipelines: file.pipelines,
      compliance: file.compliance as MethodologyProfile['compliance'],
      behaviors: file.behaviors as MethodologyProfile['behaviors'],
    };
  }
}
