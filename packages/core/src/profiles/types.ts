/**
 * Methodology Profile type definitions.
 *
 * A MethodologyProfile is the single source of truth for a development methodology.
 * It defines everything the governance engine needs: state machine, container types,
 * validation pipelines, principles, compliance scoring, and user-facing terminology.
 *
 * Built-in profiles (hydro.ts, shape-up.ts, scrum.ts) are TypeScript constants.
 * Custom profiles are JSON files at .ido4/methodology-profile.json.
 */

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
    /** States where work is waiting for review/approval (e.g., "In Review", "QA"). */
    reviewStates: string[];
  };

  containers: ContainerTypeDefinition[];
  integrityRules: IntegrityRuleDefinition[];
  principles: PrincipleDefinition[];
  workItems: WorkItemsDefinition;

  /** BRE validation pipelines. Keys are action names or 'action:type' for type-scoped overrides. */
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

/** All tasks sharing the same groupBy value must share the same mustMatch value. */
export interface SameContainerRule extends BaseIntegrityRule {
  type: 'same-container';
  groupBy: string;
  mustMatch: string;
}

/** Dependency ordering: a task's container value must be >= its dependency tasks' values. */
export interface OrderingRule extends BaseIntegrityRule {
  type: 'ordering';
  containerType: string;
}

/** All tasks in a child container must share the same parent container. */
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
