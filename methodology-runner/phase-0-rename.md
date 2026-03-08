# Phase 0: Mechanical Rename

**Goal:** Replace wave/epic-specific names with container-neutral names in engine code. Zero logic changes. All 1,074 tests pass with new names.

**Prerequisites:** None (first phase).

---

## Scope Boundary

**Phase 0 IS:** Renaming class names, interface names, type names, method names, variable names, file names, directory names, event type names, and data field names from wave/epic terminology to container/integrity terminology.

**Phase 0 is NOT:**
- Merging EpicService into ContainerService (Phase 2)
- Restructuring TaskData (`wave`/`epic` fields → `containers: Record`) (Phase 2)
- Renaming validation step classes (WaveAssignmentValidation, EpicIntegrityValidation — Phase 2, involves parameterization)
- Changing MCP tool names (`list_waves` etc. — Phase 4)
- Changing config field names (`wave_field_id`, `epic_field_id` — Phase 1, profile-driven)
- Renaming EpicService/IEpicService/IEpicRepository/GitHubEpicRepository (Phase 2, merge)
- Renaming epic-tools.ts/epic-schemas.ts (Phase 2, merge into container-tools)
- Renaming EpicUtils/epic-utils.ts (Phase 2, may not survive)
- Renaming wave-detection.ts aggregator (Phase 2, logic change)
- Renaming sandbox types (WaveDefinition, EpicDefinition — Phase 2)
- Updating plugin skills/agent .md files (Phase 4)
- Updating docs/ directory (Phase 4)

---

## 1. File & Directory Renames

Execute with `git mv` to preserve history.

| # | Current Path | New Path |
|---|---|---|
| 1 | `packages/core/src/domains/waves/` | `packages/core/src/domains/containers/` |
| 2 | `packages/core/src/domains/containers/wave-service.ts` | `packages/core/src/domains/containers/container-service.ts` |
| 3 | `packages/core/src/domains/epics/epic-validator.ts` | `packages/core/src/domains/epics/integrity-validator.ts` |
| 4 | `packages/mcp/src/tools/wave-tools.ts` | `packages/mcp/src/tools/container-tools.ts` |
| 5 | `packages/mcp/src/schemas/wave-schemas.ts` | `packages/mcp/src/schemas/container-schemas.ts` |
| 6 | `packages/core/tests/domains/waves/` | `packages/core/tests/domains/containers/` |
| 7 | `packages/core/tests/domains/containers/wave-service.test.ts` | `packages/core/tests/domains/containers/container-service.test.ts` |
| 8 | `packages/mcp/tests/tools/wave-tools.test.ts` | `packages/mcp/tests/tools/container-tools.test.ts` |

**Order:** Rename directories first (#1, #6), then files within them (#2, #7), then standalone files (#3-5, #8).

---

## 2. Type & Interface Renames

All in `packages/core/src/container/interfaces.ts` (definitions) + all consumers.

| # | Current | New | Notes |
|---|---|---|---|
| 1 | `IWaveService` | `IContainerService` | Interface |
| 2 | `IEpicValidator` | `IIntegrityValidator` | Interface |
| 3 | `WaveSummary` | `ContainerSummary` | Data type |
| 4 | `WaveStatusData` | `ContainerStatusData` | Data type |
| 5 | `WaveCreateResult` | `ContainerCreateResult` | Data type |
| 6 | `WaveAssignResult` | `ContainerAssignResult` | Data type |
| 7 | `WaveCompletionResult` | `ContainerCompletionResult` | Data type |
| 8 | `EpicIntegrityResult` | `IntegrityResult` | Data type |
| 9 | `WaveAnalytics` | `ContainerAnalytics` | In `domains/analytics/` |
| 10 | `WaveAssignmentEvent` | `ContainerAssignmentEvent` | In `shared/events/types.ts` |

---

## 3. Data Field Renames

Fields inside the renamed types that reference wave/epic terminology.

| # | Type (new name) | Current Field | New Field |
|---|---|---|---|
| 1 | `ContainerAssignResult` | `wave: string` | `container: string` |
| 2 | `ContainerAssignResult` | `epicIntegrity: IntegrityResult` | `integrity: IntegrityResult` |
| 3 | `ContainerCompletionResult` | `wave: string` | `container: string` |
| 4 | `ContainerAssignmentEvent` | `waveName: string` | `containerName: string` |
| 5 | `ContainerAssignmentEvent` | `previousWave?: string` | `previousContainer?: string` |
| 6 | `ContainerAssignmentEvent` | `epicIntegrityMaintained: boolean` | `integrityMaintained: boolean` |
| 7 | `ContainerAssignmentEvent` | `type: 'wave.assignment'` | `type: 'container.assignment'` |
| 8 | `WorkRecommendationEvent` | `waveName: string` | `containerName: string` |
| 9 | `ContainerAnalytics` | `waveName: string` | `containerName: string` |
| 10 | `IntegrityResult` | `maintained: boolean` | `maintained: boolean` | NO CHANGE — already generic |
| 11 | `ContainerSummary` | all fields | NO CHANGE — already generic |

---

## 4. Class Renames

| # | Current | New | File |
|---|---|---|---|
| 1 | `class WaveService` | `class ContainerService` | `domains/containers/container-service.ts` |
| 2 | `class EpicValidator` | `class IntegrityValidator` | `domains/epics/integrity-validator.ts` |

---

## 5. Method Renames

### IContainerService (was IWaveService)

| # | Current | New |
|---|---|---|
| 1 | `listWaves()` | `listContainers()` |
| 2 | `getWaveStatus(waveName: string)` | `getContainerStatus(name: string)` |
| 3 | `createWave(name: string, description?: string)` | `createContainer(name: string, description?: string)` |
| 4 | `assignTaskToWave(issueNumber: number, waveName: string)` | `assignTaskToContainer(issueNumber: number, containerName: string)` |
| 5 | `validateWaveCompletion(waveName: string)` | `validateContainerCompletion(name: string)` |

### IIntegrityValidator (was IEpicValidator)

| # | Current | New |
|---|---|---|
| 1 | `validateWaveAssignmentEpicIntegrity(issueNumber, waveName)` | `validateAssignmentIntegrity(issueNumber, containerName)` |

### IProjectRepository (infrastructure — method name only, implementation unchanged)

| # | Current | New |
|---|---|---|
| 1 | `getWaveStatus(wave: string)` | `getContainerStatus(containerName: string)` |

### IIssueRepository (infrastructure — method name only)

| # | Current | New |
|---|---|---|
| 1 | `updateTaskWave(issueNumber, waveName)` | `updateTaskContainer(issueNumber, containerName)` |

### IRepositoryRepository (infrastructure — method name only)

| # | Current | New |
|---|---|---|
| 1 | `checkWaveBranchMerged(waveName)` | `checkContainerBranchMerged(containerName)` |

### IAnalyticsService

| # | Current | New |
|---|---|---|
| 1 | `getWaveAnalytics(waveName)` | `getContainerAnalytics(containerName)` |

### InputSanitizer (static method + constant)

| # | Current | New |
|---|---|---|
| 1 | `validateWaveFormat(name)` | `validateContainerFormat(name)` |
| 2 | `WAVE_FORMAT_PATTERN` (if constant) | `CONTAINER_FORMAT_PATTERN` |

---

## 6. Variable & Property Renames

### ServiceContainer (class properties + constructor + `create()` method)

| # | Current | New |
|---|---|---|
| 1 | `waveService: IWaveService` | `containerService: IContainerService` |
| 2 | `epicValidator: IEpicValidator` | `integrityValidator: IIntegrityValidator` |

### ServiceContainerDependencies (private interface)

Same two properties renamed.

### Local variables in service-container.ts `create()`:

| # | Current | New |
|---|---|---|
| 1 | `const epicValidator = new EpicValidator(...)` | `const integrityValidator = new IntegrityValidator(...)` |
| 2 | `const waveService = new WaveService(...)` | `const containerService = new ContainerService(...)` |
| 3 | All `epicValidator` refs in constructor args | `integrityValidator` |
| 4 | All `waveService` refs in constructor args | `containerService` |

### All consumers of `container.waveService` / `container.epicValidator`:

Every call site like `container.waveService.listWaves()` becomes `container.containerService.listContainers()`.

---

## 7. Barrel Export Updates

### `packages/core/src/domains/containers/index.ts` (was `waves/index.ts`)
```typescript
export { ContainerService } from './container-service.js';
```

### `packages/core/src/domains/epics/index.ts`
```typescript
export { EpicService } from './epic-service.js';
export { IntegrityValidator } from './integrity-validator.js';  // was EpicValidator
```

### `packages/core/src/index.ts`
- `WaveService` → `ContainerService` (from `./domains/containers/index.js`)
- `EpicValidator` → `IntegrityValidator` (from `./domains/epics/index.js`)
- All type re-exports: `WaveSummary` → `ContainerSummary`, etc.
- `WaveAssignmentEvent` → `ContainerAssignmentEvent`
- `WaveAnalytics` → `ContainerAnalytics`
- Import path: `./domains/waves/index.js` → `./domains/containers/index.js`

### `packages/core/src/shared/events/index.ts`
- Re-export `ContainerAssignmentEvent` instead of `WaveAssignmentEvent`

### `packages/mcp/src/tools/index.ts`
- Import path: `./wave-tools.js` → `./container-tools.js`
- Function name: `registerWaveTools` → `registerContainerTools`

### `packages/mcp/src/schemas/index.ts`
- Import path: `./wave-schemas.js` → `./container-schemas.js`
- Re-export renamed schemas

---

## 8. Schema Renames (MCP)

In `packages/mcp/src/schemas/container-schemas.ts` (was `wave-schemas.ts`):

| # | Current | New |
|---|---|---|
| 1 | `WaveNameSchema` | `ContainerNameSchema` |
| 2 | `CreateWaveSchema` | `CreateContainerSchema` |
| 3 | `AssignTaskToWaveSchema` | `AssignTaskToContainerSchema` |

Schema field names (`waveName`, `name`, etc.) stay — they match MCP tool parameter names which don't change in Phase 0.

---

## 9. MCP Tool Handler Updates

In `packages/mcp/src/tools/container-tools.ts` (was `wave-tools.ts`):
- Function: `registerWaveTools` → `registerContainerTools`
- All `container.waveService.X()` → `container.containerService.X()`
- Method calls use new names (e.g., `.listContainers()`)
- MCP tool names (`list_waves`, etc.) **stay unchanged** — renamed in Phase 4

---

## 10. Files Affected (complete list)

### Core Package — Source (content changes)
1. `packages/core/src/container/interfaces.ts` — type/interface renames + field renames
2. `packages/core/src/container/service-container.ts` — imports, variable names, constructor
3. `packages/core/src/domains/containers/container-service.ts` — class name, method names, local vars
4. `packages/core/src/domains/epics/integrity-validator.ts` — class name, method name
5. `packages/core/src/domains/epics/index.ts` — export update
6. `packages/core/src/domains/containers/index.ts` — export update
7. `packages/core/src/domains/tasks/task-service.ts` — `waveService`/`epicValidator` refs if any
8. `packages/core/src/domains/tasks/suggestion-service.ts` — wave refs
9. `packages/core/src/domains/tasks/task-transition-validator.ts` — `epicValidator` → `integrityValidator`
10. `packages/core/src/domains/analytics/analytics-service.ts` — `IWaveService` → `IContainerService`, `WaveAnalytics` → `ContainerAnalytics`, method rename
11. `packages/core/src/domains/analytics/index.ts` — re-exports
12. `packages/core/src/domains/compliance/compliance-service.ts` — wave event refs
13. `packages/core/src/domains/distribution/work-distribution-service.ts` — `waveService` refs
14. `packages/core/src/domains/distribution/types.ts` — wave refs if any
15. `packages/core/src/domains/gate/merge-readiness-service.ts` — `epicService` refs (NO CHANGE — EpicService not renamed)
16. `packages/core/src/domains/sandbox/sandbox-service.ts` — `waveService`/`epicValidator` refs
17. `packages/core/src/domains/sandbox/scenarios/governance-showcase.ts` — wave refs in data
18. `packages/core/src/domains/sandbox/types.ts` — possibly
19. `packages/core/src/domains/sandbox/index.ts` — re-exports
20. `packages/core/src/domains/projects/project-init-service.ts` — wave refs
21. `packages/core/src/config/project-config-loader.ts` — wave refs
22. `packages/core/src/config/methodology-config.ts` — wave refs
23. `packages/core/src/shared/events/types.ts` — event type renames + field renames
24. `packages/core/src/shared/events/index.ts` — re-exports
25. `packages/core/src/shared/sanitizer/input-sanitizer.ts` — `validateWaveFormat` → `validateContainerFormat`
26. `packages/core/src/shared/utils/field-extractor.ts` — wave refs
27. `packages/core/src/infrastructure/github/repositories/project-repository.ts` — `getWaveStatus` → `getContainerStatus`
28. `packages/core/src/infrastructure/github/repositories/issue-repository.ts` — `updateTaskWave` → `updateTaskContainer`
29. `packages/core/src/infrastructure/github/repositories/repository-repository.ts` — `checkWaveBranchMerged` → `checkContainerBranchMerged`
30. `packages/core/src/index.ts` — all re-exports

### Core Package — Tests (content changes)
31. `packages/core/tests/domains/containers/container-service.test.ts` — class/method/type renames
32. `packages/core/tests/domains/epics/epic-validator.test.ts` — class/method rename (IntegrityValidator)
33. `packages/core/tests/domains/tasks/task-service.test.ts` — wave/epic refs in mocks
34. `packages/core/tests/domains/tasks/task-service-list-create.test.ts` — wave refs
35. `packages/core/tests/domains/tasks/task-workflow-service.test.ts` — wave refs
36. `packages/core/tests/domains/tasks/task-transition-validator.test.ts` — epicValidator refs
37. `packages/core/tests/domains/tasks/suggestion-service.test.ts` — wave refs
38. `packages/core/tests/domains/tasks/validation-step-registry.test.ts` — wave refs if any
39. `packages/core/tests/domains/tasks/validation-steps/service-injected-validations.test.ts` — wave refs
40. `packages/core/tests/domains/compliance/compliance-service.test.ts` — wave event refs
41. `packages/core/tests/domains/analytics/analytics-service.test.ts` — wave analytics refs
42. `packages/core/tests/domains/distribution/work-distribution-service.test.ts` — waveService refs
43. `packages/core/tests/domains/gate/merge-readiness-service.test.ts` — epicService refs (NO CHANGE if EpicService untouched)
44. `packages/core/tests/domains/sandbox/sandbox-service.test.ts` — wave refs
45. `packages/core/tests/domains/sandbox/scenario-integrity.test.ts` — wave refs
46. `packages/core/tests/domains/projects/project-init-service.test.ts` — wave refs
47. `packages/core/tests/integration/full-lifecycle-integration.test.ts` — wave event refs
48. `packages/core/tests/integration/audit-analytics-integration.test.ts` — wave refs
49. `packages/core/tests/integration/quality-gates-integration.test.ts` — wave refs if any
50. `packages/core/tests/integration/methodology-config-integration.test.ts` — wave refs if any
51. `packages/core/tests/config/methodology-config.test.ts` — wave refs
52. `packages/core/tests/config/workflow-config.test.ts` — wave refs if any
53. `packages/core/tests/container/service-container.test.ts` — waveService/epicValidator refs
54. `packages/core/tests/infrastructure/github/repositories/issue-repository.test.ts` — updateTaskWave refs
55. `packages/core/tests/infrastructure/github/repositories/project-repository.test.ts` — getWaveStatus refs
56. `packages/core/tests/shared/utils/field-extractor.test.ts` — wave refs
57. `packages/core/tests/shared/sanitizer/input-sanitizer.test.ts` — validateWaveFormat refs
58. `packages/core/tests/shared/events/in-memory-event-bus.test.ts` — wave.assignment refs
59. `packages/core/tests/domains/audit/audit-service.test.ts` — wave event refs
60. `packages/core/tests/domains/audit/audit-store.test.ts` — wave event refs

### MCP Package — Source (content changes)
61. `packages/mcp/src/tools/container-tools.ts` — function name, method calls
62. `packages/mcp/src/tools/index.ts` — import path, function name
63. `packages/mcp/src/tools/task-tools.ts` — wave refs if any
64. `packages/mcp/src/tools/project-tools.ts` — wave refs if any
65. `packages/mcp/src/tools/sandbox-tools.ts` — wave refs if any
66. `packages/mcp/src/tools/skill-data-tools.ts` — wave refs
67. `packages/mcp/src/tools/compliance-tools.ts` — wave refs if any
68. `packages/mcp/src/tools/analytics-tools.ts` — wave analytics refs
69. `packages/mcp/src/tools/distribution-tools.ts` — wave refs
70. `packages/mcp/src/tools/gate-tools.ts` — wave refs if any
71. `packages/mcp/src/schemas/container-schemas.ts` — schema name renames
72. `packages/mcp/src/schemas/index.ts` — import path, re-exports
73. `packages/mcp/src/schemas/task-schemas.ts` — wave refs if any
74. `packages/mcp/src/schemas/skill-data-schemas.ts` — wave refs if any
75. `packages/mcp/src/aggregators/standup-aggregator.ts` — waveService refs
76. `packages/mcp/src/aggregators/compliance-aggregator.ts` — wave refs
77. `packages/mcp/src/aggregators/health-aggregator.ts` — wave refs
78. `packages/mcp/src/aggregators/board-aggregator.ts` — wave refs
79. `packages/mcp/src/aggregators/coordination-aggregator.ts` — wave refs
80. `packages/mcp/src/aggregators/wave-detection.ts` — NOT RENAMED (Phase 2) but internal refs change
81. `packages/mcp/src/aggregators/types.ts` — wave refs
82. `packages/mcp/src/aggregators/index.ts` — re-exports
83. `packages/mcp/src/server.ts` — wave refs
84. `packages/mcp/src/resources/index.ts` — wave refs
85. `packages/mcp/src/prompts/index.ts` — wave refs

### MCP Package — Tests (content changes)
86. `packages/mcp/tests/tools/container-tools.test.ts` — function name, mocks
87. `packages/mcp/tests/tools/task-tools.test.ts` — wave refs if any
88. `packages/mcp/tests/tools/project-tools.test.ts` — wave refs if any
89. `packages/mcp/tests/tools/sandbox-tools.test.ts` — wave refs if any
90. `packages/mcp/tests/tools/skill-data-tools.test.ts` — wave refs
91. `packages/mcp/tests/server.test.ts` — wave refs
92. `packages/mcp/tests/schemas/schemas.test.ts` — wave schema refs
93. `packages/mcp/tests/prompts/prompts.test.ts` — wave refs
94. `packages/mcp/tests/resources/resources.test.ts` — wave refs
95. `packages/mcp/tests/aggregators/standup-aggregator.test.ts` — wave refs
96. `packages/mcp/tests/aggregators/compliance-aggregator.test.ts` — wave refs
97. `packages/mcp/tests/aggregators/health-aggregator.test.ts` — wave refs
98. `packages/mcp/tests/aggregators/board-aggregator.test.ts` — wave refs
99. `packages/mcp/tests/aggregators/coordination-aggregator.test.ts` — wave refs

---

## 11. Execution Strategy

### Step 1: Create branch
```bash
git checkout -b phase-0-mechanical-rename
```

### Step 2: Directory renames (git mv)
```bash
git mv packages/core/src/domains/waves packages/core/src/domains/containers
git mv packages/core/tests/domains/waves packages/core/tests/domains/containers
```

### Step 3: File renames (git mv)
```bash
# Core source
git mv packages/core/src/domains/containers/wave-service.ts packages/core/src/domains/containers/container-service.ts
git mv packages/core/src/domains/epics/epic-validator.ts packages/core/src/domains/epics/integrity-validator.ts

# Core tests
git mv packages/core/tests/domains/containers/wave-service.test.ts packages/core/tests/domains/containers/container-service.test.ts

# MCP source
git mv packages/mcp/src/tools/wave-tools.ts packages/mcp/src/tools/container-tools.ts
git mv packages/mcp/src/schemas/wave-schemas.ts packages/mcp/src/schemas/container-schemas.ts

# MCP tests
git mv packages/mcp/tests/tools/wave-tools.test.ts packages/mcp/tests/tools/container-tools.test.ts
```

### Step 4: Content updates — work through files systematically

**Order of content changes:**
1. **Definitions first:** `interfaces.ts` (types + interfaces), `events/types.ts` (events)
2. **Implementations:** `container-service.ts`, `integrity-validator.ts`
3. **Barrel exports:** all `index.ts` files
4. **ServiceContainer:** `service-container.ts`
5. **Consumers:** all domain services, infrastructure repos, config, sanitizer
6. **MCP layer:** tools, schemas, aggregators, server, resources, prompts
7. **Tests:** update in same order as source

### Step 5: Build
```bash
npm run build
```

### Step 6: Test
```bash
npm run test
```

### Step 7: Commit
```bash
git add -A
git commit -m "phase 0: mechanical rename wave/epic → container/integrity"
```

---

## 12. Find-Replace Reference Table

Use these exact patterns. Apply in this order to avoid conflicts.

### Pass 1: Multi-word / compound names (longest first)

| Find | Replace | Scope |
|---|---|---|
| `validateWaveAssignmentEpicIntegrity` | `validateAssignmentIntegrity` | all .ts files |
| `WaveAssignmentEvent` | `ContainerAssignmentEvent` | all .ts files |
| `WaveCompletionResult` | `ContainerCompletionResult` | all .ts files |
| `WaveAssignResult` | `ContainerAssignResult` | all .ts files |
| `WaveCreateResult` | `ContainerCreateResult` | all .ts files |
| `WaveStatusData` | `ContainerStatusData` | all .ts files |
| `WaveSummary` | `ContainerSummary` | all .ts files |
| `WaveAnalytics` | `ContainerAnalytics` | all .ts files |
| `WaveService` | `ContainerService` | all .ts files |
| `IWaveService` | `IContainerService` | all .ts files |
| `IEpicValidator` | `IIntegrityValidator` | all .ts files |
| `EpicIntegrityResult` | `IntegrityResult` | all .ts files |
| `EpicValidator` | `IntegrityValidator` | all .ts files (CAREFUL: not EpicService, not EpicUtils) |
| `epicIntegrityMaintained` | `integrityMaintained` | all .ts files |

### Pass 2: Method names (with context to avoid false matches)

| Find | Replace | Scope |
|---|---|---|
| `listWaves` | `listContainers` | all .ts files |
| `getWaveStatus` | `getContainerStatus` | all .ts files |
| `createWave` | `createContainer` | all .ts files |
| `assignTaskToWave` | `assignTaskToContainer` | all .ts files |
| `validateWaveCompletion` | `validateContainerCompletion` | all .ts files |
| `getWaveAnalytics` | `getContainerAnalytics` | all .ts files |
| `updateTaskWave` | `updateTaskContainer` | all .ts files |
| `checkWaveBranchMerged` | `checkContainerBranchMerged` | all .ts files |
| `validateWaveFormat` | `validateContainerFormat` | all .ts files |

### Pass 3: Variable/property names (context-sensitive)

| Find | Replace | Scope |
|---|---|---|
| `waveService` | `containerService` | all .ts files |
| `epicValidator` (as variable) | `integrityValidator` | service-container.ts + consumers |
| `epicIntegrity` (as field name) | `integrity` | interfaces.ts + consumers |
| `registerWaveTools` | `registerContainerTools` | MCP tools |
| `registerWaveSchemas` (if exists) | `registerContainerSchemas` | MCP schemas |

### Pass 4: Event type strings and schema names

| Find | Replace | Scope |
|---|---|---|
| `'wave.assignment'` | `'container.assignment'` | events + tests |
| `WaveNameSchema` | `ContainerNameSchema` | MCP schemas + tools |
| `CreateWaveSchema` | `CreateContainerSchema` | MCP schemas + tools |
| `AssignTaskToWaveSchema` | `AssignTaskToContainerSchema` | MCP schemas + tools |

### Pass 5: Import paths

| Find | Replace | Scope |
|---|---|---|
| `domains/waves/` | `domains/containers/` | all .ts files |
| `./wave-service.js` | `./container-service.js` | index.ts |
| `./epic-validator.js` | `./integrity-validator.js` | index.ts |
| `./wave-tools.js` | `./container-tools.js` | MCP index.ts |
| `./wave-schemas.js` | `./container-schemas.js` | MCP index.ts |
| `wave-tools.test` | `container-tools.test` | MCP test imports if any |

### Pass 6: Constants and format patterns

| Find | Replace | Scope |
|---|---|---|
| `WAVE_FORMAT_PATTERN` | `CONTAINER_FORMAT_PATTERN` | input-sanitizer.ts + tests |

---

## 13. Manual Review Points

After automated find-replace, manually check:

1. **Comments/JSDoc** referencing "wave" or "epic" — update to say "container" or "integrity" where the code entity was renamed. Leave comments that describe Hydro-specific behavior (e.g., "Epic Integrity principle") as-is.
2. **String literals in logs** — update `'Wave created'` → `'Container created'`, etc.
3. **Test descriptions** — update `describe('WaveService')` → `describe('ContainerService')`, etc.
4. **MCP tool descriptions** — leave as-is (they reference "wave" which is the Hydro term, and tool names aren't changing).
5. **Data field names in MCP responses** — the renamed fields (`.container` instead of `.wave`) will change MCP JSON responses. This is acceptable (no production clients).
6. **`epicIntegrity` field rename to `integrity`** — check all consumers that destructure this field.

---

## 14. Risk Mitigations

| Risk | Mitigation |
|---|---|
| Find-replace hits wrong "wave" (e.g., in comments about "soundwave") | Use exact compound patterns (Pass 1) first; review Pass 2-3 results manually |
| `EpicValidator` replace catches `EpicValidatorTest` or similar | Replace `EpicValidator` only after `IEpicValidator` (interface) is done; skip EpicService/EpicUtils |
| Import path breakage | Build (`npm run build`) catches all broken imports immediately |
| Test assertion strings contain old names | Test run catches failures; update assertion strings |
| Circular rename (e.g., `waveService` in a file that also has `waveStatus` we don't want to touch) | `waveService` as a variable name is unique enough; `waveStatus` as a local var in ContainerService itself should also be renamed |

---

## 15. Checklist

### File/Directory Renames
- [ ] `waves/` → `containers/` (core src)
- [ ] `waves/` → `containers/` (core tests)
- [ ] `wave-service.ts` → `container-service.ts`
- [ ] `epic-validator.ts` → `integrity-validator.ts`
- [ ] `wave-tools.ts` → `container-tools.ts` (MCP)
- [ ] `wave-schemas.ts` → `container-schemas.ts` (MCP)
- [ ] `wave-service.test.ts` → `container-service.test.ts`
- [ ] `wave-tools.test.ts` → `container-tools.test.ts`

### Type/Interface Definitions (interfaces.ts)
- [ ] `IWaveService` → `IContainerService`
- [ ] `IEpicValidator` → `IIntegrityValidator`
- [ ] All 6 data type renames (Summary, StatusData, CreateResult, AssignResult, CompletionResult, IntegrityResult)
- [ ] Field renames in AssignResult and CompletionResult

### Event Types (events/types.ts)
- [ ] `WaveAssignmentEvent` → `ContainerAssignmentEvent`
- [ ] Event type string `'wave.assignment'` → `'container.assignment'`
- [ ] Event field renames (containerName, previousContainer, integrityMaintained)
- [ ] `WorkRecommendationEvent.waveName` → `.containerName`

### Class Implementations
- [ ] `WaveService` → `ContainerService` (class + all methods + local vars)
- [ ] `EpicValidator` → `IntegrityValidator` (class + method)

### ServiceContainer
- [ ] Properties renamed (containerService, integrityValidator)
- [ ] ServiceContainerDependencies updated
- [ ] `create()` method updated (imports, variable names, constructor args)

### Infrastructure Methods
- [ ] `IProjectRepository.getWaveStatus` → `.getContainerStatus`
- [ ] `IIssueRepository.updateTaskWave` → `.updateTaskContainer`
- [ ] `IRepositoryRepository.checkWaveBranchMerged` → `.checkContainerBranchMerged`
- [ ] All 3 GitHub repository implementations updated

### Analytics
- [ ] `WaveAnalytics` → `ContainerAnalytics`
- [ ] `getWaveAnalytics` → `getContainerAnalytics`

### Sanitizer
- [ ] `validateWaveFormat` → `validateContainerFormat`
- [ ] `WAVE_FORMAT_PATTERN` → `CONTAINER_FORMAT_PATTERN`

### Barrel Exports
- [ ] `packages/core/src/domains/containers/index.ts`
- [ ] `packages/core/src/domains/epics/index.ts`
- [ ] `packages/core/src/index.ts`
- [ ] `packages/core/src/shared/events/index.ts`
- [ ] `packages/mcp/src/tools/index.ts`
- [ ] `packages/mcp/src/schemas/index.ts`

### MCP Layer
- [ ] `registerWaveTools` → `registerContainerTools`
- [ ] Schema renames (3 schemas)
- [ ] Tool handler method calls updated
- [ ] Server.ts references updated

### Consumer Services (spot-check)
- [ ] analytics-service.ts
- [ ] compliance-service.ts
- [ ] work-distribution-service.ts
- [ ] sandbox-service.ts
- [ ] task-transition-validator.ts
- [ ] suggestion-service.ts
- [ ] All aggregators

### Tests
- [ ] All test files compile
- [ ] `npm run build` passes
- [ ] `npm run test` passes — all 1,074 tests green

### Final
- [ ] No remaining `WaveService` references in source (grep check)
- [ ] No remaining `IWaveService` references in source (grep check)
- [ ] No remaining `EpicValidator` references in source (grep check — expect EpicService refs to remain)
- [ ] No remaining `IEpicValidator` references in source (grep check)
- [ ] Git commit on `phase-0-mechanical-rename` branch

---

## 16. Decisions for Later Phases

| Discovery | Affects Phase | Note |
|---|---|---|
| `EpicService` still exists after Phase 0 | Phase 2 | Merge into ContainerService |
| `IEpicRepository` / `GitHubEpicRepository` still exist | Phase 2 | Consumed by new ContainerService |
| `epic-tools.ts` / `epic-schemas.ts` still exist | Phase 2 | Merge into container-tools |
| MCP tool names still say "wave"/"epic" | Phase 4 | Register both old and new names |
| `TaskData.wave` / `TaskData.epic` fields unchanged | Phase 2 | → `containers: Record<string, string>` |
| Validation step names unchanged (WaveAssignmentValidation) | Phase 2 | → ContainerAssignmentValidation (parameterized) |
| `wave-detection.ts` aggregator unchanged | Phase 2 | → profile-aware container detection |
| Plugin .md files still reference waves/epics | Phase 4 | Content update |
| `docs/` directory still references waves/epics | Phase 4 | Docs update |
| `WAVE_FORMAT_PATTERN` regex is Hydro-specific | Phase 1 | Profile provides `namePattern` per container |
