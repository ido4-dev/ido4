/**
 * Narrative and memory seed generators — produce human-readable text
 * from computed scenario context and roles.
 *
 * Narratives are methodology-aware: they use the profile's container
 * terminology (waves/sprints/cycles) and state names rather than
 * generic language.
 */

import type { BuildContext, ScenarioRoles } from './types.js';
import { extractCodeRefs } from './utils.js';
import type { ScenarioNarrative } from '../types.js';

/** Generate the scenario narrative from computed facts and profile context. */
export function generateNarrative(ctx: BuildContext, roles: ScenarioRoles): ScenarioNarrative {
  const project = ctx.ingestion.parsed.projectName;
  const methodology = ctx.profile.name;
  const completedName = ctx.containerNames.completed ?? 'the first phase';
  const activeName = ctx.containerNames.active ?? 'the active phase';
  const containerLabel = ctx.execContainerType;
  const reviewLabel = ctx.states.review;
  const activeLabel = ctx.states.active;

  const blocker = roles.cascadeBlocker ? ctx.tasksByRef.get(roles.cascadeBlocker) : null;
  const falseStatusTask = roles.falseStatus ? ctx.tasksByRef.get(roles.falseStatus) : null;
  const reviewTask = roles.reviewBottleneck ? ctx.tasksByRef.get(roles.reviewBottleneck) : null;
  const integrityTask = roles.integrityViolation ? ctx.tasksByRef.get(roles.integrityViolation) : null;
  const downstreamCount = roles.cascadeBlocker ? (ctx.reverseDeps.get(roles.cascadeBlocker) ?? []).length : 0;

  const totalActive = roles.ready.length + (roles.cascadeBlocker ? 1 : 0) +
    (roles.reviewBottleneck ? 1 : 0) + (roles.falseStatus ? 1 : 0) + roles.blocked.length;
  const completedCount = roles.completed.length;

  const violationContext: Record<string, string> = {};

  if (blocker) {
    const blockerCodeRefs = extractCodeRefs(blocker.body);
    const codeHint = blockerCodeRefs.length > 0 ? ` The work centers on ${blockerCodeRefs[0]}.` : '';
    violationContext['CASCADE_BLOCKER'] = `${blocker.title} (${blocker.ref}) is the critical path — ${downstreamCount} tasks depend on it. Agent alpha has been working on it for several days but the implementation proved more complex than estimated.${codeHint}`;
  }

  if (falseStatusTask) {
    violationContext['FALSE_STATUS'] = `${falseStatusTask.title} (${falseStatusTask.ref}) was moved to ${reviewLabel} during a status sync meeting, but no PR was created. The status was updated optimistically.`;
  }

  if (reviewTask) {
    violationContext['REVIEW_BOTTLENECK'] = `${reviewTask.title} (${reviewTask.ref}) has a PR open for several days with no reviewers. The team's reviewer capacity is stretched.`;
  }

  if (integrityTask) {
    const correctContainer = ctx.containerNames.active ?? 'the active container';
    const wrongContainer = ctx.containerNames.planned[0] ?? 'a planned container';
    violationContext['INTEGRITY_VIOLATION'] = `${integrityTask.title} (${integrityTask.ref}) is part of a capability with tasks in ${correctContainer} but was moved to ${wrongContainer}, breaking ${containerLabel} integrity. The move was a capacity decision that violated the governance rule.`;
  }

  const setup = `A team is building ${project} under ${methodology} governance. ${completedName} shipped cleanly with ${completedCount} task${completedCount !== 1 ? 's' : ''} completed. ${activeName} is the active ${containerLabel} with ${totalActive} tasks in flight. Two agents (alpha and beta) are assigned to the project.`;

  const tensionParts: string[] = [];
  if (blocker) {
    tensionParts.push(`${blocker.title} (${blocker.ref}) has been in ${activeLabel} for several days, blocking ${downstreamCount} downstream tasks`);
  }
  if (falseStatusTask) {
    tensionParts.push(`${falseStatusTask.title} shows ${reviewLabel} but has no PR`);
  }
  if (reviewTask) {
    tensionParts.push(`${reviewTask.title} has a PR but zero reviews after 3 days`);
  }
  if (integrityTask) {
    tensionParts.push(`${integrityTask.title} is assigned to the wrong ${containerLabel}`);
  }
  if (roles.killed.length > 0) {
    tensionParts.push(`${roles.killed.length} task${roles.killed.length !== 1 ? 's were' : ' was'} killed by the circuit breaker`);
  }

  return {
    setup,
    tension: tensionParts.join('. ') + '.',
    violationContext,
    expectedFindings: [
      ...(roles.cascadeBlocker ? [`Cascade blocker: ${roles.cascadeBlocker} blocking ${downstreamCount} tasks`] : []),
      ...(roles.falseStatus ? [`False status: ${roles.falseStatus} in ${reviewLabel} with no PR`] : []),
      ...(roles.reviewBottleneck ? [`Review bottleneck: ${roles.reviewBottleneck} PR stale for 3+ days`] : []),
      ...(roles.integrityViolation ? [`Integrity violation: ${roles.integrityViolation} in wrong ${containerLabel}`] : []),
      ...(roles.killed.length > 0 ? [`Killed tasks: ${roles.killed.length} tasks terminated`] : []),
    ],
    resolution: buildResolution(roles, containerLabel),
  };
}

function buildResolution(roles: ScenarioRoles, containerLabel: string): string {
  const parts: string[] = [];
  if (roles.cascadeBlocker) {
    parts.push(`Unblock ${roles.cascadeBlocker} by pairing agent-beta to accelerate the critical path`);
  }
  if (roles.falseStatus) {
    parts.push(`correct ${roles.falseStatus} false status — actual work state needs to match the board`);
  }
  if (roles.reviewBottleneck) {
    parts.push(`escalate ${roles.reviewBottleneck} review bottleneck to team lead`);
  }
  if (roles.integrityViolation) {
    parts.push(`fix ${roles.integrityViolation} ${containerLabel} assignment to restore capability integrity`);
  }
  return parts.length > 0
    ? parts[0]!.charAt(0).toUpperCase() + parts[0]!.slice(1) + (parts.length > 1 ? '. Also: ' + parts.slice(1).join('; ') : '') + '.'
    : 'Review governance signals and address violations.';
}


/** Generate governance memory seed from computed facts. */
export function generateMemorySeed(ctx: BuildContext, roles: ScenarioRoles): string {
  const project = ctx.ingestion.parsed.projectName;
  const blocker = roles.cascadeBlocker ? ctx.tasksByRef.get(roles.cascadeBlocker) : null;
  const downstreamCount = roles.cascadeBlocker ? (ctx.reverseDeps.get(roles.cascadeBlocker) ?? []).length : 0;
  const containerLabel = ctx.execContainerType;

  const signals: string[] = [];
  if (blocker) {
    const codeRefs = extractCodeRefs(blocker.body);
    const codeHint = codeRefs.length > 0 ? ` (working in ${codeRefs[0]})` : '';
    signals.push(`- **Cascade Blocker**: ${blocker.title} (${blocker.ref})${codeHint} blocking ${downstreamCount} downstream tasks`);
  }
  if (roles.falseStatus) {
    signals.push(`- **False Status**: ${ctx.tasksByRef.get(roles.falseStatus)?.title ?? roles.falseStatus} in ${ctx.states.review} with no PR`);
  }
  if (roles.reviewBottleneck) {
    signals.push(`- **Review Bottleneck**: ${ctx.tasksByRef.get(roles.reviewBottleneck)?.title ?? roles.reviewBottleneck} PR stale for 3+ days`);
  }
  if (roles.integrityViolation) {
    signals.push(`- **Integrity Violation**: ${ctx.tasksByRef.get(roles.integrityViolation)?.title ?? roles.integrityViolation} in wrong ${containerLabel}`);
  }
  if (roles.killed.length > 0) {
    signals.push(`- **Killed**: ${roles.killed.length} tasks terminated (correct governance behavior)`);
  }

  return `# Sandbox Governance Memory Seed

## Project: ${project}
- Methodology: ${ctx.profile.name}
- Active ${containerLabel}: ${ctx.containerNames.active ?? 'unknown'}
- Tasks: ${ctx.ingestion.created.tasks.length} total, ${roles.completed.length} completed, ${roles.blocked.length} blocked
- Capabilities: ${ctx.ingestion.created.groupIssues.length}

## Active Governance Signals
${signals.join('\n')}

## Active Agents
- **agent-alpha**: locked on ${roles.cascadeBlocker ?? 'critical path task'}
- **agent-beta**: available for assignment

## Work Distribution
- Highest leverage: Unblock ${roles.cascadeBlocker ?? 'cascade blocker'} (${downstreamCount} downstream tasks unblocked)
- Parallelizable once unblocked: ${roles.blocked.length + (roles.reviewBottleneck ? 1 : 0) + (roles.falseStatus ? 1 : 0)} tasks waiting on the critical path
- Independent work: ${roles.ready.length} task${roles.ready.length !== 1 ? 's' : ''} ready with no blockers
`;
}
