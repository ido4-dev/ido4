# Methodology Runner Architecture

## The System of the Future — v3

**Author:** Claude (Opus 4.6), commissioned by Bogdan Coman
**Date:** 2026-03-07
**Status:** Architecture Specification (Pre-Implementation)

---

## 1. Design Philosophy

### 1.1 The Deeper Insight

The previous architecture (v2) made a subtle but critical error: it assumed every methodology has exactly one "execution unit" (wave/sprint/cycle) and exactly one "grouping" (epic/bet/story). It replaced methodology-specific names with generic ones — `ExecutionUnitService`, `GroupingService` — but kept the two-slot structure hardcoded.

This is still a 1:1 mapping. It just uses different words.

Real methodologies have fundamentally different ontologies:

| Methodology | Container types | Notes |
|---|---|---|
| **Hydro** | Wave (execution), Epic (grouping) | 2 containers, integrity rule between them |
| **Shape Up** | Cycle (execution), Bet (grouping), Scope (sub-grouping within bet) | 3 containers, circuit breaker on cycle |
| **Scrum** | Sprint (execution) | 1 container, no grouping integrity rule |
| **SAFe** | PI (macro execution), Sprint (micro execution), Feature (grouping) | 3 containers, 2 nested execution levels |

A two-slot model cannot represent this. Shape Up's Scope is neither an execution unit nor a grouping in the Hydro sense — it's an emergent sub-division within a bet. SAFe's PI contains Sprints, which is a nesting relationship that doesn't exist in flat models.

The correct abstraction is: **the engine knows about containers, but the profile defines how many types exist, what each one means, and how they relate to each other.**

### 1.2 What the Engine Knows vs What the Profile Knows

The engine is a methodology runner. It provides generic primitives. The profile is the methodology. It provides all domain knowledge.

**The engine knows:**

- Work items have types, states, and belong to containers. Types are profile-defined.
- States change via transitions. Transitions are validated by type-scoped pipelines.
- Work items can be assigned to containers. Containers are typed.
- Containers can have relationships (integrity, nesting, ordering).
- Everything is audited. Metrics are computed. Compliance is scored.

**The engine does NOT know:**

- What any work item type means ("task", "user story", "scope" — just typed items)
- What any state means ("Backlog", "Building", "Done" — just strings)
- What any transition means ("refine", "ship", "kill" — just strings)
- What any container means ("wave", "sprint", "cycle" — just typed containers)
- What any principle means ("epic integrity", "circuit breaker" — just rules to enforce)
- How many container types or work item types exist
- How containers relate to each other
- What the lifecycle looks like, or whether different types have different lifecycles

All of this comes from the profile.

### 1.3 Guiding Principles

1. **Profile is data, engine is code.** A methodology is a data structure. The engine interprets it. Zero methodology-specific code in the engine.

2. **Containers are the universal abstraction.** The engine provides a single `ContainerService` that manages any number of container types defined by the profile. No hardcoded "execution unit" or "grouping" slots.

3. **Relationships are declared, not assumed.** The profile declares integrity rules, nesting relationships, and ordering constraints between container types. The engine enforces them generically.

4. **The engine doesn't grow per methodology.** Adding SAFe requires a new profile file and possibly custom validation steps. Zero changes to engine code.

5. **Behavioral semantics over named concepts.** The engine doesn't know "Done" — it knows "terminal states." It doesn't know "In Progress" — it knows "active states." The profile maps its states to these semantic categories.

6. **Single source of truth.** The profile replaces `WORKFLOW_STATUSES`, `TRANSITION_PAIRS`, `DEFAULT_METHODOLOGY`, `getTargetStatusKey()`, `REQUIRED_STATUSES`, `WAVE_FORMAT_PATTERN`, `FULL_LIFECYCLE`, and compliance `WEIGHTS`. One profile, one truth.

### 1.4 Terminology in Code

The engine codebase uses methodology-neutral terms throughout:

| Concept | Engine term | Never appears in engine code |
|---|---|---|
| Task / User Story / Scope | `workItem` | "task", "story", "scope" as fixed concepts |
| Bug / Spike / Chore / Tech Debt | `workItemType` | any specific type name |
| Wave / Sprint / Cycle / PI | `container` | "wave", "sprint", "cycle" |
| Epic / Bet / Feature / Scope | `container` (different type) | "epic", "bet", "feature" |
| Backlog / Raw Idea / To Do | `state` | any specific state name |
| refine / shape / start | `transition` | any specific transition name |
| Epic Integrity / Circuit Breaker | `integrityRule` / `principle` | any specific rule name |
| DoR / DoD | type-scoped pipeline | "Definition of Ready", "Definition of Done" |

The profile provides the user-facing terminology. MCP tool descriptions, error messages, and suggestions all use the profile's labels.

---

## 2. The Methodology Profile

### 2.1 Interface Definition

```typescript
/**
 * MethodologyProfile — The single source of truth for a development methodology.
 *
 * Defines everything the governance engine needs to enforce a methodology:
 * state machine, container types and their relationships, validation pipelines,
 * principles, compliance scoring, and user-facing terminology.
 *
 * Built-in profiles (hydro.ts, shape-up.ts) are TypeScript files.
 * Custom profiles are JSON files at .ido4/methodology-profile.json.
 */
export interface MethodologyProfile {
  // --- Identity ---
  id: string;                          // 'hydro' | 'shape-up' | 'scrum' | 'safe'
  name: string;                        // 'Hydro — Wave-Based Governance'
  version: string;                     // '1.0'
  description: string;                 // One-line description for tooling

  // --- State Machine ---
  states: StateDefinition[];
  transitions: TransitionDefinition[];

  // --- Semantic Categories ---
  // Maps methodology-specific states to engine-understood behavioral categories.
  // The engine never references state names — only these semantic groups.
  semantics: {
    initialState: string;              // state key for new tasks
    terminalStates: string[];          // states that mean "finished" (done, shipped, killed)
    blockedStates: string[];           // states that mean "blocked"
    activeStates: string[];            // states that mean "work in progress"
    readyStates: string[];             // states that mean "ready to be picked up"
  };

  // --- Container Types ---
  // Every methodology organizes tasks into containers.
  // Hydro has 2 (wave, epic). Shape Up has 3 (cycle, bet, scope). SAFe has 3 (pi, sprint, feature).
  // The engine provides generic container management for ALL of them.
  containers: ContainerTypeDefinition[];

  // --- Cross-Container Rules ---
  // Declares how container types relate to each other.
  // The engine enforces these generically without knowing what the containers mean.
  integrityRules: IntegrityRuleDefinition[];

  // --- Governance Principles ---
  // Named rules for documentation, compliance scoring, and error messages.
  // Each principle maps to either an integrity rule, a container constraint,
  // or a validation step in the pipeline.
  principles: PrincipleDefinition[];

  // --- Work Item Types ---
  // Defines the kinds of work items the methodology uses (task, user story, bug, etc.)
  // and how they differ in terminology, validation rules, and lifecycle.
  workItems: WorkItemsDefinition;

  // --- BRE Validation Pipelines ---
  // Each transition action maps to an ordered list of validation step names.
  // Step names use colon-separated parameters: 'SourceStatusValidation:BACKLOG'
  //
  // Type-scoped pipelines: a key like 'start:bug' overrides 'start' for work items
  // of type 'bug'. The engine resolves: look for '{action}:{type}' first, fall back to '{action}'.
  // This enables different DoR/DoD/validation rules per work item type.
  pipelines: Record<string, { steps: string[] }>;

  // --- Compliance Scoring ---
  compliance: {
    /** Expected happy-path transition sequence for process adherence scoring */
    lifecycle: string[];               // ['refine', 'ready', 'start', 'review', 'approve']
    /** Category weights — keys are profile-defined, must sum to 1.0 */
    weights: Record<string, number>;
  };

  // --- Behavioral Hooks ---
  // Tells the engine which transitions have special side effects.
  behaviors: {
    /** Transitions that close the issue (GitHub issue close) */
    closingTransitions: string[];      // ['approve'] or ['ship', 'kill']
    /** Transition that adds a "Blocked: reason" comment */
    blockTransition?: string;
    /** Transition that adds a "Returned: reason" comment */
    returnTransition?: string;
  };
}
```

### 2.2 State Definition

```typescript
export interface StateDefinition {
  /** Internal key used in config, validation, and status_options mapping */
  key: string;                         // 'BUILDING', 'READY_FOR_DEV'
  /** Display name (shown to users, stored in GitHub project) */
  name: string;                        // 'Building', 'Ready for Dev'
  /** Coarse 4-way classification — used for UI grouping (kanban columns, board views).
   *  The engine does NOT use category directly for behavioral decisions. */
  category: 'todo' | 'active' | 'done' | 'blocked';
}
```

**Relationship between `category` and `semantics`:**

`category` provides coarse UI grouping. `semantics` provides precise behavioral mapping for the engine. They are related but not identical:

- `semantics.readyStates` is a **subset** of 'todo' category states. In Hydro, BACKLOG and IN_REFINEMENT are 'todo' but only READY_FOR_DEV is a readyState.
- `semantics.terminalStates` must **equal** all states with `category: 'done'`.
- `semantics.activeStates` must **equal** all states with `category: 'active'`.
- `semantics.blockedStates` must **equal** all states with `category: 'blocked'`.
- `semantics.initialState` must have `category: 'todo'`.

The engine validates these constraints at profile load time. If a profile declares a state as `category: 'done'` but omits it from `semantics.terminalStates`, validation fails with a clear error.

Why keep both? `category` enables generic UI rendering without needing the full semantics object. `semantics.readyStates` enables the engine to answer "which tasks are available for work?" — a behavioral question that the coarse `'todo'` category cannot answer (BACKLOG tasks are not ready).

### 2.3 Transition Definition

```typescript
export interface TransitionDefinition {
  /** The action name — used as the transition identifier */
  action: string;                      // 'build', 'ship', 'refine'
  /** Source state keys this transition is valid from */
  from: string[];                      // ['BET']
  /** Target state key this transition moves to */
  to: string;                          // 'BUILDING'
  /** Human-readable label for this transition */
  label: string;                       // 'Start building'
  /** Is this a backward (return) transition? */
  backward?: boolean;
}
```

**Multiple transitions with the same action:** An action like `return` can appear in multiple `TransitionDefinition` entries with different `from`/`to` pairs. The engine resolves which applies by matching the task's current state against `from[]`. Example: if a task is IN_REVIEW and the action is `return`, the engine finds `{ action: 'return', from: ['IN_REVIEW'], to: 'IN_PROGRESS' }` and uses that target. The caller does NOT choose the target — the profile determines it. If a `ReturnTaskRequest` includes `targetStatus`, the engine validates it matches the profile's resolved target (mismatch = error, not override). This makes the profile authoritative while catching stale client assumptions.

### 2.4 Container Type Definition

This is the key abstraction that replaces the hardcoded "wave" and "epic" concepts.

```typescript
export interface ContainerTypeDefinition {
  /** Unique identifier for this container type within the profile */
  id: string;                          // 'wave', 'epic', 'cycle', 'bet', 'scope', 'pi', 'sprint'

  /** User-facing terminology */
  singular: string;                    // 'Wave', 'Epic', 'Cycle', 'Bet'
  plural: string;                      // 'Waves', 'Epics', 'Cycles', 'Bets'

  /** The task field that holds this container's value.
   *  Maps to a GitHub Projects field name. */
  taskField: string;                   // 'Wave', 'Epic', 'Sprint', 'Cycle'

  /** GitHub Projects field type for this container.
   *  Used by init_project when creating the field. Defaults to 'text'. */
  fieldType?: 'text' | 'single_select' | 'number' | 'iteration';  // default: 'text'

  /** Regex pattern for valid container names (optional) */
  namePattern?: string;                // '^wave-\\d{3}-[a-z0-9-]+$'
  /** Example of a valid name (for error messages) */
  nameExample?: string;                // 'wave-001-auth-system'

  /** Only one container of this type can be active at a time */
  singularity?: boolean;               // true for waves, cycles, sprints

  /** How completion is determined for this container */
  completionRule?: 'all-terminal'      // all tasks must be in a terminal state (per semantics.terminalStates)
    | 'timebox-expires'                // sprint: ends when time runs out
    | 'none';                          // epic/bet: no container-level completion

  /** Nesting — this container type lives inside another.
   *  E.g., SAFe Sprint is nested inside PI. Shape Up Scope is nested inside Bet. */
  parent?: string;                     // container type ID of parent

  /** Whether the engine should provide list/assign/validate operations.
   *  Some containers (like scopes) are informational only. */
  managed?: boolean;                   // default true
}
```

### 2.5 Integrity Rule Definition

Integrity rules declare relationships between container types that the engine enforces generically.

```typescript
/**
 * Discriminated union — each rule type has fields named for its semantics.
 * This eliminates the ambiguity of generic source/target across different rule types.
 */
export type IntegrityRuleDefinition =
  | SameContainerRule
  | OrderingRule
  | ContainmentRule;

interface BaseIntegrityRule {
  id: string;                          // 'epic-wave-integrity'
  description: string;                 // 'All tasks in the same epic must be in the same wave'
  severity: 'error' | 'warning';
  principleId: string;                 // 'epic-integrity'
}

/** All tasks sharing the same groupBy value must share the same mustMatch value. */
export interface SameContainerRule extends BaseIntegrityRule {
  type: 'same-container';
  /** Container type that groups tasks (e.g., 'epic') */
  groupBy: string;
  /** Container type that must be uniform within each group (e.g., 'wave') */
  mustMatch: string;
}

/** Dependency ordering: a task's container value must be >= its dependency tasks' values. */
export interface OrderingRule extends BaseIntegrityRule {
  type: 'ordering';
  /** Container type whose values must respect dependency ordering (e.g., 'wave') */
  containerType: string;
}

/** Instance-level containment: all tasks in a child container must share the same parent container.
 *  Enforced via task-data inference — the engine observes which parent value is associated with
 *  each child value by looking at task assignments, then validates consistency. */
export interface ContainmentRule extends BaseIntegrityRule {
  type: 'containment';
  /** Child container type (e.g., 'sprint') */
  child: string;
  /** Parent container type (e.g., 'pi') — must be declared as parent in ContainerTypeDefinition */
  parent: string;
}
```

**Integrity rule types explained:**

- **`same-container`**: All tasks that share the same value for `groupBy` container type must also share the same value for `mustMatch` container type. This is Hydro's Epic Integrity: all tasks in epic X must be in the same wave. Shape Up equivalent: all tasks in bet Y must be in the same cycle.

- **`ordering`**: A task's `containerType` value must be numerically >= its dependency tasks' values for the same container type. This is Hydro's Dependency Coherence: if task A depends on task B, A's wave must be >= B's wave.

- **`containment`**: All tasks assigned to the same `child` container instance must share the same `parent` container value. The engine infers instance-level containment from task data — if tasks in Sprint 3 are observed in PI-2026-Q1, then Sprint 3 belongs to PI-2026-Q1, and any task in Sprint 3 assigned to a different PI is a violation. This is SAFe's PI/Sprint relationship. Note: this is structurally similar to `same-container` (groupBy=child, mustMatch=parent), but carries the additional semantic that the `parent` field on `ContainerTypeDefinition` declares the hierarchy. Edge case: a child container with no tasks has no inferred parent — the first task assigned establishes the association, and subsequent tasks are validated against it.

### 2.6 Principle Definition

```typescript
export interface PrincipleDefinition {
  id: string;                          // 'epic-integrity'
  name: string;                        // 'Epic Integrity'
  description: string;                 // 'All tasks within an epic MUST be assigned to the same wave'
  severity: 'error' | 'warning';
  /** The enforcement mechanism — links to an integrity rule or validation step */
  enforcement?: {
    type: 'integrity-rule' | 'validation-step' | 'container-constraint';
    ref: string;                       // integrity rule ID, step name, or container type ID
  };
}
```

### 2.7 Work Items Definition

Work items are the things that flow through the state machine — tasks, user stories, bugs, spikes, features. Different methodologies call them different things, classify them differently, and apply different rules to different types.

```typescript
export interface WorkItemsDefinition {
  /** What the primary work item is called in this methodology */
  primary: {
    singular: string;                  // 'Task', 'User Story', 'Story', 'Scope'
    plural: string;                    // 'Tasks', 'User Stories', 'Stories', 'Scopes'
  };

  /** How the work item type is determined.
   *  The engine reads this field/label to know what type a work item is. */
  typeSource: {
    method: 'label' | 'field';         // 'label' = look at issue labels, 'field' = look at a project field
    /** For 'label': prefix to match (e.g., 'type:' matches labels like 'type:story', 'type:bug')
     *  For 'field': the project field name (e.g., 'Type', 'Work Item Type') */
    identifier: string;                // 'type:' or 'Type'
  };

  /** Type ID to use when no label/field match is found.
   *  Ensures every work item has a resolved type for reporting and analytics.
   *  Must reference a type in the types array. */
  defaultType: string;                 // 'task', 'story'

  /** Work item type definitions.
   *  Each type can have its own DoR, DoD, and validation behavior
   *  through type-scoped pipelines in the pipelines section. */
  types: WorkItemTypeDefinition[];

  /** Work item hierarchy — which types can be parents of which.
   *  Maps to GitHub sub-issues. Optional — flat structures omit this. */
  hierarchy?: WorkItemHierarchyLevel[];
}

export interface WorkItemTypeDefinition {
  /** Type identifier — used in type-scoped pipeline keys */
  id: string;                          // 'story', 'bug', 'spike', 'chore', 'tech-debt'
  /** Display name */
  name: string;                        // 'User Story', 'Bug', 'Spike'
  /** How this type maps to the typeSource.
   *  For label method: the label value (e.g., 'type:story' → id is 'story')
   *  For field method: the field option value */
  sourceValue?: string;                // 'type:story' or 'Story' — defaults to id if omitted

  /** Does this type follow the profile's default lifecycle?
   *  If true (default), uses the top-level states/transitions/pipelines.
   *  If false, must provide a custom lifecycle (future: multi-lifecycle support). */
  standardLifecycle: boolean;          // true for most types

  /** Optional: custom lifecycle for this type (future extension for SAFe-class complexity).
   *  When provided, this type uses entirely different states, transitions, and pipelines. */
  lifecycle?: {
    states: StateDefinition[];
    transitions: TransitionDefinition[];
    semantics: MethodologyProfile['semantics'];
    pipelines: Record<string, { steps: string[] }>;
  };
}

export interface WorkItemHierarchyLevel {
  /** Work item type at this level */
  typeId: string;                      // 'epic', 'story', 'task'
  /** What types can be children (GitHub sub-issues) */
  children?: string[];                 // ['story'] for epic, ['task'] for story
  /** Completion rule: are all children required to be done before parent can complete? */
  childCompletionRequired?: boolean;   // true = SubtaskCompletionValidation applies
}
```

**Type-scoped pipelines — how different types get different rules:**

The `pipelines` section uses a `'{action}:{typeId}'` naming convention. When executing a transition, the engine resolves the pipeline:

1. Look for `'{action}:{workItemType}'` (e.g., `'approve:bug'`)
2. Fall back to `'{action}'` (e.g., `'approve'`)

This means:
- **Different DoR per type**: `'ready'` pipeline checks acceptance criteria for stories; `'ready:bug'` pipeline checks repro steps for bugs; `'ready:spike'` pipeline only checks time-box.
- **Different DoD per type**: `'approve'` pipeline requires PR approval and full tests; `'approve:tech-debt'` pipeline requires architectural review; `'approve:spike'` pipeline only requires findings documented.
- **Skipped steps per type**: `'start:bug'` pipeline can omit `DependencyValidation` since bugs don't have dependency chains.

This is not a rename — it's structural. A bug genuinely has different quality gates than a user story. The profile declares this as data. The engine enforces it generically.

### 2.8 How the Profile Replaces Current Hardcoding

| Current Hardcoding | File | Replaced By |
|---|---|---|
| `WORKFLOW_STATUSES` const | `types.ts:51-59` | `profile.states[]` |
| `WorkflowStatusKey` type | `workflow-config.ts:13-20` | `profile.states[].key` (runtime validated) |
| `STATUS_KEYS` array | `workflow-config.ts:22-25` | `profile.states.map(s => s.key)` |
| `TRANSITION_PAIRS` array | `workflow-config.ts:28-48` | `profile.transitions[]` |
| `TransitionType` union | `types.ts:7-16` | `string` validated against profile |
| `getTargetStatusKey()` switch | `task-workflow-service.ts:141-163` | `profile.transitions.find(t => t.action === action).to` |
| `DEFAULT_METHODOLOGY` | `methodology-config.ts:35-112` | `profile.pipelines` |
| `REQUIRED_STATUSES` | `project-config-loader.ts:54-62` | `profile.states.map(s => s.key)` |
| `WAVE_FORMAT_PATTERN` | `input-sanitizer.ts:31` | Container type's `namePattern` |
| `FULL_LIFECYCLE` | `compliance-service.ts:84` | `profile.compliance.lifecycle` |
| `WEIGHTS` | `compliance-service.ts:86-92` | `profile.compliance.weights` |
| Status switch in SuggestionService | `suggestion-service.ts:97-151` | Profile-driven: `semantics` categories |
| Status filters in WorkDistributionService | `work-distribution-service.ts:79` | `profile.semantics.readyStates` |
| `task.wave` / `task.epic` | `interfaces.ts:182-183` | `task.containers: Record<string, string>` |
| `WaveService` + `EpicService` | domain services | Single `ContainerService` |
| `EpicValidator` | domain validator | `IntegrityValidator` |
| `wave_field_id` / `epic_field_id` | `IProjectConfig.fields` | `profile.containers[].taskField` + runtime field ID resolution |
| Wave MCP tools (5) | `wave-tools.ts` | Generic container tools |
| Epic MCP tools (4) | `epic-tools.ts` | Generic container tools |

### 2.8 What the Profile Does NOT Replace

These components are already methodology-agnostic and remain unchanged:

- **AuditService** — Records events regardless of methodology
- **AnalyticsService** — Cycle time, throughput, lead time are universal metrics
- **AgentService** — Agent registration, locking, heartbeat
- **MergeReadinessService** — PR reviews, security scans, test coverage
- **EventBus** — Methodology-agnostic event transport
- **GraphQL client and repositories** — Infrastructure layer
- **StatusTransitionValidation step** — Already generic (uses `workflowConfig.isValidTransition()`)
- **Quality gate steps** (PRReview, TestCoverage, SecurityScan) — Methodology-agnostic

### 2.9 Profile Inheritance — `MethodologyProfileFile`

Custom profiles are stored as `.ido4/methodology-profile.json`. They can inherit from a built-in profile and override only what differs. To keep the runtime interface clean, profile inheritance is a **loading concern**, not a runtime concern.

```typescript
/**
 * File format for custom methodology profiles.
 * Separate from MethodologyProfile — this includes loading instructions (extends).
 * The registry resolves inheritance and produces a fully merged MethodologyProfile.
 */
export interface MethodologyProfileFile {
  /** Base profile ID to inherit from (e.g., 'scrum', 'hydro', 'shape-up') */
  extends?: string;

  /** All MethodologyProfile fields — only include what you want to override.
   *  Arrays are replaced wholesale (not merged). Objects are deep-merged. */
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

**Resolution example:**

```json
// .ido4/methodology-profile.json — "Scrum but with Code Review state"
{
  "extends": "scrum",
  "id": "acme-scrum",
  "name": "ACME Scrum",
  "states": [
    { "key": "BACKLOG",      "name": "Product Backlog", "category": "todo" },
    { "key": "SPRINT",       "name": "Sprint Backlog",  "category": "todo" },
    { "key": "IN_PROGRESS",  "name": "In Progress",     "category": "active" },
    { "key": "CODE_REVIEW",  "name": "Code Review",     "category": "active" },
    { "key": "IN_REVIEW",    "name": "QA Review",       "category": "active" },
    { "key": "DONE",         "name": "Done",            "category": "done" },
    { "key": "BLOCKED",      "name": "Blocked",         "category": "blocked" }
  ]
}
```

The registry: loads `scrum` built-in profile → deep-merges overrides from the file → validates the result → returns a complete `MethodologyProfile`. The engine never sees `extends`.

### 2.10 Container Field ID Resolution

The profile uses human-readable field names (`taskField: 'Wave'`) but the GitHub Projects API needs field IDs (`PVTSSF_xxx`). Resolution works as follows:

1. **During `init_project`**: The engine creates GitHub project fields matching the profile's container `taskField` names. The resulting field IDs are stored in `project-info.json` under a `containerFields` mapping.

2. **At runtime**: The `ContainerService` resolves `taskField` to a field ID via the project config:

```typescript
// project-info.json (generated by init_project)
{
  "fields": {
    "status_field_id": "PVTSSF_abc",
    "containerFields": {
      "Wave": "PVTSSF_xxx",        // taskField 'Wave' → field ID
      "Epic": "PVTSSF_yyy",        // taskField 'Epic' → field ID
    }
  }
}
```

3. **Backward compatibility**: The existing `wave_field_id` and `epic_field_id` keys are migrated to `containerFields` entries at load time. Existing projects continue to work without re-initialization.

This keeps profiles portable (they reference field names, not GitHub-specific IDs) while the project config handles the per-project mapping.

---

## 3. Engine Primitives

### 3.1 The Container Service

Replaces `WaveService` + `EpicService` with a single service that manages any container type.

```typescript
/**
 * IContainerService — Generic container management.
 *
 * Manages any number of container types defined by the methodology profile.
 * The same service handles waves, epics, sprints, cycles, bets, scopes, PIs —
 * whatever the profile declares.
 */
export interface IContainerService {
  /**
   * List all containers of a given type with their task counts and status.
   * @param containerTypeId - e.g., 'wave', 'epic', 'sprint', 'cycle'
   */
  list(containerTypeId: string): Promise<ContainerSummary[]>;

  /**
   * Get status details for a specific container.
   */
  getStatus(containerTypeId: string, containerValue: string): Promise<ContainerStatusData>;

  /**
   * Create a new container (e.g., create a new wave, start a new cycle).
   * Only for managed container types with naming patterns.
   */
  create(containerTypeId: string, name: string, options?: ContainerCreateOptions): Promise<ContainerCreateResult>;

  /**
   * Assign a task to a container.
   * Runs integrity validation if rules exist for this container type.
   */
  assign(
    taskNumber: number,
    containerTypeId: string,
    containerValue: string,
    options?: { dryRun?: boolean; actor?: McpActor }
  ): Promise<ContainerAssignResult>;

  /**
   * Validate whether a container is complete per its completionRule.
   */
  validateCompletion(containerTypeId: string, containerValue: string): Promise<ContainerCompletionResult>;

  /**
   * Get all tasks assigned to a specific container.
   */
  getTasksIn(containerTypeId: string, containerValue: string): Promise<TaskData[]>;

  /**
   * Search for container values (e.g., search epics by name).
   */
  search(containerTypeId: string, query: string): Promise<ContainerSearchResult[]>;
}
```

**How it works internally:**

The `ContainerService` reads the profile's `containers[]` array at construction time. For each container type, it knows:
- Which task field to read/write (via `taskField`)
- How to validate names (via `namePattern`)
- How to check completion (via `completionRule`)
- Whether singularity applies

When `assign()` is called, it:
1. Validates the container name against the type's `namePattern`
2. Sets the field value on the task via the GitHub Projects API
3. Runs any `integrityRules` where this container type is the `target`
4. Emits an audit event

The service is completely container-agnostic. It doesn't know the difference between a wave and an epic. It just reads the profile and operates on fields.

### 3.2 The Integrity Validator

Replaces `EpicValidator` with a generic validator that enforces any cross-container integrity rule.

```typescript
/**
 * IIntegrityValidator — Generic cross-container integrity enforcement.
 *
 * Enforces integrity rules declared in the methodology profile.
 * Doesn't know what "epic integrity" means — just knows that
 * "all tasks sharing source container value X must share target container value Y."
 */
export interface IIntegrityValidator {
  /**
   * Validate whether assigning a task to a container would violate any integrity rules.
   * Called by ContainerService.assign() and by BRE pipeline steps.
   */
  validateAssignment(
    taskNumber: number,
    containerTypeId: string,
    newValue: string
  ): Promise<IntegrityResult>;

  /**
   * Validate all integrity rules across all tasks.
   * Used for project health checks and compliance scoring.
   */
  validateAll(): Promise<IntegrityResult[]>;
}
```

**How it works:**

For a `same-container` rule (e.g., Hydro's Epic Integrity):
1. Find the task's `groupBy` container value (e.g., its epic)
2. Find all other tasks with the same `groupBy` value (same epic)
3. Check that they all have the same `mustMatch` container value (same wave)
4. If assigning a new `mustMatch` value, simulate the change and check

For an `ordering` rule (e.g., Dependency Coherence):
1. Find the task's dependencies
2. For each dependency, compare `containerType` values
3. The task's value must be >= dependency values (using natural ordering)

For a `containment` rule (e.g., SAFe Sprint-PI):
1. Find all tasks assigned to the same `child` container value (e.g., Sprint 3)
2. Check that they all have the same `parent` container value (e.g., PI-2026-Q1)
3. Instance-level containment is inferred from task data — no separate registry needed

### 3.3 TaskData with Generic Containers and Work Item Type

```typescript
export interface TaskData {
  number: number;
  title: string;
  status: string;                      // state display name from profile
  statusKey: string;                   // state key from profile
  labels: string[];
  assignees: string[];
  dependencies: number[];
  url: string;

  /**
   * Work item type — resolved from the profile's workItems.typeSource.
   * Used by the engine to select type-scoped pipelines.
   *
   * Example for Hydro: 'task' (default, since Hydro has one type)
   * Example for Scrum: 'story', 'bug', 'spike'
   * Example for SAFe: 'epic', 'feature', 'story'
   */
  workItemType: string;

  /**
   * Container assignments — keyed by container type ID.
   * Replaces the hardcoded `wave` and `epic` fields.
   *
   * Example for Hydro: { 'wave': 'wave-001-auth', 'epic': 'E1: Authentication' }
   * Example for Shape Up: { 'cycle': 'cycle-001-v2', 'bet': 'Notifications Redesign', 'scope': 'Email Integration' }
   * Example for SAFe: { 'pi': 'PI-2026-Q1', 'sprint': 'Sprint 3', 'feature': 'User Auth' }
   */
  containers: Record<string, string>;
}
```

### 3.4 Profile-Driven WorkflowConfig

`WorkflowConfig` becomes a thin wrapper around the profile's state machine:

```typescript
export class WorkflowConfig {
  private readonly statesByKey: Map<string, StateDefinition>;
  private readonly transitionMap: Map<string, TransitionDefinition[]>;
  private readonly profile: MethodologyProfile;

  constructor(profile: MethodologyProfile, projectConfig: IProjectConfig) {
    this.profile = profile;
    // Build lookup maps from profile data
    this.statesByKey = new Map(profile.states.map(s => [s.key, s]));
    this.transitionMap = this.buildTransitionMap(profile.transitions);
  }

  /** Is this a valid transition from the task's current state? */
  isValidTransition(fromKey: string, action: string): boolean {
    const transitions = this.transitionMap.get(action);
    return transitions?.some(t => t.from.includes(fromKey)) ?? false;
  }

  /** Get the target state key for a transition action from a given source state */
  getTargetStateKey(fromKey: string, action: string): string | undefined {
    const transitions = this.transitionMap.get(action);
    return transitions?.find(t => t.from.includes(fromKey))?.to;
  }

  /** Get state display name from key */
  getStateName(key: string): string {
    return this.statesByKey.get(key)?.name ?? key;
  }

  /** Get all states in a semantic category */
  getStatesByCategory(category: 'todo' | 'active' | 'done' | 'blocked'): StateDefinition[] {
    return this.profile.states.filter(s => s.category === category);
  }

  /** Is this state a terminal state? */
  isTerminal(key: string): boolean {
    return this.profile.semantics.terminalStates.includes(key);
  }

  /** Is this state a ready state (work can be picked up)? */
  isReady(key: string): boolean {
    return this.profile.semantics.readyStates.includes(key);
  }

  /** Is this state an active state (work in progress)? */
  isActive(key: string): boolean {
    return this.profile.semantics.activeStates.includes(key);
  }

  /** Resolve the pipeline for a transition, considering work item type.
   *  Looks for '{action}:{workItemType}' first, falls back to '{action}'. */
  resolvePipeline(action: string, workItemType?: string): string[] {
    if (workItemType) {
      const typeScoped = this.profile.pipelines[`${action}:${workItemType}`];
      if (typeScoped) return typeScoped.steps;
    }
    return this.profile.pipelines[action]?.steps ?? [];
  }

  /** Get work item type display name */
  getWorkItemTypeName(typeId: string): string {
    return this.profile.workItems.types.find(t => t.id === typeId)?.name ?? typeId;
  }

  /** Get primary work item terminology */
  getWorkItemLabel(plural: boolean = false): string {
    return plural
      ? this.profile.workItems.primary.plural
      : this.profile.workItems.primary.singular;
  }
}
```

### 3.5 Profile-Driven Validation Steps

Three new generic validation steps replace the methodology-specific ones:

**1. `SourceStatusValidation:KEY1,KEY2`** — Already in v2 spec, unchanged. Validates that the task is in one of the expected source states. Replaces `RefineFromBacklogValidation`, `ReadyFromRefinementValidation`, `StartFromReadyForDevValidation`.

**2. `ContainerAssignmentValidation:containerTypeId`** — Validates that the task is assigned to a container of the given type. Replaces `WaveAssignmentValidation`. The container type ID comes from the profile.

```typescript
// Example: 'ContainerAssignmentValidation:wave' — task must have a wave assigned
// Example: 'ContainerAssignmentValidation:cycle' — task must have a cycle assigned
```

**3. `ContainerIntegrityValidation:ruleId`** — Validates a specific integrity rule. Replaces `EpicIntegrityValidation`. The rule ID references an entry in `profile.integrityRules`.

```typescript
// Example: 'ContainerIntegrityValidation:epic-wave-integrity'
// Example: 'ContainerIntegrityValidation:bet-cycle-integrity'
```

**4. `ContainerSingularityValidation:containerTypeId`** — Validates that starting a task doesn't violate the singularity constraint. Replaces hardcoded active-wave checks.

Old step names (`WaveAssignmentValidation`, `EpicIntegrityValidation`) are kept as backward-compatible aliases that resolve to the new generic steps with the appropriate parameters from the active profile.

### 3.6 ServiceContainer Changes

The profile enters the system at Layer 2 (configuration) and flows downward:

```
Layer 1:  Config (projectRoot, GitHub token)
Layer 2:  Profile (loaded from built-in or .ido4/methodology-profile.json)
Layer 3:  Infrastructure (GraphQL client, repos, WorkflowConfig from profile)
Layer 4:  Domain validators (IntegrityValidator, BRE pipeline with profile's pipelines)
Layer 5:  Domain services (TaskService, ContainerService, DependencyService)
Layer 6a: AuditService
Layer 6b: SandboxService
Layer 7a: ProjectService
Layer 7b: AnalyticsService
Layer 7c: AgentService
Layer 8:  ComplianceService (reads profile.compliance for weights and lifecycle)
Layer 9:  WorkDistributionService (reads profile.semantics for ready/active states)
Layer 10: MergeReadinessService
```

```typescript
export interface ServiceContainerConfig {
  projectRoot: string;
  githubToken: string;
  profileId?: string;          // 'hydro' | 'shape-up' | custom profile ID
  profileOverrides?: Partial<MethodologyProfile>;  // for testing / customization
}
```

Profile resolution order:
1. If `.ido4/methodology-profile.json` exists, load it (may reference built-in via `extends`)
2. Else if `profileId` is provided in config, load the matching built-in profile
3. Else if `.ido4/project-info.json` exists but has no methodology field, infer `hydro` (backward compatibility — log a migration warning)
4. Else: **fail with clear error** — no silent defaults. The engine requires a profile.
5. Apply `profileOverrides` if provided (for testing)

The engine is a runner. It refuses to start without a program. `init_project` is the first-class entry point where the user chooses their methodology.

---

## 4. Built-in Profiles

### 4.1 Hydro Profile (Current Behavior — Exact Parity)

```typescript
// packages/core/src/profiles/hydro.ts

export const HYDRO_PROFILE: MethodologyProfile = {
  id: 'hydro',
  name: 'Hydro — Hybrid Development Resource Orchestration',
  version: '1.0',
  description: 'Wave-based governance with epic integrity, dependency-driven flow, and deterministic BRE validation',

  states: [
    { key: 'BACKLOG',        name: 'Backlog',        category: 'todo' },
    { key: 'IN_REFINEMENT',  name: 'In Refinement',  category: 'todo' },
    { key: 'READY_FOR_DEV',  name: 'Ready for Dev',  category: 'todo' },
    { key: 'IN_PROGRESS',    name: 'In Progress',    category: 'active' },
    { key: 'IN_REVIEW',      name: 'In Review',      category: 'active' },
    { key: 'DONE',           name: 'Done',           category: 'done' },
    { key: 'BLOCKED',        name: 'Blocked',        category: 'blocked' },
  ],

  transitions: [
    { action: 'refine',   from: ['BACKLOG'],                                                                  to: 'IN_REFINEMENT', label: 'Refine task' },
    { action: 'ready',    from: ['IN_REFINEMENT', 'BACKLOG'],                                                 to: 'READY_FOR_DEV', label: 'Mark ready for dev' },
    { action: 'start',    from: ['READY_FOR_DEV'],                                                            to: 'IN_PROGRESS',   label: 'Start working' },
    { action: 'review',   from: ['IN_PROGRESS'],                                                              to: 'IN_REVIEW',     label: 'Submit for review' },
    { action: 'approve',  from: ['IN_REVIEW'],                                                                to: 'DONE',          label: 'Approve and complete' },
    { action: 'complete', from: ['DONE'],                                                                     to: 'DONE',          label: 'Administrative complete' },
    { action: 'block',    from: ['BACKLOG','IN_REFINEMENT','READY_FOR_DEV','IN_PROGRESS','IN_REVIEW'],         to: 'BLOCKED',       label: 'Block task' },
    { action: 'unblock',  from: ['BLOCKED'],                                                                  to: 'READY_FOR_DEV', label: 'Unblock task' },
    { action: 'return',   from: ['READY_FOR_DEV'],  to: 'IN_REFINEMENT', label: 'Return to refinement', backward: true },
    { action: 'return',   from: ['IN_PROGRESS'],    to: 'READY_FOR_DEV', label: 'Return to ready',      backward: true },
    { action: 'return',   from: ['IN_REVIEW'],      to: 'IN_PROGRESS',   label: 'Return to progress',   backward: true },
  ],

  semantics: {
    initialState: 'BACKLOG',
    terminalStates: ['DONE'],
    blockedStates: ['BLOCKED'],
    activeStates: ['IN_PROGRESS', 'IN_REVIEW'],
    readyStates: ['READY_FOR_DEV'],
  },

  workItems: {
    primary: { singular: 'Task', plural: 'Tasks' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'task',
    types: [
      { id: 'task',       name: 'Task',            standardLifecycle: true },
      { id: 'ai-ready',   name: 'AI-Ready Task',   standardLifecycle: true },
      { id: 'ai-assisted',name: 'AI-Assisted Task', standardLifecycle: true },
      { id: 'hybrid',     name: 'Hybrid Task',     standardLifecycle: true },
      { id: 'human-only', name: 'Human-Only Task', standardLifecycle: true },
    ],
    hierarchy: [
      { typeId: 'task', children: ['task'], childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'wave',
      singular: 'Wave',
      plural: 'Waves',
      taskField: 'Wave',
      namePattern: '^wave-\\d{3}-[a-z0-9-]+$',
      nameExample: 'wave-001-auth-system',
      singularity: true,
      completionRule: 'all-terminal',
      managed: true,
    },
    {
      id: 'epic',
      singular: 'Epic',
      plural: 'Epics',
      taskField: 'Epic',
      completionRule: 'none',
      managed: true,
    },
  ],

  integrityRules: [
    {
      id: 'epic-wave-integrity',
      type: 'same-container',
      groupBy: 'epic',
      mustMatch: 'wave',
      description: 'All tasks in the same epic must be assigned to the same wave',
      severity: 'error',
      principleId: 'epic-integrity',
    },
    {
      id: 'dependency-wave-ordering',
      type: 'ordering',
      containerType: 'wave',
      description: "A task's wave must be >= its dependency tasks' waves",
      severity: 'warning',
      principleId: 'dependency-coherence',
    },
  ],

  principles: [
    {
      id: 'epic-integrity',
      name: 'Epic Integrity',
      description: 'All tasks within an epic MUST be assigned to the same wave',
      severity: 'error',
      enforcement: { type: 'integrity-rule', ref: 'epic-wave-integrity' },
    },
    {
      id: 'wave-singularity',
      name: 'Active Wave Singularity',
      description: 'Only one wave can be active at a time',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'wave' },
    },
    {
      id: 'dependency-coherence',
      name: 'Dependency Coherence',
      description: "A task's wave must be numerically >= its dependency tasks' waves",
      severity: 'warning',
      enforcement: { type: 'integrity-rule', ref: 'dependency-wave-ordering' },
    },
    {
      id: 'self-contained-execution',
      name: 'Self-Contained Execution',
      description: 'Each wave contains all dependencies needed for its tasks',
      severity: 'warning',
      enforcement: { type: 'validation-step', ref: 'SelfContainedExecutionValidation' },
    },
    {
      id: 'atomic-completion',
      name: 'Atomic Completion',
      description: 'A wave is complete only when ALL its tasks are in terminal state',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'wave' },
    },
  ],

  pipelines: {
    refine: {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'BaseTaskFieldsValidation',
        'StatusTransitionValidation:IN_REFINEMENT',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    ready: {
      steps: [
        'SourceStatusValidation:IN_REFINEMENT,BACKLOG',
        'FastTrackValidation',
        'AcceptanceCriteriaValidation',
        'EffortEstimationValidation',
        'DependencyIdentificationValidation',
        'StatusTransitionValidation:READY_FOR_DEV',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    start: {
      steps: [
        'SourceStatusValidation:READY_FOR_DEV',
        'StatusTransitionValidation:IN_PROGRESS',
        'DependencyValidation',
        'ContainerAssignmentValidation:wave',
        'ContainerSingularityValidation:wave',
        'AISuitabilityValidation',
        'RiskLevelValidation',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:IN_REVIEW',
        'ImplementationReadinessValidation',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    approve: {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'ContainerIntegrityValidation:epic-wave-integrity',
      ],
    },
    complete: {
      steps: [
        'StatusAlreadyDoneValidation',
        'SubtaskCompletionValidation',
      ],
    },
    block: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskAlreadyBlockedValidation',
        'StatusTransitionValidation:BLOCKED',
      ],
    },
    unblock: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskNotBlockedValidation',
        'StatusTransitionValidation:READY_FOR_DEV',
      ],
    },
    return: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'TaskBlockedValidation',
        'BackwardTransitionValidation',
      ],
    },
  },

  compliance: {
    lifecycle: ['refine', 'ready', 'start', 'review', 'approve'],
    weights: {
      brePassRate: 0.40,
      qualityGates: 0.20,
      processAdherence: 0.20,
      containerIntegrity: 0.10,
      flowEfficiency: 0.10,
    },
  },

  behaviors: {
    closingTransitions: ['approve'],
    blockTransition: 'block',
    returnTransition: 'return',
  },
};
```

### 4.2 Shape Up Profile

```typescript
// packages/core/src/profiles/shape-up.ts

export const SHAPE_UP_PROFILE: MethodologyProfile = {
  id: 'shape-up',
  name: 'Shape Up',
  version: '1.0',
  description: 'Basecamp Shape Up — fixed time, variable scope, appetite-driven cycles with circuit breaker',

  states: [
    { key: 'RAW',       name: 'Raw Idea',  category: 'todo' },
    { key: 'SHAPED',    name: 'Shaped',    category: 'todo' },
    { key: 'BET',       name: 'Bet On',    category: 'todo' },
    { key: 'BUILDING',  name: 'Building',  category: 'active' },
    { key: 'QA',        name: 'QA',        category: 'active' },
    { key: 'SHIPPED',   name: 'Shipped',   category: 'done' },
    { key: 'KILLED',    name: 'Killed',    category: 'done' },
    { key: 'BLOCKED',   name: 'Blocked',   category: 'blocked' },
  ],

  transitions: [
    { action: 'shape',   from: ['RAW'],                       to: 'SHAPED',   label: 'Shape the pitch' },
    { action: 'bet',     from: ['SHAPED'],                    to: 'BET',      label: 'Place a bet' },
    { action: 'start',   from: ['BET'],                       to: 'BUILDING', label: 'Start building' },
    { action: 'review',  from: ['BUILDING'],                  to: 'QA',       label: 'Submit for QA' },
    { action: 'ship',    from: ['QA'],                        to: 'SHIPPED',  label: 'Ship it' },
    { action: 'block',   from: ['BUILDING', 'QA'],            to: 'BLOCKED',  label: 'Flag blocker' },
    { action: 'unblock', from: ['BLOCKED'],                   to: 'BUILDING', label: 'Unblock' },
    { action: 'kill',    from: ['BUILDING', 'QA', 'BLOCKED'], to: 'KILLED',   label: 'Circuit breaker — kill scope' },
    { action: 'return',  from: ['QA'],  to: 'BUILDING', label: 'Return to building', backward: true },
    { action: 'return',  from: ['BET'], to: 'SHAPED',   label: 'Return to shaping',  backward: true },
  ],

  semantics: {
    initialState: 'RAW',
    terminalStates: ['SHIPPED', 'KILLED'],
    blockedStates: ['BLOCKED'],
    activeStates: ['BUILDING', 'QA'],
    readyStates: ['BET'],
  },

  workItems: {
    primary: { singular: 'Task', plural: 'Tasks' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'task',
    types: [
      { id: 'task', name: 'Task', standardLifecycle: true },
    ],
    hierarchy: [
      { typeId: 'task', children: ['task'], childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'cycle',
      singular: 'Cycle',
      plural: 'Cycles',
      taskField: 'Cycle',
      namePattern: '^cycle-\\d{3}-[a-z0-9-]+$',
      nameExample: 'cycle-001-notifications',
      singularity: true,
      completionRule: 'all-terminal',
      managed: true,
    },
    {
      id: 'bet',
      singular: 'Bet',
      plural: 'Bets',
      taskField: 'Bet',
      completionRule: 'none',
      managed: true,
    },
    {
      id: 'scope',
      singular: 'Scope',
      plural: 'Scopes',
      taskField: 'Scope',
      parent: 'bet',
      completionRule: 'none',
      managed: false,                         // scopes are emergent, not engine-managed
    },
  ],

  integrityRules: [
    {
      id: 'bet-cycle-integrity',
      type: 'same-container',
      groupBy: 'bet',
      mustMatch: 'cycle',
      description: 'All tasks in the same bet must be in the same cycle',
      severity: 'error',
      principleId: 'bet-integrity',
    },
  ],

  principles: [
    {
      id: 'bet-integrity',
      name: 'Bet Integrity',
      description: 'All scopes within a bet must be in the same cycle',
      severity: 'error',
      enforcement: { type: 'integrity-rule', ref: 'bet-cycle-integrity' },
    },
    {
      id: 'cycle-singularity',
      name: 'Active Cycle Singularity',
      description: 'Only one cycle can be active at a time',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'cycle' },
    },
    {
      id: 'circuit-breaker',
      name: 'Circuit Breaker',
      description: 'If a bet is not shipped by the end of a cycle, it is killed. No extensions.',
      severity: 'error',
      enforcement: { type: 'validation-step', ref: 'CircuitBreakerValidation' },
    },
    {
      id: 'fixed-appetite',
      name: 'Fixed Appetite',
      description: 'Time is fixed, scope is variable. Never extend a cycle for unfinished work.',
      severity: 'warning',
    },
  ],

  pipelines: {
    shape: {
      steps: [
        'SourceStatusValidation:RAW',
        'StatusTransitionValidation:SHAPED',
      ],
    },
    bet: {
      steps: [
        'SourceStatusValidation:SHAPED',
        'StatusTransitionValidation:BET',
        'ContainerAssignmentValidation:cycle',
        'ContainerIntegrityValidation:bet-cycle-integrity',
      ],
    },
    start: {
      steps: [
        'SourceStatusValidation:BET',
        'StatusTransitionValidation:BUILDING',
        'ContainerSingularityValidation:cycle',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:QA',
      ],
    },
    ship: {
      steps: [
        'StatusTransitionValidation:SHIPPED',
        'ApprovalRequirementValidation',
      ],
    },
    block: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:BLOCKED',
      ],
    },
    unblock: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:BUILDING',
      ],
    },
    kill: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:KILLED',
      ],
    },
    return: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'BackwardTransitionValidation',
      ],
    },
  },

  compliance: {
    lifecycle: ['shape', 'bet', 'start', 'review', 'ship'],
    weights: {
      brePassRate: 0.35,
      qualityGates: 0.25,
      processAdherence: 0.20,
      containerIntegrity: 0.10,
      flowEfficiency: 0.10,
    },
  },

  behaviors: {
    closingTransitions: ['ship', 'kill'],
    blockTransition: 'block',
    returnTransition: 'return',
  },
};
```

### 4.3 Scrum Profile (Demonstrates Work Item Types + Type-Scoped Pipelines)

This profile shows how a Scrum team uses work item types to apply different DoR, DoD, and validation rules to stories, bugs, and spikes — all sharing the same state machine.

```typescript
// packages/core/src/profiles/scrum.ts

export const SCRUM_PROFILE: MethodologyProfile = {
  id: 'scrum',
  name: 'Scrum',
  version: '1.0',
  description: 'Standard Scrum with sprint-based execution, user stories, and type-specific quality gates',

  states: [
    { key: 'BACKLOG',      name: 'Product Backlog', category: 'todo' },
    { key: 'SPRINT',       name: 'Sprint Backlog',  category: 'todo' },
    { key: 'IN_PROGRESS',  name: 'In Progress',     category: 'active' },
    { key: 'IN_REVIEW',    name: 'In Review',       category: 'active' },
    { key: 'DONE',         name: 'Done',            category: 'done' },
    { key: 'BLOCKED',      name: 'Blocked',         category: 'blocked' },
  ],

  transitions: [
    { action: 'plan',     from: ['BACKLOG'],                        to: 'SPRINT',      label: 'Add to sprint backlog' },
    { action: 'start',    from: ['SPRINT'],                         to: 'IN_PROGRESS',  label: 'Start working' },
    { action: 'review',   from: ['IN_PROGRESS'],                    to: 'IN_REVIEW',    label: 'Submit for review' },
    { action: 'approve',  from: ['IN_REVIEW'],                      to: 'DONE',         label: 'Accept and complete' },
    { action: 'block',    from: ['SPRINT', 'IN_PROGRESS', 'IN_REVIEW'], to: 'BLOCKED',  label: 'Block' },
    { action: 'unblock',  from: ['BLOCKED'],                        to: 'SPRINT',       label: 'Unblock' },
    { action: 'return',   from: ['IN_REVIEW'],  to: 'IN_PROGRESS',  label: 'Request changes', backward: true },
    { action: 'return',   from: ['IN_PROGRESS'],to: 'SPRINT',       label: 'Return to sprint backlog', backward: true },
  ],

  semantics: {
    initialState: 'BACKLOG',
    terminalStates: ['DONE'],
    blockedStates: ['BLOCKED'],
    activeStates: ['IN_PROGRESS', 'IN_REVIEW'],
    readyStates: ['SPRINT'],
  },

  workItems: {
    primary: { singular: 'User Story', plural: 'User Stories' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'story',
    types: [
      { id: 'story',     name: 'User Story',     standardLifecycle: true },
      { id: 'bug',       name: 'Bug',            standardLifecycle: true },
      { id: 'spike',     name: 'Spike',          standardLifecycle: true },
      { id: 'chore',     name: 'Chore',          standardLifecycle: true },
      { id: 'tech-debt', name: 'Technical Debt',  standardLifecycle: true },
    ],
    hierarchy: [
      { typeId: 'story', children: ['story', 'bug', 'chore'], childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'sprint',
      singular: 'Sprint',
      plural: 'Sprints',
      taskField: 'Sprint',
      namePattern: '^Sprint \\d+$',
      nameExample: 'Sprint 14',
      singularity: true,
      completionRule: 'all-terminal',
      managed: true,
    },
  ],

  integrityRules: [],                  // no epic-sprint integrity in standard Scrum

  principles: [
    {
      id: 'sprint-singularity',
      name: 'Sprint Singularity',
      description: 'Only one sprint can be active at a time',
      severity: 'error',
      enforcement: { type: 'container-constraint', ref: 'sprint' },
    },
  ],

  // --- Default pipelines (apply to all types unless overridden) ---
  pipelines: {
    plan: {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'StatusTransitionValidation:SPRINT',
      ],
    },
    start: {
      steps: [
        'SourceStatusValidation:SPRINT',
        'StatusTransitionValidation:IN_PROGRESS',
        'DependencyValidation',
        'ContainerAssignmentValidation:sprint',
        'ContainerSingularityValidation:sprint',
      ],
    },
    review: {
      steps: [
        'StatusTransitionValidation:IN_REVIEW',
        'ImplementationReadinessValidation',
      ],
    },
    approve: {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'SubtaskCompletionValidation',
      ],
    },

    // --- Type-scoped pipeline overrides ---

    // DoR for stories: must have acceptance criteria + effort estimation
    'plan:story': {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'AcceptanceCriteriaValidation',
        'EffortEstimationValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },

    // DoR for bugs: must have repro steps (checked via BaseTaskFieldsValidation)
    'plan:bug': {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'BaseTaskFieldsValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },

    // DoR for spikes: only needs a time-box
    'plan:spike': {
      steps: [
        'SourceStatusValidation:BACKLOG',
        'StatusTransitionValidation:SPRINT',
      ],
    },

    // Bugs skip dependency validation on start
    'start:bug': {
      steps: [
        'SourceStatusValidation:SPRINT',
        'StatusTransitionValidation:IN_PROGRESS',
        'ContainerAssignmentValidation:sprint',
        'ContainerSingularityValidation:sprint',
      ],
    },

    // Spikes have relaxed DoD: no PR approval required
    'approve:spike': {
      steps: [
        'StatusTransitionValidation:DONE',
        // no ApprovalRequirementValidation — spikes are research
        // no SubtaskCompletionValidation — spikes don't decompose
      ],
    },

    // Tech debt has different DoD: needs architectural review
    'approve:tech-debt': {
      steps: [
        'StatusTransitionValidation:DONE',
        'ApprovalRequirementValidation',
        'PRReviewValidation:2',          // requires 2 reviewers for tech debt
      ],
    },

    block: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:BLOCKED',
      ],
    },
    unblock: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'StatusTransitionValidation:SPRINT',
      ],
    },
    return: {
      steps: [
        'TaskAlreadyCompletedValidation',
        'BackwardTransitionValidation',
      ],
    },
  },

  compliance: {
    lifecycle: ['plan', 'start', 'review', 'approve'],
    weights: {
      brePassRate: 0.40,
      qualityGates: 0.25,
      processAdherence: 0.25,
      flowEfficiency: 0.10,
    },
  },

  behaviors: {
    closingTransitions: ['approve'],
    blockTransition: 'block',
    returnTransition: 'return',
  },
};
```

**What this demonstrates:**

- **`plan:story`** requires acceptance criteria and effort estimation (DoR for stories)
- **`plan:bug`** requires repro steps but not acceptance criteria (DoR for bugs)
- **`plan:spike`** has minimal validation (spikes are research — just get them into the sprint)
- **`start:bug`** skips dependency validation (bugs are standalone fixes)
- **`approve:spike`** has no PR approval requirement (spikes produce findings, not code)
- **`approve:tech-debt`** requires 2 reviewers (higher scrutiny for refactoring)
- Default pipelines (`plan`, `start`, `approve`) apply to any type without an override

A client who runs "Scrum but with an extra Code Review state" would use profile inheritance via `MethodologyProfileFile` (section 2.9): `"extends": "scrum"` and override only what differs — no need to copy the entire profile.

### 4.4 What's Different Between the Profiles (Not Just Terminology)

| Dimension | Hydro | Shape Up | Scrum |
|---|---|---|---|
| **State count** | 7 | 8 (adds Killed) | 6 (simpler) |
| **Terminal states** | 1 (Done) | 2 (Shipped, Killed) | 1 (Done) |
| **Container types** | 2 (wave, epic) | 3 (cycle, bet, scope) | 1 (sprint) |
| **Container nesting** | None | scope is child of bet | None |
| **Completion model** | all-terminal (1 terminal state) | all-terminal (2 terminal states incl. Killed) | all-terminal (1 terminal state) |
| **Work item types** | 5 (1 base + 4 AI classifications) | 1 (task) | 5 (story, bug, spike, chore, tech-debt) |
| **Type-scoped pipelines** | No (all types same rules) | No | Yes (6 overrides) |
| **Unique transitions** | refine, ready, complete | shape, bet, ship, kill | plan |
| **Integrity rules** | 2 (epic-wave, dependency) | 1 (bet-cycle) | 0 |
| **Unique principles** | Dependency Coherence, Self-Contained | Circuit Breaker, Fixed Appetite | Sprint Singularity only |
| **Primary work item** | Task | Task | User Story |
| **Hierarchy** | Tasks with sub-tasks | Tasks with sub-tasks | Stories with sub-stories/bugs |

Three genuinely different methodologies. Different state machines, different containers, different work item types, different validation rules per type. All expressed as data. Zero engine changes between them.

---

## 5. MCP Tool Adaptation

### 5.1 Container Tools (Replace Wave + Epic Tools)

The current 9 MCP tools (5 wave + 4 epic) become a single set of generic container tools that adapt their descriptions and behavior based on the active profile.

```typescript
// Current: list_waves, get_wave_status, create_wave, assign_task_to_wave, validate_wave_completion
// Current: search_epics, get_epic_tasks, get_epic_timeline, validate_epic_integrity
//
// New: Dynamic per container type

function registerContainerTools(server: McpServer, profile: MethodologyProfile) {
  for (const container of profile.containers.filter(c => c.managed)) {
    // list_{plural}
    server.tool(
      `list_${container.id}s`,
      `List all ${container.plural.toLowerCase()} with task counts and status`,
      { /* no params */ },
      async () => containerService.list(container.id)
    );

    // get_{id}_status
    server.tool(
      `get_${container.id}_status`,
      `Get status details for a specific ${container.singular.toLowerCase()}`,
      { name: z.string().describe(`${container.singular} name`) },
      async ({ name }) => containerService.getStatus(container.id, name)
    );

    // assign_task_to_{id}
    server.tool(
      `assign_task_to_${container.id}`,
      `Assign a task to a ${container.singular.toLowerCase()}`,
      {
        task_number: z.number(),
        [container.id]: z.string().describe(`${container.singular} name`),
      },
      async (params) => containerService.assign(params.task_number, container.id, params[container.id])
    );

    // Only register create/validate for containers with naming patterns and completion rules
    if (container.namePattern) {
      server.tool(
        `create_${container.id}`,
        `Create a new ${container.singular.toLowerCase()}`,
        { name: z.string().describe(`Name (e.g., ${container.nameExample})`) },
        async ({ name }) => containerService.create(container.id, name)
      );
    }

    if (container.completionRule && container.completionRule !== 'none') {
      server.tool(
        `validate_${container.id}_completion`,
        `Validate whether a ${container.singular.toLowerCase()} is complete`,
        { name: z.string().describe(`${container.singular} name`) },
        async ({ name }) => containerService.validateCompletion(container.id, name)
      );
    }
  }
}
```

**Result for Hydro**: `list_waves`, `get_wave_status`, `create_wave`, `assign_task_to_wave`, `validate_wave_completion`, `list_epics`, `get_epic_status`, `assign_task_to_epic`

**Result for Shape Up**: `list_cycles`, `get_cycle_status`, `create_cycle`, `assign_task_to_cycle`, `validate_cycle_completion`, `list_bets`, `get_bet_status`, `assign_task_to_bet`

The tool names are generated from the profile. No hardcoding. A SAFe profile would automatically get `list_pis`, `list_sprints`, `list_features`, etc.

### 5.2 Transition Tools (Use Work Item Terminology)

Tool names and descriptions adapt to the profile's work item terminology:

```typescript
function registerTransitionTools(server: McpServer, profile: MethodologyProfile) {
  const itemLabel = profile.workItems.primary.singular.toLowerCase();
  const actions = [...new Set(profile.transitions.map(t => t.action))];

  for (const action of actions) {
    const transitions = profile.transitions.filter(t => t.action === action);
    const label = transitions[0].label;
    const fromStates = [...new Set(transitions.flatMap(t => t.from))];

    server.tool(
      `${action}_task`,
      `${label}. Valid from: ${fromStates.map(k => profile.states.find(s => s.key === k)?.name).join(', ')}`,
      {
        task_number: z.number().describe(`GitHub issue number of the ${itemLabel}`),
        reason: z.string().optional().describe('Reason for this transition'),
      },
      async ({ task_number, reason }) => {
        // The engine resolves the work item's type and selects the
        // type-scoped pipeline: 'start:bug' falls back to 'start'
        return taskService.executeTransition(task_number, action, { reason });
      }
    );
  }
}
```

**Result for Hydro**: `refine_task`, `ready_task`, `start_task`, `review_task`, `approve_task`, `complete_task`, `block_task`, `unblock_task`, `return_task` — descriptions say "task"

**Result for Shape Up**: `shape_task`, `bet_task`, `start_task`, `review_task`, `ship_task`, `block_task`, `unblock_task`, `kill_task`, `return_task` — descriptions say "task"

**Result for Scrum**: `plan_task`, `start_task`, `review_task`, `approve_task`, `block_task`, `unblock_task`, `return_task` — descriptions say "user story"

Note: tool names keep `_task` as the suffix for API stability. The description uses the profile's primary work item label. A Scrum user sees `plan_task` described as "Add to sprint backlog. Valid from: Product Backlog" with parameter described as "GitHub issue number of the user story."

### 5.3 Pipeline Resolution Flow (Type-Scoped)

When `executeTransition()` is called, the engine resolves the pipeline:

```
executeTransition(taskNumber=42, action='approve')
  │
  ├─ 1. Fetch task data → task.workItemType = 'bug'
  │
  ├─ 2. Resolve pipeline:
  │     workflowConfig.resolvePipeline('approve', 'bug')
  │       → Look for 'approve:bug' in profile.pipelines  → FOUND
  │       → Return its steps (type-specific DoD for bugs)
  │     If NOT found:
  │       → Fall back to 'approve'
  │       → Return default steps (standard DoD)
  │
  ├─ 3. Run the resolved pipeline steps
  │
  └─ 4. Execute transition if all steps pass
```

### 5.4 Resources and Prompts

MCP resources expose the full profile, including work item types:

```typescript
// methodology://profile — complete profile data
// methodology://work-item-types — list of types with their pipeline overrides

server.resource('methodology://profile', async () => ({
  name: profile.name,
  states: profile.states,
  transitions: profile.transitions,
  containers: profile.containers,
  workItems: profile.workItems,
  principles: profile.principles,
}));
```

Prompts use profile terminology for their instructions:

```typescript
// Before: "Analyze the current wave status..."
// After: "Analyze the current {profile.containers[0].singular} status..."
//
// Before: "List all tasks in the wave..."
// After: "List all {profile.workItems.primary.plural.toLowerCase()} in the {container.singular}..."
```

---

## 6. Implementation Plan

### Phase 0: Mechanical Rename (~50 files, zero logic change)

Replace methodology-specific names with container-neutral names in the engine code. This is pure find-replace work.

| Find | Replace |
|---|---|
| `WaveService` | `ContainerService` |
| `EpicService` | (merge into `ContainerService`) |
| `EpicValidator` | `IntegrityValidator` |
| `IWaveService` | `IContainerService` |
| `IEpicService` | (merge into `IContainerService`) |
| `IEpicValidator` | `IIntegrityValidator` |
| `WaveSummary` | `ContainerSummary` |
| `WaveStatusData` | `ContainerStatusData` |
| `WaveAssignResult` | `ContainerAssignResult` |
| `EpicIntegrityResult` | `IntegrityResult` |
| `wave_field_id` | resolved from `profile.containers[].taskField` |
| `epic_field_id` | resolved from `profile.containers[].taskField` |
| `wave-service.ts` | `container-service.ts` |
| `epic-service.ts` | merged into `container-service.ts` |
| `epic-validator.ts` | `integrity-validator.ts` |
| `wave-tools.ts` | `container-tools.ts` |
| `epic-tools.ts` | merged into `container-tools.ts` |

Test expectation: All 1,074 tests pass with the new names. Zero behavioral change.

### Phase 1: Profile Foundation (5 new + 5 modified files, zero behavioral change)

**New files:**
1. `packages/core/src/profiles/types.ts` — `MethodologyProfile`, `ContainerTypeDefinition`, `IntegrityRuleDefinition`, `WorkItemsDefinition`, `WorkItemTypeDefinition`, `WorkItemHierarchyLevel`, `StateDefinition`, `TransitionDefinition`, `PrincipleDefinition`
2. `packages/core/src/profiles/hydro.ts` — `HYDRO_PROFILE` (exact parity with current behavior)
3. `packages/core/src/profiles/shape-up.ts` — `SHAPE_UP_PROFILE`
4. `packages/core/src/profiles/scrum.ts` — `SCRUM_PROFILE` (with type-scoped pipelines)
5. `packages/core/src/profiles/registry.ts` — Built-in profile registry, resolution logic, profile inheritance

**Modified files:**
1. `service-container.ts` — Accept `profileId` in config, load profile at Layer 2, pass to services
2. `workflow-config.ts` — Constructor takes `MethodologyProfile` instead of building from constants
3. `methodology-config.ts` — Read pipelines from `profile.pipelines` instead of `DEFAULT_METHODOLOGY`
4. `project-config-loader.ts` — Use `profile.states` instead of `REQUIRED_STATUSES`
5. `input-sanitizer.ts` — Use container type's `namePattern` instead of `WAVE_FORMAT_PATTERN`

### Phase 2: Container Abstraction (the structural change)

**Merge WaveService + EpicService into ContainerService:**
- `ContainerService` takes the profile and operates on any container type by ID
- `list(containerTypeId)` reads the appropriate task field, groups by value
- `assign(taskNumber, containerTypeId, value)` sets the field, runs integrity rules
- `validateCompletion(containerTypeId, value)` checks per the container's `completionRule`
- `getTasksIn(containerTypeId, value)` filters tasks by container field value
- `search(containerTypeId, query)` searches container values

**Merge EpicValidator into IntegrityValidator:**
- `IntegrityValidator` reads `profile.integrityRules` and enforces them generically
- `validateAssignment()` checks all rules involving the target container type
- `validateAll()` checks all rules across all tasks

**Restructure TaskData (moved from Phase 0 — this is a structural data change, not a mechanical rename):**
- Replace `wave: string` and `epic: string` with `containers: Record<string, string>`
- Replace `task.wave` → `task.containers['wave']`, `task.epic` → `task.containers['epic']`
- Add `workItemType: string` — resolved from labels/fields per `profile.workItems.typeSource`
- Update all task-fetching code to populate `containers` and `workItemType` from profile definitions
- Add `WorkItemResolver` — reads task labels/fields and resolves the work item type ID (using `defaultType` when no match)

**Update BRE steps:**
- `WaveAssignmentValidation` → `ContainerAssignmentValidation` (parameterized by container type)
- `EpicIntegrityValidation` → `ContainerIntegrityValidation` (parameterized by rule ID)
- Old names become backward-compatible aliases

### Phase 3: Profile-Driven State Machine + Type-Scoped Pipelines

**Eliminate hardcoded types:**
- `TransitionType` union → `string` (validated against `profile.transitions[].action` at runtime)
- `WORKFLOW_STATUSES` const → `profile.states`
- `WorkflowStatusKey` type → `string` (validated against `profile.states[].key` at runtime)
- `ALL_TRANSITIONS` const → `profile.transitions.map(t => t.action)` (deduplicated)

**Eliminate hardcoded switches:**
- `getTargetStatusKey()` switch → `workflowConfig.getTargetStateKey(fromKey, action)` (profile lookup)
- `transition === 'approve'` check → `profile.behaviors.closingTransitions.includes(action)`
- Status switches in SuggestionService → `workflowConfig.isReady(key)`, `workflowConfig.isActive(key)`, etc.

**Type-scoped pipeline resolution:**
- `TaskTransitionValidator.createPipeline()` uses `workflowConfig.resolvePipeline(action, workItemType)`
- Resolves `'{action}:{type}'` first, falls back to `'{action}'` — enables different DoR/DoD per type
- Work item type resolved by `WorkItemResolver` from task labels/fields

**Update dependent services:**
- `WorkDistributionService` — Use `profile.semantics.readyStates` instead of hardcoded `'Ready for Dev'`
- `ComplianceService` — Use `profile.compliance.lifecycle` and `profile.compliance.weights`
- `SuggestionService` — Use `workflowConfig` semantic methods instead of status name switches

### Phase 4: MCP Adaptation

- Container tools generated dynamically from `profile.containers`
- Transition tools generated dynamically from `profile.transitions`
- Tool descriptions use profile's work item terminology ("user story" vs "task")
- Resources expose full profile data including work item types
- Prompts reference profile concepts and terminology
- `methodology://work-item-types` resource lists types with their pipeline overrides
- `AnalyticsService` profile-awareness: replace hardcoded `transition === 'approve'` and `transition === 'block'` with `profile.behaviors.closingTransitions` and `profile.behaviors.blockTransition` (same pattern applied to ComplianceService/WorkDistributionService in Phase 3)
- Note: `init_project` (methodology selection + profile creation) moves here from Phase 5 when live users need onboarding — the system requires `.ido4/methodology-profile.json` to start (no fallback)

### Phase 5: Shape Up + Scrum Integration Testing

**Shape Up:**
- Create a test project with the Shape Up profile
- Verify all container operations work (cycles, bets, scopes)
- Verify all transitions work (shape, bet, start, review, ship, kill)
- Verify integrity rules work (bet-cycle integrity)
- Verify compliance scoring with Shape Up lifecycle
- Verify MCP tools generate correctly

**Scrum:**
- Create a test project with the Scrum profile
- Verify work item type resolution (story, bug, spike, tech-debt)
- Verify type-scoped pipelines: `plan:story` requires acceptance criteria, `plan:bug` doesn't
- Verify type-scoped DoD: `approve:spike` skips PR approval, `approve:tech-debt` requires 2 reviewers
- Verify container operations (sprints only — no epics in standard Scrum)

**General:**
- `init_project` methodology selection: user chooses Hydro, Shape Up, Scrum, or Custom. The engine then:
  1. Creates a GitHub Project with a Status field (Single Select) populated from `profile.states[].name`
  2. For each container type in `profile.containers[]`, creates a field matching `taskField` with `fieldType` (default: text)
  3. Stores the methodology ID and field name→ID mappings in `.ido4/project-info.json`
- Profile inheritance: verify `"extends": "scrum"` works for client customizations

---

## 7. The Ontology Question: Why This Is Not Just Renaming

The previous architecture (v2) was a sophisticated rename. `WaveService` became `ExecutionUnitService`. `task.wave` became `task.executionUnit`. The engine still assumed two slots.

This architecture (v3) is structurally different:

**1. Variable container count.** The engine supports N container types. SAFe needs 3 (PI, Sprint, Feature). Scrum needs 1 (Sprint). A novel methodology could have 5. The engine doesn't care.

**2. Container relationships as data.** Integrity rules, nesting, ordering — all declared in the profile. The engine provides generic enforcement. The rule "all tasks in the same epic must be in the same wave" is just a `same-container` rule between container type `epic` and container type `wave`. A future methodology could have "all tasks in the same feature must be in the same PI" — same rule type, different container references.

**3. No engine slots.** There is no `task.executionUnit` or `task.grouping`. There is `task.containers`, a map from container type ID to value. The engine never asks "what is this task's execution unit?" — it asks "what is this task's value for container type X?"

**4. Methodology-specific concepts stay in profiles.** Circuit breaker is a Shape Up concept. The engine doesn't know about circuit breakers. The Shape Up profile defines a `kill` transition (state machine data) and a `CircuitBreakerValidation` step (registered by the profile's step bundle). Hydro's refinement pipeline is Hydro-specific. The engine doesn't know about refinement. The Hydro profile defines `refine` as a transition and includes refinement-specific validation steps in its pipeline.

**5. Custom validation steps per profile.** Some validation steps are truly methodology-specific (e.g., `CircuitBreakerValidation` for Shape Up, `SelfContainedExecutionValidation` for Hydro). These are registered by the profile's step bundle, not by the engine core. The engine provides the registry and the pipeline runner. Profiles provide the steps.

**6. Work item types with type-scoped rules.** The engine doesn't know what a "user story" or a "bug" is. It knows work items have types, and types can have different validation pipelines. A Scrum profile declares that bugs skip dependency validation and spikes skip approval requirements. The engine resolves `'{action}:{type}'` → `'{action}'` and runs the right pipeline. Different DoR, different DoD, different quality gates — all data, zero engine code.

**7. Work item hierarchy as data.** The profile declares which types can be parents of which, and whether child completion is required. The engine uses GitHub's sub-issues for the parent/child relationship and `SubtaskCompletionValidation` for the completion check. No hardcoded hierarchy in the engine.

**8. Future-safe for multi-lifecycle.** The `WorkItemTypeDefinition` has an optional `lifecycle` field for types that need entirely different state machines (SAFe Epics vs Stories). This is a clean extension point — not needed now, but the architecture doesn't prevent it. When SAFe is needed, add `lifecycle` to the relevant type definitions. The engine resolves which lifecycle applies based on the work item's type.

```
packages/core/src/
  engine/                     # Methodology-agnostic code
    container-service.ts      # Generic container management
    integrity-validator.ts    # Generic integrity enforcement
    task-workflow-service.ts  # Generic transition execution + type-scoped pipeline resolution
    validation-pipeline.ts   # Generic BRE pipeline runner
    compliance-service.ts    # Generic compliance scoring
    work-item-resolver.ts    # Resolves work item type from labels/fields
    ...

  profiles/                   # Methodology definitions (data + custom steps)
    types.ts                  # MethodologyProfile, WorkItemsDefinition, etc.
    registry.ts               # Profile resolution + inheritance
    hydro/
      profile.ts              # HYDRO_PROFILE data
      steps/                  # Hydro-specific validation steps
        self-contained-execution.ts
    shape-up/
      profile.ts              # SHAPE_UP_PROFILE data
      steps/                  # Shape Up-specific validation steps
        circuit-breaker.ts
    scrum/
      profile.ts              # SCRUM_PROFILE data (with type-scoped pipelines)
```

This is the difference between a rename and an architecture. The engine is a runner. Profiles are the programs it runs.

---

## 8. Migration Safety

### 8.1 Backward Compatibility

- **`.ido4/project-info.json`** — The `fields.wave_field_id` and `fields.epic_field_id` config keys continue to work. The profile resolution layer maps them to the appropriate container type's field ID.

- **`.ido4/methodology.json`** — Custom pipeline configurations continue to work. They're merged into the active profile's pipelines.

- **Old validation step names** — `WaveAssignmentValidation` and `EpicIntegrityValidation` are registered as aliases for `ContainerAssignmentValidation:wave` and `ContainerIntegrityValidation:epic-wave-integrity` respectively.

- **Audit trail** — No backward compatibility concern. There are no production audit trails (sandbox audit data is ephemeral). New events use container-generic metadata from day one: `metadata.containers: { wave: '...', epic: '...' }` instead of `metadata.wave` / `metadata.epic`.

### 8.2 Test Strategy

Each phase maintains full test suite passage:

- **Phase 0**: Pure rename. All 1,074 tests updated mechanically. Zero logic change.
- **Phase 1**: Profile loaded but not consumed. All services still use their current data sources. Tests pass unchanged.
- **Phase 2**: ContainerService replaces WaveService + EpicService. Tests updated to use new interface. Same assertions, same behavior.
- **Phase 3**: Profile drives the state machine. Tests updated to reference profile. Same transitions, same validations.
- **Phase 4**: MCP tool names generated from profile. Integration tests updated.
- **Phase 5**: New tests for Shape Up profile. Hydro tests unchanged.

### 8.3 Risk Assessment

| Risk | Mitigation |
|---|---|
| TaskData.containers breaks serialization | Migration function: `{ wave, epic } → { containers: { wave, epic } }` |
| Dynamic MCP tool names break clients | During transition, register both old names and new names |
| Profile resolution fails | Hard error with clear message. Existing projects without a profile infer Hydro with migration warning. New projects must choose explicitly via `init_project`. |
| Custom methodology.json incompatible | Compatibility loader wraps old format into profile partial |
| Test update volume | Phase 0 is mechanical find-replace; later phases change one thing at a time |

---

## Appendix A: SAFe Profile Sketch

To demonstrate the architecture handles the most complex mainstream methodology — including multi-lifecycle work item types, nested containers, and cross-container integrity:

```typescript
// Sketch — not a complete profile, showing container + work item + multi-lifecycle flexibility

export const SAFE_PROFILE: Partial<MethodologyProfile> = {
  id: 'safe',
  name: 'SAFe — Scaled Agile Framework',

  // Default state machine (for Stories — the primary work item)
  states: [
    { key: 'NEW',          name: 'New',          category: 'todo' },
    { key: 'IN_PROGRESS',  name: 'In Progress',  category: 'active' },
    { key: 'IN_REVIEW',    name: 'In Review',    category: 'active' },
    { key: 'DONE',         name: 'Done',         category: 'done' },
    { key: 'BLOCKED',      name: 'Blocked',      category: 'blocked' },
  ],

  workItems: {
    primary: { singular: 'Story', plural: 'Stories' },
    typeSource: { method: 'label', identifier: 'type:' },
    defaultType: 'story',
    types: [
      { id: 'story',   name: 'Story',   standardLifecycle: true },
      { id: 'enabler', name: 'Enabler', standardLifecycle: true },
      {
        id: 'feature',
        name: 'Feature',
        standardLifecycle: false,        // Features have their own lifecycle
        lifecycle: {
          states: [
            { key: 'DEFINED',       name: 'Defined',       category: 'todo' },
            { key: 'IN_PROGRESS',   name: 'In Progress',   category: 'active' },
            { key: 'DONE',          name: 'Done',          category: 'done' },
          ],
          transitions: [
            { action: 'start',   from: ['DEFINED'],      to: 'IN_PROGRESS', label: 'Start feature' },
            { action: 'complete',from: ['IN_PROGRESS'],   to: 'DONE',        label: 'Complete feature' },
          ],
          semantics: {
            initialState: 'DEFINED',
            terminalStates: ['DONE'],
            blockedStates: [],
            activeStates: ['IN_PROGRESS'],
            readyStates: ['DEFINED'],
          },
          pipelines: {
            start: { steps: ['StatusTransitionValidation:IN_PROGRESS'] },
            complete: { steps: ['StatusTransitionValidation:DONE', 'SubtaskCompletionValidation'] },
          },
        },
      },
      {
        id: 'epic',
        name: 'Epic',
        standardLifecycle: false,        // Epics have their own lifecycle
        lifecycle: {
          states: [
            { key: 'FUNNEL',         name: 'Funnel',         category: 'todo' },
            { key: 'REVIEW',         name: 'Review',         category: 'todo' },
            { key: 'ANALYSIS',       name: 'Analysis',       category: 'active' },
            { key: 'IMPLEMENTING',   name: 'Implementing',   category: 'active' },
            { key: 'DONE',           name: 'Done',           category: 'done' },
          ],
          transitions: [
            { action: 'review',    from: ['FUNNEL'],        to: 'REVIEW',        label: 'Submit for review' },
            { action: 'analyze',   from: ['REVIEW'],        to: 'ANALYSIS',      label: 'Begin analysis' },
            { action: 'implement', from: ['ANALYSIS'],      to: 'IMPLEMENTING',  label: 'Begin implementation' },
            { action: 'complete',  from: ['IMPLEMENTING'],  to: 'DONE',          label: 'Complete epic' },
          ],
          semantics: {
            initialState: 'FUNNEL',
            terminalStates: ['DONE'],
            blockedStates: [],
            activeStates: ['ANALYSIS', 'IMPLEMENTING'],
            readyStates: ['REVIEW'],
          },
          pipelines: {
            review: { steps: ['StatusTransitionValidation:REVIEW'] },
            analyze: { steps: ['StatusTransitionValidation:ANALYSIS'] },
            implement: { steps: ['StatusTransitionValidation:IMPLEMENTING'] },
            complete: { steps: ['StatusTransitionValidation:DONE', 'SubtaskCompletionValidation'] },
          },
        },
      },
    ],
    hierarchy: [
      { typeId: 'epic',    children: ['feature'],          childCompletionRequired: true },
      { typeId: 'feature', children: ['story', 'enabler'], childCompletionRequired: true },
      { typeId: 'story',   children: ['story'],            childCompletionRequired: true },
    ],
  },

  containers: [
    {
      id: 'pi',
      singular: 'Program Increment',
      plural: 'Program Increments',
      taskField: 'PI',
      namePattern: '^PI-\\d{4}-Q[1-4]$',
      nameExample: 'PI-2026-Q1',
      singularity: false,               // multiple PIs can coexist
      completionRule: 'all-terminal',
      managed: true,
    },
    {
      id: 'sprint',
      singular: 'Sprint',
      plural: 'Sprints',
      taskField: 'Sprint',
      namePattern: '^Sprint \\d+$',
      nameExample: 'Sprint 3',
      singularity: true,                // one active sprint at a time
      completionRule: 'timebox-expires',
      parent: 'pi',                     // sprints nest inside PIs
      managed: true,
    },
    {
      id: 'feature',
      singular: 'Feature',
      plural: 'Features',
      taskField: 'Feature',
      completionRule: 'none',
      managed: true,
    },
  ],

  integrityRules: [
    {
      id: 'feature-pi-integrity',
      type: 'same-container',
      groupBy: 'feature',
      mustMatch: 'pi',
      description: 'All stories in a feature must be planned within the same PI',
      severity: 'warning',
      principleId: 'feature-integrity',
    },
    {
      id: 'sprint-pi-containment',
      type: 'containment',
      child: 'sprint',
      parent: 'pi',
      description: 'A sprint must belong to its parent PI',
      severity: 'error',
      principleId: 'pi-sprint-hierarchy',
    },
  ],
};
```

Three container types. Nested execution units. Four work item types with two custom lifecycles. Cross-container integrity rules. Work item hierarchy (Epic → Feature → Story). All expressed as data. The engine's multi-lifecycle extension resolves which state machine to use based on the work item's type — same generic pipeline resolution, just looking at a different lifecycle definition.

---

## Appendix B: Compliance Weight Flexibility

The previous architecture hardcoded compliance weight keys (`brePassRate`, `qualityGates`, etc.). This architecture uses `Record<string, number>` — the keys are profile-defined.

**Hydro weights:**
```typescript
weights: {
  brePassRate: 0.40,
  qualityGates: 0.20,
  processAdherence: 0.20,
  containerIntegrity: 0.10,
  flowEfficiency: 0.10,
}
```

**Shape Up weights (hypothetical adjustment):**
```typescript
weights: {
  brePassRate: 0.35,
  qualityGates: 0.25,
  processAdherence: 0.20,
  containerIntegrity: 0.10,
  flowEfficiency: 0.10,
}
```

**SAFe weights (hypothetical):**
```typescript
weights: {
  brePassRate: 0.30,
  qualityGates: 0.20,
  processAdherence: 0.15,
  containerIntegrity: 0.15,
  piObjectiveAlignment: 0.10,
  flowEfficiency: 0.10,
}
```

**How scoring works:**

The `ComplianceService` iterates over the weight keys and computes scores using registered scoring functions. The engine provides **built-in scorers** for these well-known keys:

| Scorer Key | What It Measures |
|---|---|
| `brePassRate` | Percentage of BRE validations that passed without errors |
| `qualityGates` | PR review, test coverage, security scan pass rates |
| `processAdherence` | How closely tasks follow the profile's `compliance.lifecycle` sequence |
| `containerIntegrity` | Percentage of integrity rules satisfied across all tasks |
| `flowEfficiency` | Ratio of active time to total lead time (low blocking, low wait) |

**Unknown keys** (e.g., SAFe's `piObjectiveAlignment`): If a weight key doesn't match a built-in scorer, the engine logs a warning and scores it as 0. This makes the total compliance score lower than expected — a deliberate signal that the profile needs a custom scorer.

**Custom scorers** can be registered via a `ComplianceScorerRegistry`, following the same pattern as the `ValidationStepRegistry`:

```typescript
// In a SAFe step bundle:
registry.registerScorer('piObjectiveAlignment', {
  score: async (auditTrail, profile) => {
    // Custom scoring logic — return 0-100
  },
});
```

This is a future extension mechanism. For initial release, only the 5 built-in scorers are available. Profiles should use well-known keys unless they also provide a custom scorer bundle.
