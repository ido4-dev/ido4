# /ido4dev:pilot-test

End-to-end verification of the governance stack. Runs through the complete governance lifecycle to confirm all tools, BRE validation, audit trail, and analytics work correctly.

## What It Does

The pilot test skill exercises every layer of the governance stack:

1. **Project status** — Verifies project configuration and connectivity
2. **Task lifecycle** — Walks a task through the full workflow (create -> start -> review -> approve)
3. **BRE validation** — Confirms validation steps execute correctly on each transition
4. **Audit trail** — Verifies events are recorded for each transition
5. **Analytics** — Confirms cycle time and throughput calculations
6. **Container management** — Creates and validates a container (wave/sprint/cycle)
7. **Dependency chain** — Creates dependent tasks and validates ordering
8. **Compliance score** — Computes score and verifies category breakdown

## When to Use

- After initial `init_project` setup to verify everything works
- After upgrading ido4 to a new version
- When onboarding a new team member to demonstrate the governance stack
- As a smoke test before a pilot engagement

## Output

```
PILOT TEST RESULTS

  Project Setup .............. PASS
  Task Creation .............. PASS
  BRE Validation (start) ..... PASS (7/7 steps)
  Task Transition (start) .... PASS
  BRE Validation (review) .... PASS (3/3 steps)
  Task Transition (review) ... PASS
  BRE Validation (approve) ... PASS (4/4 steps)
  Task Transition (approve) .. PASS
  Audit Trail ................ PASS (3 events recorded)
  Analytics .................. PASS (cycle time: 0.1 days)
  Container Management ....... PASS
  Dependency Validation ...... PASS
  Compliance Score ........... PASS (100/A)

  All 13 checks passed. Governance stack is operational.
```

## Cleanup

The pilot test creates real GitHub issues. After verification, it offers to clean up the test artifacts or leave them for further exploration.
