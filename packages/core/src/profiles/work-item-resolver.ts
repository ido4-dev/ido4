/**
 * Work Item Type Resolver — resolves a task's work item type from its labels.
 *
 * Uses the profile's workItems.typeSource configuration to find a matching label
 * (e.g., 'type:bug' → 'bug'), validates against known types, and falls back
 * to workItems.defaultType.
 */

import type { MethodologyProfile } from './types.js';

/**
 * Resolve the work item type for a task from its labels.
 *
 * @param labels - The task's GitHub labels (string array)
 * @param profile - The active methodology profile
 * @returns The resolved work item type ID (e.g., 'story', 'bug', 'spike')
 */
export function resolveWorkItemType(labels: string[], profile: MethodologyProfile): string {
  const { typeSource, defaultType, types } = profile.workItems;

  if (typeSource.method !== 'label') {
    return defaultType;
  }

  const prefix = typeSource.identifier;
  const validTypeIds = new Set(types.map((t) => t.id));

  for (const label of labels) {
    if (label.startsWith(prefix)) {
      const typeId = label.slice(prefix.length);
      if (validTypeIds.has(typeId)) {
        return typeId;
      }
    }
  }

  return defaultType;
}
