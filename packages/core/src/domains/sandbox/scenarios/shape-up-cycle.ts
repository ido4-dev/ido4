/**
 * Shape Up Cycle Scenario Config — minimal configuration for the
 * algorithmic scenario builder. Cycle-based with bets and circuit breaker.
 */

import type { ScenarioConfig } from '../types.js';
import { TECHNICAL_SPEC_CONTENT } from './shared-technical-spec.js';

export const SHAPE_UP_CYCLE: ScenarioConfig = {
  id: 'shape-up-cycle',
  name: 'Shape Up Cycle Showcase',
  description: 'Cycle-based notification platform governed by Shape Up methodology',
  profileId: 'shape-up',
  technicalSpecContent: TECHNICAL_SPEC_CONTENT,

  executionContainers: [
    { name: 'cycle-002-foundation', containerType: 'cycle', state: 'completed' },
    {
      name: 'cycle-003-delivery', containerType: 'cycle', state: 'active',
      metadata: {
        startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    },
  ],

  groupingContainers: [
    { name: 'bet-core-delivery', containerType: 'bet', state: 'active' },
    { name: 'bet-channel-providers', containerType: 'bet', state: 'active' },
    { name: 'bet-template-system', containerType: 'bet', state: 'killed' },
  ],

  cooldownCount: 4,
};
