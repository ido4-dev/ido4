/**
 * Scrum Sprint Scenario Config — minimal configuration for the
 * algorithmic scenario builder. Sprint-based iteration with 2 sprints.
 */

import type { ScenarioConfig } from '../types.js';
import { TECHNICAL_SPEC_CONTENT } from './shared-technical-spec.js';

export const SCRUM_SPRINT: ScenarioConfig = {
  id: 'scrum-sprint',
  name: 'Scrum Sprint Showcase',
  description: 'Sprint-based notification platform governed by Scrum methodology',
  profileId: 'scrum',
  technicalSpecContent: TECHNICAL_SPEC_CONTENT,

  executionContainers: [
    { name: 'Sprint 13', containerType: 'sprint', state: 'completed', description: 'Foundation: rate limiting, API routing' },
    { name: 'Sprint 14', containerType: 'sprint', state: 'active', description: 'Core delivery pipeline, channels, templates' },
  ],
};
