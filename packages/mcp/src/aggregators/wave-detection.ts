/**
 * Shared utility for resolving the active container name.
 *
 * Used by all aggregators to auto-detect the active container when
 * no explicit container name is provided.
 */

import type { ServiceContainer } from '@ido4/core';
import { BusinessRuleError } from '@ido4/core';

export async function resolveActiveContainer(
  container: ServiceContainer,
  containerName?: string,
): Promise<string> {
  if (containerName) return containerName;

  const waves = await container.containerService.listContainers();
  const active = waves.find((w) => w.status === 'active');

  if (!active) {
    throw new BusinessRuleError({
      message: 'No active container found. Provide a containerName parameter or activate a container.',
      rule: 'ACTIVE_CONTAINER_REQUIRED',
      remediation: 'Use create_wave or assign_task_to_wave to set up an active container.',
    });
  }

  return active.name;
}
