# Validation Extensibility — ValidationStepRegistry as Plugin Architecture

## The Design Decision

The BRE (Business Rule Engine) is built on a **factory-based, parameterized step registry** that is already a plugin architecture. Validation steps are registered by name, referenced in profile pipelines by name, and instantiated on demand with dependency injection. The engine never knows what specific validations exist — it resolves them at runtime from the registry.

This is the extensibility point for pluggable quality gates, external auditors, and custom governance rules.

## Architecture

```
MethodologyProfile
    │
    │  pipelines: { "start": { steps: ["SourceStatusValidation:READY_FOR_DEV",
    │                                    "StatusTransitionValidation:IN_PROGRESS",
    │                                    "TaskLockValidation"] } }
    │
    ▼
TaskTransitionValidator (orchestrator)
    │
    │  Resolves step names from pipeline
    │  Supports type-scoped lookup: "start:feature" → "start"
    │
    ▼
ValidationStepRegistry
    │
    │  factories: Map<string, (deps, param?) => ValidationStep>
    │
    │  Parameterized names: "StepName:PARAM" → factory("StepName") + param("PARAM")
    │
    ▼
ValidationPipeline
    │
    │  Runs ALL steps (fail-safe: one failure doesn't stop others)
    │  Aggregates: canProceed, failedSteps, warnedSteps, executionTime
    │
    ▼
ValidationResult { canProceed, reason, details[], suggestions[] }
```

## How Steps Are Registered

The `registerAllBuiltinSteps()` function registers all 32 built-in steps with the registry. Each registration is a factory function:

```typescript
// Stateless steps — no dependencies needed
registry.register('BaseTaskFieldsValidation', () => new BaseTaskFieldsValidation());

// Parameterized steps — param comes from pipeline config
registry.register('StatusTransitionValidation', (_deps, param) =>
  new StatusTransitionValidation(param!));  // param = target status

// Service-injected steps — factory receives full StepDependencies
registry.register('DependencyValidation', (deps) =>
  new DependencyValidation(deps.issueRepository));

// Conditionally active steps
registry.register('TaskLockValidation', (deps) => {
  if (!deps.agentService) {
    return passThrough('TaskLockValidation');  // No agent service → always pass
  }
  return new TaskLockValidation(deps.agentService);
});
```

### Step Categories (32 total)

| Category | Steps | Pattern |
|---|---|---|
| **Source-status guards** (3) | RefineFromBacklog, ReadyFromRefinement, StartFromReady | Stateless, check current status |
| **Generic transitions** (1) | StatusTransitionValidation | Parameterized with target status |
| **Task-state guards** (6) | AlreadyCompleted, AlreadyBlocked, NotBlocked, Blocked, AlreadyDone, BackwardTransition | Stateless, prevent invalid states |
| **Field requirements** (5) | BaseTaskFields, AcceptanceCriteria, EffortEstimation, DependencyIdentification, WaveAssignment | Stateless, check field completeness |
| **Constraint validations** (4) | AISuitability, RiskLevel, FastTrack, ApprovalRequirement | Stateless, enforce metadata rules |
| **Service-injected** (4) | EpicIntegrity, Dependency, ImplementationReadiness, SubtaskCompletion | Injected with repositories/validators |
| **Quality gates** (3) | PRReview, TestCoverage, SecurityScan | Injected with repository service |
| **Multi-agent** (1) | TaskLock | Injected with AgentService |
| **Profile-driven generic** (5) | SourceStatus, ContainerAssignment, ContainerIntegrity, ContainerSingularity, CircuitBreaker | Parameterized, profile-aware |

## Parameterized Step Names

The registry supports a `Name:Param` convention parsed at resolution time:

```
"StatusTransitionValidation:IN_PROGRESS"
   → stepName: "StatusTransitionValidation"
   → param: "IN_PROGRESS"

"ContainerAssignmentValidation:wave"
   → stepName: "ContainerAssignmentValidation"
   → param: "wave"
```

This enables a single step class to handle multiple cases. `StatusTransitionValidation` validates transitions to any target status — the specific status is the parameter, configured in the profile's pipeline.

## How Pipelines Are Resolved

```
Profile defines:
  pipelines: {
    "start": { steps: ["SourceStatusValidation:READY_FOR_DEV", "StatusTransitionValidation:IN_PROGRESS", ...] },
    "start:bug": { steps: ["StatusTransitionValidation:IN_PROGRESS", ...] },  // bugs skip ReadyForDev
  }

TaskTransitionValidator resolves:
  1. Get task's work item type (e.g., "bug" from label)
  2. Try "start:bug" in pipelines → found → use it
  3. Fallback to "start" if type-specific not found
  4. Instantiate each step via registry.create(name, deps)
  5. Run through ValidationPipeline
```

Type-scoped pipelines let different work item types have different governance. Bugs skip refinement gates. Spikes have lighter DoR. Tech debt requires 2 reviewers. All configured in the profile — no engine changes.

## The ValidationStep Interface

Every step implements:

```typescript
interface ValidationStep {
  name: string;
  validate(context: ValidationContext): Promise<ValidationStepResult>;
}

interface ValidationStepResult {
  stepName: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  details?: Record<string, unknown>;
}
```

The interface is minimal by design. A step receives the full context (issue data, config, workflow config, actor) and returns pass/fail with a message. This is all an external step needs to implement.

## StepDependencies (the DI contract)

Steps that need services receive them through `StepDependencies`:

```typescript
interface StepDependencies {
  issueRepository: IIssueRepository;
  integrityValidator: IIntegrityValidator;
  repositoryRepository: IRepositoryRepository;
  projectConfig: IProjectConfig;
  workflowConfig: IWorkflowConfig;
  gitWorkflowConfig: IGitWorkflowConfig;
  agentService?: IAgentService;                   // Optional: multi-agent mode
  containerMetadataService?: IContainerMetadataService;  // Optional: circuit breaker
  profile: MethodologyProfile;                    // Always available
}
```

This is the contract for dependency injection. A custom step can access any service it needs through this interface.

## Why This Is Already a Plugin Architecture

The registry has all the properties of a plugin system:

1. **Named registration**: Steps are identified by string names, not class references. An external step just needs a unique name.
2. **Factory pattern**: Steps are created on demand, not at startup. A factory can do initialization, configuration, or even network calls.
3. **Dependency injection**: The factory receives all available services. An external step can access GitHub APIs, audit trail, agent state — anything the built-in steps can access.
4. **Profile-driven activation**: Which steps run is controlled by the profile's `pipelines` config. Adding a step to governance means adding its name to a pipeline — not modifying engine code.
5. **Parameterization**: A single step class can handle multiple configurations via the `:param` convention.

### What's Missing for Full Plugin Support

The registry currently requires steps to be registered in `registerAllBuiltinSteps()` — a compile-time binding. For true external plugins:

- **Runtime registration**: Load step factories from external packages or configuration files
- **Step discovery**: Scan a directory or registry for available steps (similar to how ProfileRegistry resolves built-in profiles)
- **Validation step metadata**: Steps should declare what they check, what signals they consume, and whether they block or warn — enabling profile authors to understand what they're adding

These are incremental additions to an existing pattern, not architectural redesigns.

## Connection to Quality Gates

The 3 existing quality gate steps (PRReviewValidation, TestCoverageValidation, SecurityScanValidation) are already validation steps in the registry. Making quality gates "pluggable" means:

1. External quality gate steps are registered the same way built-in ones are
2. A "CodeRabbitReviewValidation" step would implement `ValidationStep`, query CodeRabbit's API via `StepDependencies`, and return pass/fail
3. The profile's pipeline adds `"CodeRabbitReviewValidation"` to the `approve` pipeline
4. The BRE runs it alongside built-in steps — no engine changes

## Key Source Files

- ValidationStepRegistry: `packages/core/src/domains/tasks/validation-step-registry.ts`
- Built-in step registration: `packages/core/src/domains/tasks/validation-steps/index.ts`
- ValidationPipeline: `packages/core/src/domains/tasks/validation-pipeline.ts`
- TaskTransitionValidator: `packages/core/src/domains/tasks/task-transition-validator.ts`
- ValidationStep interface: `packages/core/src/domains/tasks/types.ts`
- Profile pipelines: `packages/core/src/profiles/types.ts` → `MethodologyProfile.pipelines`
