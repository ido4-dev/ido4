# @ido4/core

The domain layer of the [ido4 Development Governance Platform](https://github.com/ido4-dev/ido4). Contains all governance logic with zero CLI or MCP dependencies.

## What's Inside

### Business Rule Engine (BRE)

A composable validation pipeline with 27 built-in steps that validates every task state transition:

```typescript
import { ServiceContainer } from '@ido4/core';

const container = await ServiceContainer.create({
  projectRoot: process.cwd(),
  githubToken: process.env.GITHUB_TOKEN!,
});

// Validate a transition before executing it
const result = await container.taskService.validateTransition(42, 'start', actor);

if (!result.valid) {
  for (const failure of result.failures) {
    console.log(`${failure.stepName}: ${failure.message}`);
    // DependencyValidation: dependency #38 not completed (In Progress)
  }
}
```

### Domain Services

| Service | Responsibility |
|---|---|
| `TaskService` | Workflow transitions (start, review, approve, block, unblock, return, refine, ready) with BRE validation |
| `WaveService` | Wave management, status aggregation, completion validation |
| `EpicService` | Epic detection via GitHub sub-issues, integrity validation |
| `DependencyService` | Dependency graph analysis, circular detection, cascade analysis |
| `AuditService` | Event-sourced audit trail (append-only JSONL + in-memory ring buffer) |
| `AnalyticsService` | Cycle time, lead time, throughput, blocking time — from audit events |
| `AgentService` | Multi-agent registration, task locking with TTL, heartbeat, stale detection |
| `ComplianceService` | Deterministic 0-100 compliance scoring across 5 weighted categories |
| `WorkDistributionService` | 4-dimension task scoring and recommendation engine |
| `MergeReadinessService` | 6-check CI/CD quality gate with override mechanism |
| `SandboxService` | Governed sandbox creation with embedded violations for demos and testing |

### ServiceContainer

Single initialization point with 9-layer dependency resolution:

```
Layer 1: Config (project root, GitHub token)
Layer 2: Infrastructure (GraphQL client, repositories)
Layer 3: Domain validators (EpicValidator, BRE pipeline)
Layer 4: Domain services (Task, Wave, Dependency, Epic)
Layer 5: Audit + Sandbox
Layer 6: Project + Analytics + Agents
Layer 7: Compliance
Layer 8: Work Distribution
Layer 9: Merge Readiness
```

### Infrastructure

- **GraphQL Client** — Exponential backoff retry, rate limit tracking, cursor-based pagination
- **GitHub Repositories** — Issue, Project, Repository adapters for GitHub's GraphQL API
- **Configurable Methodology** — `.ido4/methodology.json` customization with `DEFAULT_METHODOLOGY` fallback

## Installation

```bash
npm install @ido4/core
```

## Key Interfaces

All services are accessed through interfaces defined in `container/interfaces.ts`:

- `ITaskService` — Task operations and BRE validation
- `IWaveService` — Wave lifecycle management
- `IEpicService` — Epic detection and integrity
- `IDependencyService` — Dependency graph operations
- `IAuditService` — Audit trail queries
- `IAnalyticsService` — Metrics computation
- `IAgentService` — Agent registration and task locking
- `IComplianceService` — Compliance scoring
- `IWorkDistributionService` — Task recommendations
- `IMergeReadinessService` — Merge gate checks

## Testing

```bash
npm run test           # 840 tests
npm run test:coverage  # With coverage report
```

## License

[MIT](../../LICENSE)
