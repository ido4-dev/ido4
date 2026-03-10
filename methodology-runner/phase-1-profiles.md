# Phase 1: Profile Foundation

**Goal:** Introduce `MethodologyProfile` types, 3 built-in profiles (Hydro, Shape Up, Scrum), and a profile registry — without changing any runtime behavior. The engine continues using hardcoded constants. Phase 2+ will wire the profile into services.

**Prerequisites:** Phase 0 complete (all renames done, 1074 tests pass).

---

## New Files (5)

### 1. `packages/core/src/profiles/types.ts`

All type definitions from spec section 2.1–2.7, 2.9:

```typescript
// --- Core Profile Interface ---
export interface MethodologyProfile {
  id: string;
  name: string;
  version: string;
  description: string;
  states: StateDefinition[];
  transitions: TransitionDefinition[];
  semantics: {
    initialState: string;
    terminalStates: string[];
    blockedStates: string[];
    activeStates: string[];
    readyStates: string[];
  };
  containers: ContainerTypeDefinition[];
  integrityRules: IntegrityRuleDefinition[];
  principles: PrincipleDefinition[];
  workItems: WorkItemsDefinition;
  pipelines: Record<string, { steps: string[] }>;
  compliance: {
    lifecycle: string[];
    weights: Record<string, number>;
  };
  behaviors: {
    closingTransitions: string[];
    blockTransition?: string;
    returnTransition?: string;
  };
}

// --- State Machine ---
export interface StateDefinition {
  key: string;
  name: string;
  category: 'todo' | 'active' | 'done' | 'blocked';
}

export interface TransitionDefinition {
  action: string;
  from: string[];
  to: string;
  label: string;
  backward?: boolean;
}

// --- Container Types ---
export interface ContainerTypeDefinition {
  id: string;
  singular: string;
  plural: string;
  taskField: string;
  fieldType?: 'text' | 'single_select' | 'number' | 'iteration';
  namePattern?: string;
  nameExample?: string;
  singularity?: boolean;
  completionRule?: 'all-terminal' | 'timebox-expires' | 'none';
  parent?: string;
  managed?: boolean;
}

// --- Integrity Rules (discriminated union) ---
export type IntegrityRuleDefinition =
  | SameContainerRule
  | OrderingRule
  | ContainmentRule;

interface BaseIntegrityRule {
  id: string;
  description: string;
  severity: 'error' | 'warning';
  principleId: string;
}

export interface SameContainerRule extends BaseIntegrityRule {
  type: 'same-container';
  groupBy: string;
  mustMatch: string;
}

export interface OrderingRule extends BaseIntegrityRule {
  type: 'ordering';
  containerType: string;
}

export interface ContainmentRule extends BaseIntegrityRule {
  type: 'containment';
  child: string;
  parent: string;
}

// --- Principles ---
export interface PrincipleDefinition {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning';
  enforcement?: {
    type: 'integrity-rule' | 'validation-step' | 'container-constraint';
    ref: string;
  };
}

// --- Work Items ---
export interface WorkItemsDefinition {
  primary: { singular: string; plural: string };
  typeSource: {
    method: 'label' | 'field';
    identifier: string;
  };
  defaultType: string;
  types: WorkItemTypeDefinition[];
  hierarchy?: WorkItemHierarchyLevel[];
}

export interface WorkItemTypeDefinition {
  id: string;
  name: string;
  sourceValue?: string;
  standardLifecycle: boolean;
  lifecycle?: {
    states: StateDefinition[];
    transitions: TransitionDefinition[];
    semantics: MethodologyProfile['semantics'];
    pipelines: Record<string, { steps: string[] }>;
  };
}

export interface WorkItemHierarchyLevel {
  typeId: string;
  children?: string[];
  childCompletionRequired?: boolean;
}

// --- Profile File Format (for custom .ido4/methodology-profile.json) ---
export interface MethodologyProfileFile {
  extends?: string;
  id: string;
  name?: string;
  version?: string;
  description?: string;
  states?: StateDefinition[];
  transitions?: TransitionDefinition[];
  semantics?: Partial<MethodologyProfile['semantics']>;
  containers?: ContainerTypeDefinition[];
  integrityRules?: IntegrityRuleDefinition[];
  principles?: PrincipleDefinition[];
  workItems?: Partial<WorkItemsDefinition>;
  pipelines?: Record<string, { steps: string[] }>;
  compliance?: Partial<MethodologyProfile['compliance']>;
  behaviors?: Partial<MethodologyProfile['behaviors']>;
}
```

### 2. `packages/core/src/profiles/hydro.ts`

Exact Hydro profile from spec section 4.1. Must produce identical validation behavior to current `DEFAULT_METHODOLOGY` + `WORKFLOW_STATUSES` + `TRANSITION_PAIRS` + `REQUIRED_STATUSES`.

Key verification: the `pipelines` section must match `DEFAULT_METHODOLOGY.pipelines` from `methodology-config.ts` exactly, but using the spec's parameterized step names. Differences from current `DEFAULT_METHODOLOGY`:

| Current step name | Profile step name | Notes |
|---|---|---|
| `RefineFromBacklogValidation` | `SourceStatusValidation:BACKLOG` | Generic parameterized equivalent |
| `ReadyFromRefinementOrBacklogValidation` | `SourceStatusValidation:IN_REFINEMENT,BACKLOG` | Multi-source generic |
| `StartFromReadyForDevValidation` | `SourceStatusValidation:READY_FOR_DEV` | Generic parameterized |
| `WaveAssignmentValidation` | `ContainerAssignmentValidation:wave` | Parameterized by container type |
| `EpicIntegrityValidation` | `ContainerIntegrityValidation:epic-wave-integrity` | Parameterized by rule ID |

**IMPORTANT:** These new step names will NOT be used yet in Phase 1. The profile is data-only. The BRE continues using `DEFAULT_METHODOLOGY` with the old step names. Phase 3 will register the new generic step names and wire profiles into the BRE.

### 3. `packages/core/src/profiles/shape-up.ts`

Shape Up profile from spec section 4.2. 3 containers (cycle, bet, scope), 8 states including `KILLED`, `SHIPPED` terminal states.

### 4. `packages/core/src/profiles/scrum.ts`

Scrum profile from spec section 4.3. Type-scoped pipelines (`plan:story`, `plan:bug`, `plan:spike`, `start:bug`, `approve:spike`, `approve:tech-debt`). 1 container (sprint), 5 work item types.

### 5. `packages/core/src/profiles/registry.ts`

```typescript
import type { MethodologyProfile, MethodologyProfileFile } from './types.js';
import { HYDRO_PROFILE } from './hydro.js';
import { SHAPE_UP_PROFILE } from './shape-up.js';
import { SCRUM_PROFILE } from './scrum.js';
import { ConfigurationError } from '../shared/errors/index.js';

/** Built-in profiles, keyed by ID */
const BUILTIN_PROFILES: ReadonlyMap<string, MethodologyProfile> = new Map([
  ['hydro', HYDRO_PROFILE],
  ['shape-up', SHAPE_UP_PROFILE],
  ['scrum', SCRUM_PROFILE],
]);

export class ProfileRegistry {
  /**
   * Get a built-in profile by ID.
   * @throws ConfigurationError if not found
   */
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

  /** List all built-in profile IDs */
  static listBuiltin(): string[] {
    return [...BUILTIN_PROFILES.keys()];
  }

  /**
   * Resolve a MethodologyProfileFile (with optional `extends`) into a
   * fully merged MethodologyProfile.
   *
   * Resolution rules:
   * - If `extends` is set, load the base profile and deep-merge overrides
   * - Arrays (states, transitions, containers, etc.) are REPLACED wholesale
   * - Objects (semantics, compliance, behaviors) are shallow-merged
   * - Validates the result
   */
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
            ? { ...base.workItems, ...file.workItems }
            : base.workItems,
          pipelines: file.pipelines
            ? { ...base.pipelines, ...file.pipelines }
            : base.pipelines,
          compliance: file.compliance
            ? { ...base.compliance, ...file.compliance }
            : base.compliance,
          behaviors: file.behaviors
            ? { ...base.behaviors, ...file.behaviors }
            : base.behaviors,
        }
      : ProfileRegistry.validateAndCoerce(file);

    ProfileRegistry.validate(profile);
    return profile;
  }

  /**
   * Validate a resolved profile for internal consistency.
   * @throws ConfigurationError on validation failures
   */
  static validate(profile: MethodologyProfile): void {
    const errors: string[] = [];

    // 1. All state keys unique
    const stateKeys = new Set(profile.states.map(s => s.key));
    if (stateKeys.size !== profile.states.length) {
      errors.push('Duplicate state keys detected');
    }

    // 2. Semantic states reference valid state keys
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

    // 3. Terminal states must match 'done' category states
    const doneStates = new Set(profile.states.filter(s => s.category === 'done').map(s => s.key));
    const terminalSet = new Set(profile.semantics.terminalStates);
    for (const key of doneStates) {
      if (!terminalSet.has(key)) errors.push(`State "${key}" has category 'done' but is not in terminalStates`);
    }
    for (const key of terminalSet) {
      if (!doneStates.has(key)) errors.push(`terminalState "${key}" does not have category 'done'`);
    }

    // 4. Transitions reference valid state keys
    for (const t of profile.transitions) {
      for (const from of t.from) {
        if (!stateKeys.has(from)) errors.push(`Transition "${t.action}": from state "${from}" not found`);
      }
      if (!stateKeys.has(t.to)) errors.push(`Transition "${t.action}": to state "${t.to}" not found`);
    }

    // 5. Container type IDs unique
    const containerIds = new Set(profile.containers.map(c => c.id));
    if (containerIds.size !== profile.containers.length) {
      errors.push('Duplicate container type IDs detected');
    }

    // 6. Container parent references valid container IDs
    for (const c of profile.containers) {
      if (c.parent && !containerIds.has(c.parent)) {
        errors.push(`Container "${c.id}" references unknown parent "${c.parent}"`);
      }
    }

    // 7. Integrity rules reference valid container IDs
    for (const rule of profile.integrityRules) {
      switch (rule.type) {
        case 'same-container':
          if (!containerIds.has(rule.groupBy)) errors.push(`Integrity rule "${rule.id}": groupBy "${rule.groupBy}" not found`);
          if (!containerIds.has(rule.mustMatch)) errors.push(`Integrity rule "${rule.id}": mustMatch "${rule.mustMatch}" not found`);
          break;
        case 'ordering':
          if (!containerIds.has(rule.containerType)) errors.push(`Integrity rule "${rule.id}": containerType "${rule.containerType}" not found`);
          break;
        case 'containment':
          if (!containerIds.has(rule.child)) errors.push(`Integrity rule "${rule.id}": child "${rule.child}" not found`);
          if (!containerIds.has(rule.parent)) errors.push(`Integrity rule "${rule.id}": parent "${rule.parent}" not found`);
          break;
      }
    }

    // 8. Work item defaultType references a valid type ID
    const typeIds = new Set(profile.workItems.types.map(t => t.id));
    if (!typeIds.has(profile.workItems.defaultType)) {
      errors.push(`defaultType "${profile.workItems.defaultType}" not found in work item types`);
    }

    // 9. Compliance weights sum to ~1.0
    const weightSum = Object.values(profile.compliance.weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1.0) > 0.01) {
      errors.push(`Compliance weights sum to ${weightSum}, expected 1.0`);
    }

    // 10. Compliance lifecycle actions must exist in transitions
    const transitionActions = new Set(profile.transitions.map(t => t.action));
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

  /**
   * Coerce a MethodologyProfileFile (without extends) into a MethodologyProfile.
   * Fills in required fields with reasonable defaults where possible.
   */
  private static validateAndCoerce(file: MethodologyProfileFile): MethodologyProfile {
    // For non-extending profiles, all required fields must be present
    if (!file.states || !file.transitions || !file.semantics || !file.containers ||
        !file.workItems || !file.pipelines || !file.compliance || !file.behaviors) {
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
      semantics: file.semantics as MethodologyProfile['semantics'],
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
```

### 6. `packages/core/src/profiles/index.ts` (barrel)

```typescript
export type {
  MethodologyProfile,
  StateDefinition,
  TransitionDefinition,
  ContainerTypeDefinition,
  IntegrityRuleDefinition,
  SameContainerRule,
  OrderingRule,
  ContainmentRule,
  PrincipleDefinition,
  WorkItemsDefinition,
  WorkItemTypeDefinition,
  WorkItemHierarchyLevel,
  MethodologyProfileFile,
} from './types.js';
export { HYDRO_PROFILE } from './hydro.js';
export { SHAPE_UP_PROFILE } from './shape-up.js';
export { SCRUM_PROFILE } from './scrum.js';
export { ProfileRegistry } from './registry.js';
```

---

## Modified Files (0 in Phase 1)

**Critical decision: NO source file modifications in Phase 1.**

The spec says Phase 1 modifies 5 files (service-container.ts, workflow-config.ts, methodology-config.ts, project-config-loader.ts, input-sanitizer.ts). But those modifications require the profile to actually drive behavior — that's Phases 2–3. Phase 1 is purely additive: types + data + registry + tests.

If we modified `WorkflowConfig` to take a `MethodologyProfile` in Phase 1, we'd need to change the `ServiceContainer.create()` flow, which cascades to profile loading, config resolution, etc. — that's structural, not "zero behavioral change."

Phase 1 deliverable: the profile system exists, validates, passes its own tests, and is exported. Phase 2 wires it in.

---

## Barrel Export Addition

Add to `packages/core/src/index.ts`:

```typescript
// Profiles
export type {
  MethodologyProfile,
  StateDefinition,
  TransitionDefinition,
  ContainerTypeDefinition,
  IntegrityRuleDefinition,
  SameContainerRule,
  OrderingRule,
  ContainmentRule,
  PrincipleDefinition,
  WorkItemsDefinition,
  WorkItemTypeDefinition,
  WorkItemHierarchyLevel,
  MethodologyProfileFile,
} from './profiles/index.js';
export { HYDRO_PROFILE, SHAPE_UP_PROFILE, SCRUM_PROFILE, ProfileRegistry } from './profiles/index.js';
```

---

## Tests to Write

### `packages/core/tests/profiles/profile-types.test.ts`

Tests for profile type contracts (structural validation):

- [ ] Hydro profile has all required MethodologyProfile fields
- [ ] Shape Up profile has all required fields
- [ ] Scrum profile has all required fields
- [ ] Hydro states map to current WORKFLOW_STATUSES exactly
- [ ] Hydro transitions cover all current TRANSITION_PAIRS
- [ ] Hydro pipeline actions match DEFAULT_METHODOLOGY pipeline keys
- [ ] Shape Up has 3 container types (cycle, bet, scope)
- [ ] Scrum has type-scoped pipelines (6 overrides: plan:story, plan:bug, plan:spike, start:bug, approve:spike, approve:tech-debt)

### `packages/core/tests/profiles/profile-registry.test.ts`

Tests for ProfileRegistry:

- [ ] `getBuiltin('hydro')` returns HYDRO_PROFILE
- [ ] `getBuiltin('shape-up')` returns SHAPE_UP_PROFILE
- [ ] `getBuiltin('scrum')` returns SCRUM_PROFILE
- [ ] `getBuiltin('unknown')` throws ConfigurationError
- [ ] `listBuiltin()` returns ['hydro', 'shape-up', 'scrum']

### `packages/core/tests/profiles/profile-validation.test.ts`

Tests for ProfileRegistry.validate():

- [ ] Valid Hydro profile passes validation
- [ ] Valid Shape Up profile passes validation
- [ ] Valid Scrum profile passes validation
- [ ] Profile with unknown initialState fails
- [ ] Profile with terminalState not in states fails
- [ ] Profile with 'done' category state not in terminalStates fails
- [ ] Profile with terminalState not having 'done' category fails
- [ ] Profile with transition referencing unknown from-state fails
- [ ] Profile with transition referencing unknown to-state fails
- [ ] Profile with duplicate state keys fails
- [ ] Profile with duplicate container IDs fails
- [ ] Profile with container referencing unknown parent fails
- [ ] Profile with integrity rule referencing unknown container fails
- [ ] Profile with unknown defaultType fails
- [ ] Profile with compliance weights not summing to 1.0 fails
- [ ] Profile with compliance lifecycle action not in transitions fails

### `packages/core/tests/profiles/profile-inheritance.test.ts`

Tests for ProfileRegistry.resolve():

- [ ] resolve() with no extends validates and returns a MethodologyProfile
- [ ] resolve() with extends:'scrum' inherits base profile
- [ ] Override states replaces base states wholesale
- [ ] Override semantics shallow-merges (can override just initialState)
- [ ] Override pipelines merges (adds new action, replaces existing)
- [ ] Missing required fields without extends throws ConfigurationError
- [ ] Invalid extends target throws ConfigurationError

---

## Checklist

### New Files
- [ ] `packages/core/src/profiles/types.ts`
- [ ] `packages/core/src/profiles/hydro.ts`
- [ ] `packages/core/src/profiles/shape-up.ts`
- [ ] `packages/core/src/profiles/scrum.ts`
- [ ] `packages/core/src/profiles/registry.ts`
- [ ] `packages/core/src/profiles/index.ts`

### Tests
- [ ] `packages/core/tests/profiles/profile-types.test.ts`
- [ ] `packages/core/tests/profiles/profile-registry.test.ts`
- [ ] `packages/core/tests/profiles/profile-validation.test.ts`
- [ ] `packages/core/tests/profiles/profile-inheritance.test.ts`

### Integration
- [ ] Add profile exports to `packages/core/src/index.ts`
- [ ] `npm run build` passes
- [ ] All existing 1074 tests still pass
- [ ] All new profile tests pass
- [ ] No changes to existing behavior

### Verification
- [ ] Hydro profile states exactly match `WORKFLOW_STATUSES`
- [ ] Hydro profile transitions cover all `TRANSITION_PAIRS`
- [ ] Hydro profile pipeline keys match `DEFAULT_METHODOLOGY.pipelines` keys
- [ ] Shape Up profile has circuit breaker (kill transition to KILLED state)
- [ ] Scrum profile has type-scoped pipelines for different DoR/DoD per type
- [ ] Profile validation catches all categories of errors

---

## Decisions for Later Phases

- **Phase 2**: Wire profile into ServiceContainer.create() (accept profileId config, load profile, pass to services)
- **Phase 2**: Register generic parameterized steps (SourceStatusValidation, ContainerAssignmentValidation, ContainerIntegrityValidation) as aliases
- **Phase 3**: Replace WorkflowConfig constants with profile-driven construction
- **Phase 3**: Replace MethodologyConfig.DEFAULT_METHODOLOGY with profile.pipelines
- **Phase 3**: Replace REQUIRED_STATUSES with profile.states validation
- **Phase 3**: Replace CONTAINER_FORMAT_PATTERN with container namePattern from profile
- **Phase 4**: Generate MCP tools dynamically from profile

---

## Scope Boundary

**IN scope:**
- All type definitions from spec 2.1–2.9
- All 3 built-in profiles (Hydro, Shape Up, Scrum)
- Profile registry with get/list/resolve/validate
- Profile inheritance resolution
- Comprehensive validation
- Barrel exports

**OUT of scope (deferred):**
- Loading profiles from `.ido4/methodology-profile.json` (Phase 2 — needs filesystem integration in ServiceContainer)
- Wiring profiles into any existing service (Phase 2+)
- Replacing any hardcoded constants (Phase 3)
- MCP tool adaptation (Phase 4)
- Profile-driven init_project (Phase 5)
