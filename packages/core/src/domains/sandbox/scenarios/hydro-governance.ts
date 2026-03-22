/**
 * Hydro Governance Scenario Config — minimal configuration for the
 * algorithmic scenario builder. Wave-based delivery with 4 waves.
 */

import type { ScenarioConfig } from '../types.js';
import { TECHNICAL_SPEC_CONTENT } from './shared-technical-spec.js';

export const HYDRO_GOVERNANCE: ScenarioConfig = {
  id: 'hydro-governance',
  name: 'Hydro Governance',
  description: 'Wave-based notification platform governed by Hydro methodology',
  profileId: 'hydro',
  technicalSpecContent: TECHNICAL_SPEC_CONTENT,

  executionContainers: [
    { name: 'wave-001-foundation', containerType: 'wave', state: 'completed', description: 'Auth, event model, shared infrastructure' },
    { name: 'wave-002-core', containerType: 'wave', state: 'active', description: 'Delivery engine, channels, templates, API' },
    { name: 'wave-003-advanced', containerType: 'wave', state: 'planned', description: 'Analytics, integrations, advanced features' },
    { name: 'wave-004-polish', containerType: 'wave', state: 'planned', description: 'Performance, monitoring, documentation' },
  ],
};
