/**
 * Shared utility for resolving the active wave name.
 *
 * Used by all aggregators to auto-detect the active wave when
 * no explicit wave name is provided.
 */

import type { ServiceContainer } from '@ido4/core';
import { BusinessRuleError } from '@ido4/core';

export async function resolveActiveWave(
  container: ServiceContainer,
  waveName?: string,
): Promise<string> {
  if (waveName) return waveName;

  const waves = await container.waveService.listWaves();
  const active = waves.find((w) => w.status === 'active');

  if (!active) {
    throw new BusinessRuleError({
      message: 'No active wave found. Provide a waveName parameter or activate a wave.',
      rule: 'ACTIVE_WAVE_REQUIRED',
      remediation: 'Use create_wave or assign_task_to_wave to set up an active wave.',
    });
  }

  return active.name;
}
