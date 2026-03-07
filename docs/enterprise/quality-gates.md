# Quality Gates

Quality gates are BRE validation steps that check code quality and process compliance before allowing task transitions. They catch what CI alone can't — process violations, missing reviews, and governance gaps.

## Built-in Quality Gates

### PR Review Validation

Checks that a task's linked pull request has the required number of approving reviews.

```
PRReview:minApprovals=2
```

- Finds the PR linked to the task (via `find_task_pr`)
- Counts approving reviews (state = APPROVED)
- Blocks the transition if approvals < minimum

**Why**: Code review is a quality checkpoint. An AI agent can submit a PR, but a human (or another agent) must approve it before the task can move to Done.

### Test Coverage Validation

Checks GitHub commit status checks for test coverage data.

```
TestCoverage:threshold=80
```

- Queries the PR's latest commit status checks
- Looks for coverage-related checks
- Blocks if coverage < threshold

**Why**: AI-generated code should meet the same coverage standards as human-written code. Automated testing prevents regressions.

### Security Scan Validation

Checks the repository for vulnerability alerts.

```
SecurityScan
```

- Queries GitHub's vulnerability alerts API
- Blocks on critical or high severity findings
- Graceful degradation if API access is restricted

**Why**: Security vulnerabilities must be caught before code ships. This is especially important when AI agents are generating code at high velocity.

### Task Lock Validation

Warns when a task is locked by a different agent.

```
TaskLock
```

- Checks the in-memory/file-backed lock store
- Issues a warning (not a block) if another agent holds the lock
- Prevents accidental concurrent work

## Merge Readiness Gate

The `check_merge_readiness` tool runs 6 comprehensive checks:

| Check | What It Validates | Pass Criteria |
|---|---|---|
| Workflow Compliance | Task followed governance workflow | Audit trail shows proper transition sequence |
| PR Review | Pull request has approving reviews | N approvals (default: 1) |
| Dependency Completion | All upstream dependencies satisfied | All dependency tasks in Done status |
| Epic Integrity | Epic is cohesive within its wave | No tasks from the same epic in different waves |
| Security Gates | No vulnerability alerts | Zero critical/high severity alerts |
| Compliance Threshold | Project meets minimum score | Score >= minimum (default: 70) |

### Usage

```
check_merge_readiness(issueNumber: 42)
→ {
    ready: false,
    checks: [
      { name: "Workflow Compliance", status: "pass" },
      { name: "PR Review", status: "fail", detail: "0 approvals, 1 required" },
      { name: "Dependency Completion", status: "pass" },
      { name: "Epic Integrity", status: "warn", detail: "Auth epic split across waves" },
      { name: "Security Gates", status: "pass" },
      { name: "Compliance Threshold", status: "pass", detail: "Score 92 (A)" }
    ]
  }
```

### Emergency Override

For emergency situations, an override mechanism is available:

```
check_merge_readiness(issueNumber: 42, overrideReason: "Critical hotfix approved by CTO")
→ ready: true (overridden)
```

Overrides are:
- **Audited** — A `governance.override` event is recorded
- **Attributed** — The actor identity is captured
- **Impactful** — The compliance score's BRE pass rate category is affected

Governance doesn't prevent action — it ensures accountability.

## Configuring Gates

Gates are configured as BRE steps in `.ido4/methodology.json`:

```json
{
  "transitions": {
    "approve": {
      "steps": [
        "StatusTransition",
        "PRReview:minApprovals=2",
        "TestCoverage:threshold=90",
        "SecurityScan"
      ]
    }
  }
}
```

Remove a step to disable that gate. Add parameters to configure thresholds. The pipeline is fully composable.
