/**
 * Shared utility for resolving the active container name and
 * profile-derived semantic state helpers.
 *
 * Used by all aggregators to auto-detect the active container when
 * no explicit container name is provided, and to classify task statuses
 * using the methodology profile instead of hardcoded state names.
 */

import type { ServiceContainer, MethodologyProfile } from '@ido4/core';
import { BusinessRuleError } from '@ido4/core';

export async function resolveActiveContainer(
  container: ServiceContainer,
  containerName?: string,
): Promise<string> {
  if (containerName) return containerName;

  const waves = await container.containerService.listContainers();
  const active = waves.find((w) => w.status === 'active');

  if (!active) {
    // Derive tool names from profile
    const execContainer = container.profile.containers.find(
      (c) => c.managed && c.completionRule && c.completionRule !== 'none',
    ) ?? container.profile.containers[0]!;
    const id = execContainer.id;

    throw new BusinessRuleError({
      message: 'No active container found. Provide a containerName parameter or activate a container.',
      rule: 'ACTIVE_CONTAINER_REQUIRED',
      remediation: `Use create_${id} or assign_task_to_${id} to set up an active container.`,
    });
  }

  return active.name;
}

/**
 * Get review state names from profile.semantics.reviewStates.
 * These are states where work awaits review/approval (e.g., "In Review", "QA").
 * Cached per profile id to avoid recomputation.
 */
const reviewStateCache = new Map<string, Set<string>>();

export function getReviewStateNames(profile: MethodologyProfile): Set<string> {
  const cached = reviewStateCache.get(profile.id);
  if (cached) return cached;

  const stateNameMap = new Map(profile.states.map((s) => [s.key, s.name]));
  const names = new Set(profile.semantics.reviewStates.map((k) => stateNameMap.get(k) ?? k));
  reviewStateCache.set(profile.id, names);
  return names;
}

/**
 * Get the primary execution container id from the profile.
 * This is the container with a completionRule other than 'none'.
 */
export function getExecutionContainerId(profile: MethodologyProfile): string {
  const exec = profile.containers.find(
    (c) => c.managed && c.completionRule && c.completionRule !== 'none',
  );
  return exec?.id ?? profile.containers[0]!.id;
}
