/**
 * PromptContext — profile-derived terminology for dynamic prompt generation.
 *
 * Provides consistent terminology throughout all prompts based on the loaded
 * methodology profile. For Hydro, the generated text is identical to the
 * original hardcoded constants.
 */

import type { MethodologyProfile } from '@ido4/core';

export interface PromptContext {
  /** Container terminology */
  containerSingular: string;   // "Wave", "Cycle", "Sprint"
  containerPlural: string;     // "Waves", "Cycles", "Sprints"
  containerLabel: string;      // "wave", "cycle", "sprint"

  /** Work item terminology */
  itemSingular: string;        // "Task", "User Story"
  itemPlural: string;          // "Tasks", "User Stories"
  itemLabel: string;           // "task", "user story"

  /** State names */
  blockedStateName: string;    // "Blocked"
  terminalStateNames: string[];  // ["Done"] or ["Shipped", "Killed"]
  activeStateNames: string[];    // ["In Progress", "In Review"]
  readyStateNames: string[];    // ["Ready for Dev"]
  allStateNames: string[];      // All state names

  /** Review states: states where work awaits review/approval (from profile.semantics.reviewStates) */
  reviewStateNames: string[];

  /** Working states: active states that are NOT review states (e.g., "In Progress" but not "In Review") */
  workingStateNames: string[];

  /** Principles */
  principleNames: string[];
  principleList: { name: string; description: string }[];
  principleCount: number;

  /** Tool names (profile-driven) */
  toolNames: {
    listContainers: string;
    getStatus: string;
    assign: string;
    create?: string;
    validateCompletion?: string;
  };

  /** Profile metadata */
  profileName: string;
  profileId: string;
}

export function buildPromptContext(profile: MethodologyProfile): PromptContext {
  // Find the primary execution container (with completionRule !== 'none')
  const execContainer = profile.containers.find((c) => c.managed && c.completionRule && c.completionRule !== 'none')
    ?? profile.containers[0]!;

  const stateNameMap = new Map(profile.states.map((s) => [s.key, s.name]));
  const resolveStateName = (key: string): string => stateNameMap.get(key) ?? key;

  // Review states: explicit from profile (e.g., "In Review", "QA")
  const reviewStateNames = profile.semantics.reviewStates.map(resolveStateName);

  const label = execContainer.singular.toLowerCase();

  return {
    containerSingular: execContainer.singular,
    containerPlural: execContainer.plural,
    containerLabel: label,
    itemSingular: profile.workItems.primary.singular,
    itemPlural: profile.workItems.primary.plural,
    itemLabel: profile.workItems.primary.singular.toLowerCase(),
    blockedStateName: profile.semantics.blockedStates.map(resolveStateName).join(', ') || 'Blocked',
    terminalStateNames: profile.semantics.terminalStates.map(resolveStateName),
    activeStateNames: profile.semantics.activeStates.map(resolveStateName),
    readyStateNames: profile.semantics.readyStates.map(resolveStateName),
    allStateNames: profile.states.map((s) => s.name),
    reviewStateNames,
    workingStateNames: profile.semantics.activeStates
      .map(resolveStateName)
      .filter((s) => !reviewStateNames.includes(s)),
    principleNames: profile.principles.map((p) => p.name),
    principleList: profile.principles.map((p) => ({ name: p.name, description: p.description })),
    principleCount: profile.principles.length,
    toolNames: {
      listContainers: `list_${execContainer.id}s`,
      getStatus: `get_${execContainer.id}_status`,
      assign: `assign_task_to_${execContainer.id}`,
      create: execContainer.namePattern ? `create_${execContainer.id}` : undefined,
      validateCompletion: execContainer.completionRule && execContainer.completionRule !== 'none'
        ? `validate_${execContainer.id}_completion` : undefined,
    },
    profileName: profile.name,
    profileId: profile.id,
  };
}
