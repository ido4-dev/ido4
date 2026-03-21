# Development Context Pipeline — Architecture Specification

## The Missing Layer

**Author:** Claude (Opus 4.6), commissioned by Bogdan Coman
**Date:** 2026-03-13
**Status:** IMPLEMENTED — Core infrastructure built. Task execution aggregator, context comment parser/formatter, `get_task_execution_data` MCP tool, and 8-phase execution prompts are all live. See v0.2.0+ changelog.

---

## 1. The Problem

ido4's governance layer (34 BRE validation steps, compliance scoring, audit trail) ensures agents follow the rules. But understanding rules is not the same as understanding the project.

An agent needs to know: What was built before me? What interfaces do my dependencies expose? What patterns did my epic siblings establish? Who will consume my output? What does "done" actually look like for this task? Without this context, even a perfectly governed agent builds the wrong thing.

When an agent starts task #42, it receives: `{ issueNumber: 42, fromStatus: "Ready for Dev", toStatus: "In Progress" }`. To learn *what to build*, it must separately call `get_task`. To understand *what its dependencies produced*, it must call `get_task` for each dependency individually. To know *who will consume its output*, it has no mechanism at all. To learn *what decisions its epic siblings already made*, it would need to enumerate and fetch each one.

Most agents won't do any of this unprompted. They'll start coding from the title.

The governance layer tells agents **how to follow the rules**. Nothing tells them **how to understand and execute the work**.

---

## 2. Design Philosophy

### 2.1 The System Carries the Knowledge, Not the Agent

AI agents are stateless. Each session starts fresh. An agent doesn't "learn auth" by working on auth tasks — it's a fresh LLM instance every time. The idea of specialized, knowledgeable agents that accumulate expertise is anthropomorphism.

What IS real: a fresh agent with the right 100k tokens of context will massively outperform a "specialized" agent with the wrong context.

Therefore: **knowledge belongs to the system, not the agent.** ido4's role is to assemble the right context at the right moment and deliver it to any agent — regardless of whether it's Claude, Gemini, Codex, or Cursor. The agent is raw compute. ido4 is the institutional memory.

### 2.2 GitHub Issues Are Living Specifications

Issues aren't tickets. They're specs that accumulate context over their lifecycle:
- **At creation:** intent, acceptance criteria, dependencies, design context
- **At start:** approach decisions, dependencies consumed, interfaces expected
- **During work:** discoveries, edge cases, design changes
- **At completion:** what was built, interfaces created, decisions made, test coverage

This context lives in two places: the **issue body** (the spec) and **issue comments** (the evolving narrative). Both are essential. The body is intent; the comments are reality.

### 2.3 Context Flows in Three Directions

```
      Upstream Dependencies
      (what was built before me)
              │
              ▼
    ┌─────────────────────┐
    │     CURRENT TASK     │◄──── Epic Siblings
    │   (what I'm building)│      (parallel context)
    └─────────────────────┘
              │
              ▼
      Downstream Dependents
      (who will consume my output)
```

An agent executing a task needs all three directions:
- **Upstream:** What did my dependencies produce? What interfaces, patterns, decisions?
- **Lateral:** What are my epic siblings doing? What conventions were established?
- **Downstream:** Who depends on me? What do they need from my output?

### 2.4 The Governance Layer Already Has the Right Instincts

The governance layer (Phase 4-6) already embodies the right patterns:
- Aggregators compose multi-service data into single coherent responses
- Prompts teach methodology-native reasoning, not just tool sequences
- The BRE validates declared properties deterministically
- Suggestions are typed, actionable, and contextual

This spec follows the same patterns. No new infrastructure paradigms — just a new layer built on proven foundations.

---

## 3. Architecture Overview

Five layers, building bottom-up:

```
Layer 5: Structured Context Comments (capture)
Layer 4: Enriched Start Response (delivery)
Layer 3: Task Execution Prompt — 8th prompt (guidance)
Layer 2: AI Assistant Onboarding via CLAUDE.md (orientation)
Layer 1: Comment Reading Infrastructure (plumbing)
```

### Dependency Graph

```
[1] Comment Reading ──→ [4] Enriched Start (reads dependency comments)
                    ──→ [5] Structured Comments (readable after written)

[2] CLAUDE.md Injection ──→ standalone, no dependencies

[3] Execution Prompt ──→ needs [4] to reference the data shape

[4] Enriched Start ──→ needs [1] for comment reading
                   ──→ needs reverse dependency lookup (exists in WorkDistributionService)

[5] Structured Comments ──→ needs [1] to close the read/write loop
```

**Build order:** [1] and [2] in parallel → [4] and [5] → [3] last.

---

## 4. Layer 1: Comment Reading Infrastructure

### 4.1 Problem

`addComment()` works. `getTaskWithDetails({includeComments: true})` is a stub that maps to `getTask()`. The interface (`TaskDetailOptions`) is designed but unimplemented. No `GET_ISSUE_COMMENTS` GraphQL query exists.

### 4.2 Design

#### New GraphQL Query

```graphql
# In issue-queries.ts
query GetIssueComments($owner: String!, $repo: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      comments(first: 100, orderBy: {field: UPDATED_AT, direction: ASC}) {
        nodes {
          id
          body
          author {
            login
          }
          createdAt
          updatedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
}
```

**Design decisions:**
- Fetch up to 100 comments per issue (sufficient for development context; paginate if needed later)
- Order by `UPDATED_AT ASC` — chronological narrative
- Include `author.login` to distinguish agent comments from human comments
- Include `updatedAt` to detect edited comments

#### New Types

```typescript
// In interfaces.ts
export interface TaskComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

// Extended TaskData for detail queries
export interface TaskDataWithComments extends TaskData {
  comments: TaskComment[];
}
```

**Why extend rather than add to TaskData:** Not every `getTask()` call needs comments. The lightweight path stays lightweight. Only callers that ask for comments pay the cost.

#### Implementation in IssueRepository

```typescript
// Complete the stub in issue-repository.ts
async getTaskWithDetails(
  issueNumber: number,
  options?: TaskDetailOptions
): Promise<TaskDataWithComments> {
  const task = await this.getTask(issueNumber);

  let comments: TaskComment[] = [];
  if (options?.includeComments) {
    comments = await this.getIssueComments(issueNumber);
  }

  return { ...task, comments };
}

private async getIssueComments(issueNumber: number): Promise<TaskComment[]> {
  const data = await this.client.query<GetIssueCommentsResponse>(
    GET_ISSUE_COMMENTS,
    { owner: this.owner, repo: this.repo, issueNumber }
  );
  return data.repository.issue.comments.nodes.map(node => ({
    id: node.id,
    body: node.body,
    author: node.author?.login ?? 'unknown',
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }));
}
```

#### Interface Update

```typescript
// In interfaces.ts - IIssueRepository
getTaskWithDetails(
  issueNumber: number,
  options?: TaskDetailOptions
): Promise<TaskDataWithComments>;
```

### 4.3 ido4 Context Comment Parsing

Comments written by ido4 (Layer 5) use structured markers. Layer 1 provides a parser utility:

```typescript
// In shared/utils/context-comment-parser.ts
export interface Ido4ContextBlock {
  transition: string;
  agent?: string;
  timestamp?: string;
  body: string;      // The content between markers
}

export function parseIdo4ContextComments(comments: TaskComment[]): Ido4ContextBlock[] {
  const IDO4_PATTERN = /<!-- ido4:context\s+(.*?)-->([\s\S]*?)<!-- \/ido4:context -->/g;
  // Parse attributes from opening tag, extract body between tags
  // Return structured blocks for each ido4 context comment found
}

export function filterIdo4ContextComments(comments: TaskComment[]): TaskComment[] {
  // Return only comments that contain ido4:context markers
}
```

### 4.4 Files Touched

| File | Change |
|------|--------|
| `packages/core/src/infrastructure/github/queries/issue-queries.ts` | Add `GET_ISSUE_COMMENTS` query + response type |
| `packages/core/src/infrastructure/github/repositories/issue-repository.ts` | Implement `getTaskWithDetails()`, add `getIssueComments()` |
| `packages/core/src/container/interfaces.ts` | Add `TaskComment`, `TaskDataWithComments`; update `IIssueRepository` return type |
| `packages/core/src/shared/utils/context-comment-parser.ts` | New file — parser utility |

### 4.5 Tests

- Query returns comments in chronological order
- Handles issues with zero comments
- Handles closed issues (confirmed: GitHub API returns comments for closed issues)
- `TaskDetailOptions.includeComments = false` (or omitted) doesn't fetch comments
- ido4 context comment parsing extracts structured blocks correctly
- Malformed ido4 markers are safely ignored (no crash)

---

## 5. Layer 2: AI Assistant Onboarding

### 5.1 Problem

When `init_project` runs, it creates 3 config files in `.ido4/`. Nothing tells the AI assistant that ido4 exists, what workflow to follow, or how to use the tools. A fresh Claude Code session in an ido4 project has no idea ido4 is there unless the human mentions it.

### 5.2 Design

#### Injection Point

Add a step to `ProjectInitService.initProject()` after config file creation:

```typescript
// After writing .ido4/ files
await this.injectAssistantOnboarding(projectRoot, profile, projectUrl);
```

#### CLAUDE.md Handling

```typescript
private async injectAssistantOnboarding(
  projectRoot: string,
  profile: MethodologyProfile,
  projectUrl: string
): Promise<void> {
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  const section = this.buildIdo4Section(profile, projectUrl);
  const SECTION_START = '## ido4 Development Governance';
  const SECTION_END = '<!-- /ido4 -->';

  let content: string;
  try {
    content = await fs.readFile(claudeMdPath, 'utf-8');

    // Check if section already exists
    const startIdx = content.indexOf(SECTION_START);
    const endIdx = content.indexOf(SECTION_END);

    if (startIdx !== -1 && endIdx !== -1) {
      // Replace existing section (between markers)
      content = content.substring(0, startIdx) + section + content.substring(endIdx + SECTION_END.length);
    } else if (startIdx !== -1) {
      // Start marker found but no end marker — replace from start to EOF
      content = content.substring(0, startIdx) + section;
    } else {
      // No ido4 section — append
      content = content.trimEnd() + '\n\n' + section;
    }
  } catch {
    // File doesn't exist — create with ido4 section only
    content = section;
  }

  await fs.writeFile(claudeMdPath, content, 'utf-8');
}
```

#### Section Content (Profile-Driven)

The content is generated from the MethodologyProfile, using the same `PromptContext` builder that drives prompts:

```typescript
private buildIdo4Section(profile: MethodologyProfile, projectUrl: string): string {
  const ctx = buildPromptContext(profile);
  const Container = ctx.containerSingular;   // "Wave" | "Sprint" | "Cycle"
  const container = ctx.containerLabel;      // "wave" | "sprint" | "cycle"
  const Item = ctx.itemSingular;             // "Task" | "User Story"
  const item = ctx.itemLabel;                // "task" | "user story"

  return `## ido4 Development Governance

This project uses **ido4** for specs-driven development governance (${profile.name} methodology).

### Workflow

1. **Check the board** before starting work: use the \`${ctx.toolNames.getStatus}\` tool or the \`/ido4:board\` skill
2. **Pick your next ${item}**: use \`get_next_task\` for a scored recommendation, or check the board
3. **Start work**: call \`start_task\` — read the full briefing (spec, dependencies, downstream needs) before writing code
4. **Work from the spec**: the GitHub issue body IS the specification — read it completely, understand acceptance criteria
5. **Write context**: add comments on the issue at key decisions (what you decided, why, what interfaces you created)
6. **Complete work**: verify acceptance criteria are met, tests pass, then call \`approve_task\`

### Key Rules

- Never start coding without reading the full issue spec (body + acceptance criteria)
- Check what upstream dependencies produced before building on them
- Write structured context comments so the next agent (or human) understands what you built
- All state transitions go through the BRE — if validation fails, fix the issue, don't skip it
- ${profile.principles.map(p => p.name).join(', ')} — these are non-negotiable

### ${Container} Structure

- **${Container}**: ${profile.containers.find(c => c.managed)?.description || 'The primary execution unit'}
${profile.containers.filter(c => c.id !== profile.containers.find(cc => cc.managed)?.id).map(c => `- **${c.displayName}**: ${c.description || 'Grouping container'}`).join('\n')}

### Available Skills

- \`/ido4:standup\` — Governance-aware briefing
- \`/ido4:board\` — Flow intelligence
- \`/ido4:compliance\` — Governance audit
- \`/ido4:health\` — Quick health check
- \`/ido4:plan-${container}\` — ${Container} composition
- \`/ido4:retro-${container}\` — ${Container} retrospective

### Configuration

- **Methodology**: ${profile.name} (\`.ido4/methodology-profile.json\`)
- **Project**: [GitHub Project](${projectUrl})
- **Audit trail**: \`.ido4/audit-log.jsonl\` (immutable)
<!-- /ido4 -->`;
}
```

**Design decisions:**
- Bounded by `## ido4 Development Governance` and `<!-- /ido4 -->` markers — idempotent updates
- Profile-driven terminology — Hydro users see "Wave/Epic", Scrum users see "Sprint", Shape Up users see "Cycle/Bet"
- Teaches the WORKFLOW, not just lists tools — the ordering matters
- Includes principles as non-negotiable rules
- Skills listed with methodology-specific names
- Links to project URL for quick navigation

#### Multi-Environment Support (Future)

The `buildIdo4Section()` generates content. The injection target varies by environment:
- **Claude Code**: `CLAUDE.md`
- **Cursor**: `.cursorrules` (future)
- **Gemini CLI**: equivalent config (future)
- **Generic**: `.ido4/assistant-onboarding.md` (always written as source of truth)

For now, always write `.ido4/assistant-onboarding.md` as the canonical version, and inject into `CLAUDE.md`. Future environments read from the canonical file or get their own injection.

### 5.3 Sandbox Integration

`SandboxService.createSandbox()` calls `ProjectInitService.initProject()` internally. The CLAUDE.md injection happens automatically for sandboxes too. No special handling needed.

### 5.4 Files Touched

| File | Change |
|------|--------|
| `packages/core/src/domains/projects/project-init-service.ts` | Add `injectAssistantOnboarding()`, `buildIdo4Section()` |
| `packages/core/src/config/prompt-context.ts` | Ensure `buildPromptContext()` is exported (may already be) |

### 5.5 Tests

- Creates CLAUDE.md if it doesn't exist
- Appends to existing CLAUDE.md without destroying content
- Updates existing ido4 section in place (idempotent)
- Content varies by methodology (Hydro vs Scrum vs Shape Up)
- Canonical `.ido4/assistant-onboarding.md` always written
- Sandbox creation includes CLAUDE.md injection

---

## 6. Layer 3: Task Execution Prompt

### 6.1 Problem

7 prompts exist, all for governance analysis: standup, plan, board, compliance, health, retro, review. Zero prompts guide task execution. Skills teach "how to reason about governance." Nothing teaches "how to execute a task well."

The plugin hooks fire after transitions to assess governance impact — reactive. No proactive guidance before an agent starts working.

### 6.2 Design

#### New Prompt Slot

```typescript
// In prompts/types.ts
export interface PromptGenerators {
  standup(ctx: PromptContext): string;
  planContainer(ctx: PromptContext): string;
  board(ctx: PromptContext): string;
  compliance(ctx: PromptContext): string;
  health(ctx: PromptContext): string;
  retro(ctx: PromptContext): string;
  review(ctx: PromptContext): string;
  execute(ctx: PromptContext): string;    // NEW — 8th prompt
}
```

#### Prompt Registration

```typescript
// In prompts/index.ts
const executePrompt = generators.execute(ctx);

server.prompt(
  'execute-task',
  `Specs-driven task execution guidance for ${ctx.profileName} methodology`,
  { issueNumber: z.number().int().positive().describe('The task issue number to execute') },
  async (args) => ({
    messages: [{
      role: 'user' as const,
      content: {
        type: 'text' as const,
        text: executePrompt + `\n\nTask to execute: #${args.issueNumber}`,
      },
    }],
  }),
);
```

#### Prompt Content (Methodology-Aware)

The execute prompt follows the same structure as existing prompts: data gathering instruction → interpretation framework → output guidance.

```
EXECUTE PROMPT STRUCTURE:

1. DATA GATHERING
   "Call `get_task_execution_data` with the issue number. This single call returns:"
   - task: Full spec (body, AC, metadata)
   - upstream: Dependency tasks with bodies + context comments
   - siblings: Epic sibling tasks with status + context
   - downstream: Tasks that depend on this one
   - epicProgress: Epic completion status

2. SPEC COMPREHENSION
   "Before writing any code, fully understand:"
   - Read the issue body — this is your specification
   - Parse acceptance criteria into a mental checklist
   - Identify the test plan (if present in body)
   - Check aiContext field for implementation guidance
   - Understand risk level and effort estimation

3. DEPENDENCY CONTEXT
   "Understand what was built before you:"
   - For each upstream dependency: read its body (what was supposed to be built)
     and its ido4 context comments (what was actually built, decisions made)
   - Identify interfaces you'll consume (endpoints, schemas, patterns)
   - Note conventions established (naming, error handling, patterns)

4. DOWNSTREAM AWARENESS
   "Understand who will consume your work:"
   - For each downstream dependent: read its body to understand what it needs
   - Design your interfaces to serve those needs
   - Document what you create so the next agent can find it

5. WORK EXECUTION
   Methodology-specific guidance:
   - Hydro: "Follow the 5 Unbreakable Principles. Your work must maintain
     epic integrity and dependency coherence."
   - Scrum: "Work toward the Sprint Goal. Your user story must meet the
     Definition of Done. Track your progress against story points."
   - Shape Up: "Stay within appetite. If scope grows beyond the bet's
     budget, hammer scope — cut features, not quality."

6. CONTEXT CAPTURE
   "As you work, write structured context comments on the issue:"
   - At start: your approach, dependencies consumed, key interfaces expected
   - At key decisions: what you decided and why
   - At completion: what you built, interfaces created, edge cases found,
     test coverage, patterns established

7. COMPLETION VERIFICATION
   "Before calling approve_task:"
   - Walk through each acceptance criterion — is it met?
   - Are tests written and passing?
   - Does your implementation serve downstream needs?
   - Did you write completion context?
   - Run the validation: call approve_task with dryRun: true first
```

**Why this matters:** This prompt turns agents from "executors who follow instructions" into "collaborators who understand context." The difference is institutional — every task execution builds up project knowledge for the next agent.

### 6.3 Files Touched

| File | Change |
|------|--------|
| `packages/mcp/src/prompts/types.ts` | Add `execute` to `PromptGenerators` interface |
| `packages/mcp/src/prompts/hydro-prompts.ts` | Implement `generateExecutePrompt()` |
| `packages/mcp/src/prompts/scrum-prompts.ts` | Implement `generateExecutePrompt()` |
| `packages/mcp/src/prompts/shape-up-prompts.ts` | Implement `generateExecutePrompt()` |
| `packages/mcp/src/prompts/index.ts` | Register 8th prompt with issueNumber argument |

### 6.4 Tests

- Prompt registered with correct name per methodology
- Prompt accepts `issueNumber` argument
- Content references correct tool name (`get_task_execution_data`)
- Methodology-specific guidance present (principles for Hydro, DoD for Scrum, appetite for Shape Up)
- Context capture instructions are present in all methodology variants

---

## 7. Layer 4: Enriched Start Response (Task Context Aggregator)

### 7.1 Problem

`start_task` returns `{ issueNumber, fromStatus, toStatus }`. The agent must make 5-10 separate calls to understand what it's building. Most won't.

### 7.2 Design

#### New Aggregator

```typescript
// In aggregators/task-execution-aggregator.ts
export async function aggregateTaskExecutionData(
  container: ServiceContainer,
  options: TaskExecutionAggregatorOptions
): Promise<TaskExecutionData>
```

#### Options & Return Types

```typescript
// In aggregators/types.ts

export interface TaskExecutionAggregatorOptions {
  issueNumber: number;
  includeComments?: boolean;    // default: true
  upstreamDepth?: number;       // default: 1 (direct deps only)
  downstreamDepth?: number;     // default: 1 (first layer only)
}

export interface TaskExecutionData {
  // The task itself — full spec
  task: TaskDataWithComments;

  // What my dependencies produced
  upstream: UpstreamContext[];

  // What my epic siblings are doing / have done
  siblings: SiblingContext[];

  // Who's waiting on my output
  downstream: DownstreamContext[];

  // Epic-level progress
  epicProgress: EpicProgressData | null;

  // Human-readable summary
  summary: string;
}

export interface UpstreamContext {
  task: TaskDataWithComments;    // Full body + comments (including closed issues)
  relationship: 'dependency';
  satisfied: boolean;            // Is this dependency completed?
  ido4Context: Ido4ContextBlock[];  // Parsed structured context comments
}

export interface SiblingContext {
  task: TaskData;                // Body + metadata (comments only for completed siblings)
  relationship: 'epic-sibling';
  ido4Context: Ido4ContextBlock[];  // Parsed context from completed siblings
}

export interface DownstreamContext {
  task: TaskData;                // Body shows what they need from us
  relationship: 'dependent';
  relevantExcerpt?: string;     // If we can extract what they need (from body/dependencies text)
}

export interface EpicProgressData {
  epicName: string;
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  remaining: number;
  completedTasks: Array<{ number: number; title: string }>;
  remainingTasks: Array<{ number: number; title: string }>;
}
```

#### Aggregation Logic

```typescript
export async function aggregateTaskExecutionData(
  container: ServiceContainer,
  options: TaskExecutionAggregatorOptions
): Promise<TaskExecutionData> {
  const { issueNumber } = options;

  // Phase 1: Fetch the task itself (with comments)
  const task = await container.issueRepository.getTaskWithDetails(
    issueNumber,
    { includeComments: options.includeComments ?? true }
  );

  // Phase 2: Parallel fetches for context
  const [
    dependencyAnalysis,
    allContainerTasks,
  ] = await Promise.all([
    container.dependencyService.analyzeDependencies(issueNumber),
    getEpicTasks(container, task),
  ]);

  // Phase 3: Fetch upstream dependency details (with comments)
  const upstream = await fetchUpstreamContext(
    container,
    dependencyAnalysis.dependencies,
    options.includeComments ?? true
  );

  // Phase 4: Build reverse dependency map and fetch downstream
  const downstream = await fetchDownstreamContext(
    container,
    issueNumber,
    allContainerTasks
  );

  // Phase 5: Filter and enrich siblings
  const siblings = await buildSiblingContext(
    container,
    task,
    allContainerTasks,
    issueNumber
  );

  // Phase 6: Epic progress
  const epicProgress = buildEpicProgress(task, allContainerTasks);

  // Phase 7: Summary
  const summary = buildExecutionSummary(task, upstream, siblings, downstream, epicProgress);

  return { task, upstream, siblings, downstream, epicProgress, summary };
}
```

#### Upstream Context Fetching

```typescript
async function fetchUpstreamContext(
  container: ServiceContainer,
  dependencyNodes: DependencyNode[],
  includeComments: boolean
): Promise<UpstreamContext[]> {
  // Fetch each dependency's full data + comments
  // Error isolation: if one fetch fails, others still return
  return Promise.all(
    dependencyNodes.map(async (node) => {
      try {
        const taskWithComments = await container.issueRepository.getTaskWithDetails(
          node.issueNumber,
          { includeComments }
        );
        const ido4Context = parseIdo4ContextComments(taskWithComments.comments);
        return {
          task: taskWithComments,
          relationship: 'dependency' as const,
          satisfied: node.satisfied,
          ido4Context,
        };
      } catch {
        // Graceful degradation — return basic info from dependency node
        return {
          task: { number: node.issueNumber, title: node.title, status: node.status, body: '' } as TaskDataWithComments,
          relationship: 'dependency' as const,
          satisfied: node.satisfied,
          ido4Context: [],
        };
      }
    })
  );
}
```

#### Downstream Context (Reverse Dependency)

```typescript
async function fetchDownstreamContext(
  container: ServiceContainer,
  issueNumber: number,
  allTasks: TaskData[]
): Promise<DownstreamContext[]> {
  // Reuse the proven pattern from WorkDistributionService
  const reverseMap = buildReverseDependencyMap(allTasks);
  const dependentNumbers = reverseMap.get(issueNumber) || [];

  // Fetch first layer only — their bodies show what they need
  return Promise.all(
    dependentNumbers.map(async (depNum) => {
      try {
        // Try from already-loaded tasks first (cheap)
        const cached = allTasks.find(t => t.number === depNum);
        if (cached) {
          return { task: cached, relationship: 'dependent' as const };
        }
        // Fallback: fetch individually (for tasks outside current container)
        const task = await container.issueRepository.getTask(depNum);
        return { task, relationship: 'dependent' as const };
      } catch {
        return null;
      }
    })
  ).then(results => results.filter(Boolean) as DownstreamContext[]);
}

function buildReverseDependencyMap(tasks: TaskData[]): Map<number, number[]> {
  // Same logic as WorkDistributionService.buildReverseDependencyMap()
  // Extract to shared utility to avoid duplication
  const reverseMap = new Map<number, number[]>();
  for (const task of tasks) {
    const deps = DependencyService.parseDependencies(task.dependencies);
    for (const dep of deps) {
      if (!reverseMap.has(dep)) reverseMap.set(dep, []);
      reverseMap.get(dep)!.push(task.number);
    }
  }
  return reverseMap;
}
```

**Note:** `buildReverseDependencyMap` currently lives inside `WorkDistributionService` as a private method. It should be extracted to a shared utility (e.g., `packages/core/src/shared/utils/dependency-utils.ts`) since both the distribution service and the execution aggregator need it. This avoids duplication without creating unnecessary coupling.

#### Epic Siblings

```typescript
async function buildSiblingContext(
  container: ServiceContainer,
  task: TaskData,
  allTasks: TaskData[],
  currentIssueNumber: number
): Promise<SiblingContext[]> {
  // Find the epic this task belongs to
  const epicField = Object.entries(task.containers).find(([key]) =>
    key !== container.profile.containers.find(c => c.managed)?.id
  );
  if (!epicField) return []; // No epic assignment

  const [epicKey, epicValue] = epicField;

  // Filter sibling tasks (same epic, different issue number)
  const siblingTasks = allTasks.filter(t =>
    t.containers[epicKey] === epicValue && t.number !== currentIssueNumber
  );

  // For completed siblings, fetch comments to get context
  return Promise.all(
    siblingTasks.map(async (sibling) => {
      let ido4Context: Ido4ContextBlock[] = [];

      if (isTerminalStatus(sibling.status, container.profile)) {
        try {
          const withComments = await container.issueRepository.getTaskWithDetails(
            sibling.number,
            { includeComments: true }
          );
          ido4Context = parseIdo4ContextComments(withComments.comments);
        } catch {
          // Graceful degradation
        }
      }

      return {
        task: sibling,
        relationship: 'epic-sibling' as const,
        ido4Context,
      };
    })
  );
}
```

#### Integration with MCP Tools

Two integration paths:

**Path A: Dedicated aggregator tool (like standup/board/compliance)**

```typescript
// In tools/skill-data-tools.ts
server.tool(
  'get_task_execution_data',
  'Gather all context needed to execute a task: spec, dependencies, siblings, downstream needs',
  { issueNumber: z.number().int().positive() },
  async (args) => handleErrors(async () => {
    const container = await getContainer();
    const result = await aggregateTaskExecutionData(container, {
      issueNumber: args.issueNumber,
    });
    return toCallToolResult({ success: true, data: result });
  }),
);
```

**Path B: Enriched `start_task` response**

```typescript
// In tools/task-tools.ts — modify the start transition handler
// After successful transition, include execution context in response
if (transitionSucceeded && action === startAction) {
  try {
    const executionContext = await aggregateTaskExecutionData(container, {
      issueNumber: args.issueNumber,
    });
    result.data.executionContext = executionContext;
  } catch {
    // Don't fail the transition if context aggregation fails
    result.warnings.push({
      code: 'CONTEXT_AGGREGATION_FAILED',
      message: 'Could not assemble full execution context. Use get_task_execution_data separately.',
      severity: 'warning',
    });
  }
}
```

**Recommendation: Both.** The dedicated tool serves the prompt and manual use. The enriched start response serves the common case (start → work). Error-isolated: context aggregation failure never blocks the transition.

### 7.3 Performance Characteristics

For a typical task with 2 upstream deps, 4 epic siblings (2 completed), and 1 downstream:

| Operation | API Calls | Notes |
|-----------|-----------|-------|
| Fetch task with comments | 2 | getTask + getComments |
| Dependency analysis | 2-3 | Tree traversal (already done by BRE during start) |
| Upstream with comments | 4 | 2 deps × (getTask + getComments) |
| All container tasks | 1 | getProjectItems (already paginated) |
| Completed sibling comments | 4 | 2 completed × (getTask + getComments) |
| Downstream tasks | 0-1 | Usually found in already-loaded container tasks |
| **Total** | ~12-15 | Well within GitHub rate limits |

**Optimization:** If the BRE already ran dependency analysis during the `start_task` transition, the dependency tree could be passed through rather than recomputed. This is a future optimization, not a requirement.

### 7.4 Files Touched

| File | Change |
|------|--------|
| `packages/mcp/src/aggregators/task-execution-aggregator.ts` | New file — aggregator |
| `packages/mcp/src/aggregators/types.ts` | Add `TaskExecutionData`, `UpstreamContext`, etc. |
| `packages/mcp/src/aggregators/index.ts` | Export new aggregator |
| `packages/mcp/src/tools/skill-data-tools.ts` | Register `get_task_execution_data` tool |
| `packages/mcp/src/schemas/skill-data-schemas.ts` | Add schema |
| `packages/mcp/src/tools/task-tools.ts` | Optionally enrich start response |
| `packages/core/src/shared/utils/dependency-utils.ts` | New file — extract `buildReverseDependencyMap` |
| `packages/core/src/domains/distribution/work-distribution-service.ts` | Use shared utility |

### 7.5 Tests

- Aggregates full context for task with upstream deps, siblings, downstream
- Handles task with no dependencies (empty upstream)
- Handles task with no epic (empty siblings, null epicProgress)
- Handles closed upstream dependency issues (body + comments returned)
- Error isolation: one failed fetch doesn't break entire aggregation
- Reverse dependency lookup finds downstream dependents correctly
- Epic siblings filtered correctly (same epic, different issue)
- Comments include ido4 context blocks parsed
- Performance: aggregation completes within reasonable time for typical task

---

## 8. Layer 5: Structured Context Comments

### 8.1 Problem

When agents work on tasks, the knowledge they produce dies with their session. The audit trail records "agent-beta approved task #15" but not "task #15 established the JWT refresh interface with a 30-minute TTL." Without context capture, the briefing pipeline (Layer 4) has nothing to deliver.

### 8.2 Design

#### Comment Format

ido4 context comments are valid Markdown with HTML comment markers for machine parseability:

```markdown
<!-- ido4:context transition=start agent=agent-beta timestamp=2026-03-13T10:00:00Z -->
## Starting Task #42

**Approach:** Building token rotation using the circuit breaker pattern from #38.

**Dependencies consumed:**
- #38: JWT refresh endpoint (`/auth/refresh`), RSA-256 signing, 30min TTL
- #41: User schema with bcrypt hashing, 3 tables (`users`, `sessions`, `tokens`)

**Key interfaces expected:**
- Will create `/auth/rotate` endpoint
- Will extend `TokenService` with rotation logic
<!-- /ido4:context -->
```

For completion:

```markdown
<!-- ido4:context transition=approve agent=agent-beta timestamp=2026-03-13T16:00:00Z -->
## Task #42 Completed

**What was built:**
- Token rotation endpoint `/auth/rotate` with sliding window TTL
- Extended `TokenService` with `rotateToken()` method
- Added circuit breaker (5 failures → open, 30s cooldown)

**Interfaces created:**
- `POST /auth/rotate` — accepts refresh token, returns new access + refresh pair
- `TokenService.rotateToken(refreshToken): Promise<TokenPair>`

**Key decisions:**
- Used sliding window (not fixed TTL) — better UX for active sessions
- Circuit breaker shared with refresh endpoint — single failure domain

**Edge cases found:**
- Concurrent rotation requests can race — added optimistic locking on token version
- Expired refresh tokens return 401, not 403 — matches OAuth2 spec

**Test coverage:**
- Unit: `token-rotation.test.ts` (12 tests)
- Integration: `auth-flow.test.ts` (3 tests, includes rotation + circuit breaker)
<!-- /ido4:context -->
```

**Design decisions:**
- HTML comment markers are invisible in rendered Markdown (GitHub) but parseable
- Structure is suggested, not enforced — agents can write free-form within markers
- Transition type in the marker enables filtering (show only completion context, or only start context)
- Agent ID enables attribution
- Timestamp enables ordering independent of GitHub's comment ordering

#### Transition Tool Enhancement

Add a `context` parameter to all transition tools:

```typescript
// In task-tools.ts — modify transition tool registration
server.tool(toolName, description, {
  issueNumber: z.number().int().positive(),
  message: z.string().optional().describe('Simple transition message'),
  context: z.string().optional().describe(
    'Structured development context (approach, decisions, interfaces). ' +
    'Written as an ido4 context comment on the issue.'
  ),
  // ... existing params
}, async (args) => {
  // If context provided, format and write as structured comment
  if (args.context) {
    const contextComment = formatIdo4ContextComment({
      transition: action,
      agent: createMcpActor().id,
      content: args.context,
    });
    await container.issueRepository.addComment(args.issueNumber, contextComment);
  }
  // Continue with normal transition...
});
```

#### Context Formatting Utility

```typescript
// In shared/utils/context-comment-formatter.ts
export function formatIdo4ContextComment(options: {
  transition: string;
  agent?: string;
  content: string;
}): string {
  const timestamp = new Date().toISOString();
  const agentAttr = options.agent ? ` agent=${options.agent}` : '';
  return [
    `<!-- ido4:context transition=${options.transition}${agentAttr} timestamp=${timestamp} -->`,
    options.content,
    `<!-- /ido4:context -->`,
  ].join('\n');
}
```

#### Optional BRE Validation Step

A new validation step that checks for completion context on closing transitions:

```typescript
// In validation-steps/completion-context-validation.ts
export class CompletionContextValidation implements IValidationStep {
  readonly name = 'CompletionContextValidation';
  readonly description = 'Validates that closing transitions include development context';

  async validate(context: ValidationContext): Promise<ValidationStepResult> {
    // Only applies to closing transitions
    if (!isClosingTransition(context.transition, context.profile)) {
      return { passed: true, message: 'Not a closing transition' };
    }

    // Check if context or message was provided
    if (!context.request.context && !context.request.message) {
      return {
        passed: true,  // WARNING, not error — don't block completion
        message: 'No completion context provided. Consider adding context about what was built, decisions made, and interfaces created.',
        severity: 'warning',
      };
    }

    return { passed: true, message: 'Completion context provided' };
  }
}
```

**Severity: warning, not error.** Context capture is encouraged, not enforced. The BRE nudges agents to write context but doesn't block if they don't. This can be configured per profile — enterprise teams can escalate to error if they want mandatory context.

### 8.3 Files Touched

| File | Change |
|------|--------|
| `packages/core/src/shared/utils/context-comment-formatter.ts` | New file — formatting utility |
| `packages/mcp/src/tools/task-tools.ts` | Add `context` parameter to transition tools |
| `packages/core/src/domains/tasks/validation-steps/completion-context-validation.ts` | New file — optional BRE step |
| `packages/core/src/domains/tasks/validation-step-registry.ts` | Register new step |

### 8.4 Tests

- Context comment formatted with correct ido4 markers
- Context written as GitHub issue comment on transition
- Round-trip: format → write → read → parse returns original content
- BRE step warns on closing transition without context
- BRE step passes silently on non-closing transitions
- `context` parameter is optional — transitions work without it
- Handles empty context string gracefully

---

## 9. Epic-Level Context (Extension of Layer 4)

### 9.1 Design

The `TaskExecutionData` already includes `epicProgress` and `siblings`. For standalone epic queries, a thin wrapper:

```typescript
// In aggregators/task-execution-aggregator.ts
export async function aggregateEpicContext(
  container: ServiceContainer,
  epicName: string
): Promise<EpicContextData> {
  const allTasks = await container.projectRepository.getProjectItems();
  const epicTasks = allTasks.filter(t => {
    const epicField = getEpicFieldKey(container.profile);
    return t.containers[epicField] === epicName;
  });

  // Fetch comments for completed tasks
  const tasksWithContext = await Promise.all(
    epicTasks.map(async (task) => {
      if (isTerminalStatus(task.status, container.profile)) {
        try {
          const withComments = await container.issueRepository.getTaskWithDetails(
            task.number, { includeComments: true }
          );
          return {
            task: withComments,
            ido4Context: parseIdo4ContextComments(withComments.comments),
          };
        } catch {
          return { task, ido4Context: [] };
        }
      }
      return { task, ido4Context: [] };
    })
  );

  return {
    epicName,
    progress: {
      total: epicTasks.length,
      completed: epicTasks.filter(t => isTerminalStatus(t.status, container.profile)).length,
      inProgress: epicTasks.filter(t => isActiveStatus(t.status, container.profile)).length,
      blocked: epicTasks.filter(t => t.status === container.profile.semantics?.blockedState).length,
      remaining: epicTasks.filter(t => !isTerminalStatus(t.status, container.profile) && !isActiveStatus(t.status, container.profile)).length,
    },
    tasks: tasksWithContext,
    accumulatedContext: tasksWithContext
      .filter(t => t.ido4Context.length > 0)
      .flatMap(t => t.ido4Context.map(ctx => ({
        taskNumber: t.task.number,
        taskTitle: t.task.title,
        ...ctx,
      }))),
    summary: `Epic "${epicName}": ${epicTasks.filter(t => isTerminalStatus(t.status, container.profile)).length}/${epicTasks.length} tasks completed`,
  };
}
```

This can be exposed as a tool (`get_epic_context`) and used within the task execution aggregator for richer sibling context.

---

## 10. Integration with Existing System

### 10.1 What Changes in Existing Files

**Minimal touch to existing code.** The pipeline is primarily additive:

- `interfaces.ts`: Add `TaskComment`, `TaskDataWithComments` types
- `issue-repository.ts`: Implement the existing stub + add comment query
- `issue-queries.ts`: Add one new GraphQL query
- `project-init-service.ts`: Add CLAUDE.md injection step
- `task-tools.ts`: Add `context` parameter to transition tools
- `work-distribution-service.ts`: Extract `buildReverseDependencyMap` to shared utility
- `prompts/types.ts`: Add 8th prompt slot
- `prompts/index.ts`: Register 8th prompt

**New files (not modifying existing):**
- `context-comment-parser.ts` — parser utility
- `context-comment-formatter.ts` — formatting utility
- `dependency-utils.ts` — shared reverse dep map
- `task-execution-aggregator.ts` — new aggregator
- `completion-context-validation.ts` — optional BRE step
- Prompt implementations in existing `*-prompts.ts` files (additive)

### 10.2 What Stays Untouched

- BRE pipeline architecture
- Existing 7 prompts
- Existing 4 aggregators
- ServiceContainer initialization
- Audit trail
- Compliance scoring
- Work distribution scoring
- Merge readiness gates
- All existing tools (no breaking changes)

### 10.3 Backward Compatibility

- `getTask()` continues to work unchanged — lightweight path preserved
- `getTaskWithDetails()` with no options returns same data as `getTask()` (current behavior) but now typed as `TaskDataWithComments` with empty comments array
- All transition tools work without `context` parameter (optional)
- BRE completion context step is a warning, not error
- CLAUDE.md injection is additive — existing content preserved

---

## 11. What This Enables

When this pipeline is complete, here's what happens when an agent starts a task:

1. **Orientation** (Layer 2): Agent's session starts. CLAUDE.md tells it ido4 exists, what workflow to follow, what methodology is active.

2. **Task selection** (existing): Agent calls `get_next_task`. Gets a scored recommendation with reasoning.

3. **Start work** (Layer 4): Agent calls `start_task(42)`. Gets:
   - The full spec (issue body with AC)
   - What dependencies #38 and #41 built (their bodies + completion comments)
   - What epic siblings did (conventions, interfaces established)
   - What downstream task #50 needs from this work
   - Epic progress (3 of 5 done)

4. **Execution guidance** (Layer 3): If the agent (or skill) uses the `execute-task` prompt, it gets methodology-native guidance on how to work from the spec, verify against AC, and capture context.

5. **Context capture** (Layer 5): As the agent works, it writes structured comments. At completion, it writes what was built, interfaces created, decisions made.

6. **Knowledge accumulation**: The next agent starting a task in the same epic gets all this context — automatically. The system's institutional memory grows with every task completed.

This is the cycle: **read context → execute work → write context → next agent reads context.** The system gets smarter with every iteration, even though individual agents are stateless.

---

## 12. Success Criteria

1. An agent starting a task receives enough context to understand what to build without additional research
2. An agent completing a task leaves enough context for the next agent to build on their work
3. The context pipeline works identically for Hydro, Scrum, and Shape Up methodologies
4. No existing functionality breaks (all 1507 tests continue to pass)
5. CLAUDE.md injection is idempotent (run init twice → no duplication)
6. A sandbox created after this pipeline includes full context capabilities
7. Context accumulates over multiple task completions within an epic, creating emergent project knowledge
