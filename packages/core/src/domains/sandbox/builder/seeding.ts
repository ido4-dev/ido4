/**
 * Seeding generators — produce audit events, agent registrations, PR seeds,
 * and context comments from computed scenario roles.
 */

import type { BuildContext, ScenarioRoles } from './types.js';
import type { AuditSeedEvent, PRSeedDefinition } from '../types.js';

/** Generate backdated audit trail events based on task states and roles. */
export function generateAuditEvents(
  ctx: BuildContext,
  taskStates: Record<string, string>,
  roles: ScenarioRoles,
): AuditSeedEvent[] {
  const events: AuditSeedEvent[] = [];
  const s = ctx.states;

  for (const task of ctx.tasks) {
    const state = taskStates[task.ref];
    if (!state || state === s.initial) continue;

    if (state === s.terminal) {
      events.push({ taskRef: task.ref, transition: 'start', fromStatus: s.ready, toStatus: s.active, daysAgo: 10 });
      events.push({ taskRef: task.ref, transition: 'review', fromStatus: s.active, toStatus: s.review, daysAgo: 9, hoursOffset: 4 });
      events.push({ taskRef: task.ref, transition: 'approve', fromStatus: s.review, toStatus: s.terminal, daysAgo: 8 });
    } else if (state === s.active && task.ref === roles.cascadeBlocker) {
      events.push({ taskRef: task.ref, transition: 'ready', fromStatus: s.initial, toStatus: s.ready, daysAgo: 7 });
      events.push({ taskRef: task.ref, transition: 'start', fromStatus: s.ready, toStatus: s.active, daysAgo: 4 });
    } else if (state === s.review) {
      events.push({ taskRef: task.ref, transition: 'start', fromStatus: s.ready, toStatus: s.active, daysAgo: 5 });
      events.push({ taskRef: task.ref, transition: 'review', fromStatus: s.active, toStatus: s.review, daysAgo: 3 });
    } else if (state === s.blocked) {
      events.push({ taskRef: task.ref, transition: 'block', fromStatus: s.ready, toStatus: s.blocked, daysAgo: 3 });
    } else if (state === s.ready) {
      events.push({ taskRef: task.ref, transition: 'ready', fromStatus: s.initial, toStatus: s.ready, daysAgo: 1, hoursOffset: 2 });
    } else if (state === s.killed) {
      events.push({ taskRef: task.ref, transition: 'kill', fromStatus: s.active, toStatus: s.killed, daysAgo: 7 });
    }
  }

  return events;
}

/** Generate agent registrations with alpha locked on the cascade blocker. */
export function generateAgents(ctx: BuildContext, roles: ScenarioRoles) {
  const blockerTask = roles.cascadeBlocker ? ctx.tasksByRef.get(roles.cascadeBlocker) : null;
  const blockerGroup = blockerTask?.groupRef;
  const groupNames = Array.from(ctx.groupTaskRefs.keys());
  const otherGroups = groupNames.filter((g) => g !== blockerGroup).slice(0, 2);

  const groupLabel = (ref: string) => ref.replace('capability:', '').toLowerCase();

  return {
    agents: [
      {
        agentId: 'agent-alpha',
        name: 'Alpha',
        role: 'coding' as const,
        capabilities: blockerGroup ? [groupLabel(blockerGroup)] : ['backend'],
      },
      {
        agentId: 'agent-beta',
        name: 'Beta',
        role: 'coding' as const,
        capabilities: otherGroups.map(groupLabel),
      },
    ],
    locks: roles.cascadeBlocker
      ? [{ agentId: 'agent-alpha', taskRef: roles.cascadeBlocker }]
      : [],
  };
}

/** Seed a PR for the review bottleneck task with real code content. */
export function generatePRSeeds(ctx: BuildContext, roles: ScenarioRoles): PRSeedDefinition[] {
  if (!roles.reviewBottleneck) return [];
  const task = ctx.tasksByRef.get(roles.reviewBottleneck);
  if (!task) return [];

  const codeRefs = extractCodeRefs(task.body);
  const primaryFile = codeRefs[0];

  return [{
    taskRef: roles.reviewBottleneck,
    branchName: `sandbox/${task.ref.toLowerCase()}`,
    prTitle: `feat: ${task.title.toLowerCase()}`,
    filePath: primaryFile,
    patchContent: primaryFile
      ? generateImplementationStub(task.title, task.ref, primaryFile)
      : undefined,
  }];
}

/** Generate a realistic-looking implementation file for a seeded PR. */
function generateImplementationStub(title: string, ref: string, filePath: string): string {
  const className = filePath
    .split('/').pop()!
    .replace('.ts', '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  return `/**
 * ${title}
 *
 * Implementation for ${ref}. Sandbox-seeded PR for governance demonstration.
 * This file represents work submitted for review but awaiting reviewers.
 */

// TODO: Full implementation pending review approval
// See task ${ref} for acceptance criteria and technical context

export class ${className} {
  // Stub implementation — PR is open for review
  constructor() {
    // Implementation details in the PR diff
  }
}
`;
}

/** Extract file path references (src/...) from a task body. */
function extractCodeRefs(body: string): string[] {
  const matches = body.match(/src\/[a-zA-Z0-9_\-/.]+\.ts/g);
  return matches ? [...new Set(matches)] : [];
}

/** Generate context comments that reference governance signals, task relationships, and real code paths. */
export function generateContextComments(ctx: BuildContext, roles: ScenarioRoles): Record<string, string[]> {
  const comments: Record<string, string[]> = {};
  const downstreamCount = roles.cascadeBlocker
    ? (ctx.reverseDeps.get(roles.cascadeBlocker) ?? []).length
    : 0;

  if (roles.cascadeBlocker) {
    const task = ctx.tasksByRef.get(roles.cascadeBlocker);
    if (task) {
      const codeRefs = extractCodeRefs(task.body);
      const codeContext = codeRefs.length > 0
        ? ` Working in ${codeRefs.slice(0, 2).map((r) => '`' + r + '`').join(' and ')}.`
        : '';
      comments[roles.cascadeBlocker] = [
        `Started ${task.title} 4 days ago. The implementation is proving more complex than estimated.${codeContext} Currently blocking ${downstreamCount} downstream tasks.`,
      ];
    }
  }

  if (roles.reviewBottleneck) {
    const task = ctx.tasksByRef.get(roles.reviewBottleneck);
    if (task) {
      const codeRefs = extractCodeRefs(task.body);
      const codeContext = codeRefs.length > 0
        ? ` Changes in ${codeRefs.slice(0, 2).map((r) => '`' + r + '`').join(', ')}.`
        : '';
      comments[roles.reviewBottleneck] = [
        `Implementation complete.${codeContext} PR open for 3 days with no reviewers assigned.`,
      ];
    }
  }

  if (roles.falseStatus) {
    const task = ctx.tasksByRef.get(roles.falseStatus);
    if (task) {
      const codeRefs = extractCodeRefs(task.body);
      const target = codeRefs.length > 0 ? ` Target file: \`${codeRefs[0]}\`.` : '';
      comments[roles.falseStatus] = [
        `Status was updated during sync meeting but implementation has not started.${target} Needs correction.`,
      ];
    }
  }

  for (const ref of roles.blocked.slice(0, 2)) {
    const task = ctx.tasksByRef.get(ref);
    const depTitle = roles.cascadeBlocker ? ctx.tasksByRef.get(roles.cascadeBlocker)?.title : null;
    const depLabel = depTitle ? `${depTitle} (#${roles.cascadeBlocker})` : `#${roles.cascadeBlocker ?? 'upstream dependency'}`;
    comments[ref] = [
      `Blocked by ${depLabel}. Waiting for 3 days.${task ? ` Will work in ${extractCodeRefs(task.body).slice(0, 1).map((r) => '`' + r + '`').join('')}.` : ''}`,
    ];
  }

  return comments;
}
