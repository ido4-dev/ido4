/**
 * Runtime Prompt Rendering — the engine for ido4dev plugin shell skills.
 *
 * Each ido4dev shell skill is a ~5-line markdown file with a single bash
 * injection that calls the `ido4-render-prompt` CLI. The CLI reads the
 * active methodology profile, dispatches to the correct methodology-specific
 * generator, and prints the rendered ceremony prompt text to stdout. Claude
 * Code substitutes that output into the skill body before handing it to
 * Claude — so the user's `/ido4dev:standup` invocation delivers a
 * profile-aware ceremony prompt rendered fresh from the canonical
 * `PromptGenerators` source.
 *
 * This file exports the pure `renderPrompt` function so it can be exercised
 * in unit tests without touching the filesystem. The CLI wrapper lives in
 * `render-prompt-cli.ts`.
 *
 * Design rationale: see `~/dev-projects/ido4dev/docs/phase-2-brief.md` §2.
 */

import type { MethodologyProfile } from '@ido4/core';
import { buildPromptContext, type PromptContext } from './prompts/prompt-context.js';
import type { PromptGenerators } from './prompts/types.js';
import { HYDRO_GENERATORS } from './prompts/hydro-prompts.js';
import { SCRUM_GENERATORS } from './prompts/scrum-prompts.js';
import { SHAPE_UP_GENERATORS } from './prompts/shape-up-prompts.js';

// ---------------------------------------------------------------------------
// Generator dispatch — mirrors prompts/index.ts GENERATORS map
// ---------------------------------------------------------------------------

const GENERATORS: Record<string, PromptGenerators> = {
  hydro: HYDRO_GENERATORS,
  scrum: SCRUM_GENERATORS,
  'shape-up': SHAPE_UP_GENERATORS,
};

/**
 * Ceremony name → PromptGenerators key.
 *
 * Plugin-user-facing names map to the canonical `PromptGenerators` slot:
 * - `plan`, `plan-wave`, `plan-sprint`, `plan-cycle` → `planContainer`
 *   (plugin shells use the methodology-neutral `/ido4dev:plan`; legacy
 *   per-methodology names are accepted for backward-compatible invocation)
 * - `execute-task` → `execute`
 * - all other names map 1:1
 */
const CEREMONY_ALIASES: Record<string, keyof PromptGenerators> = {
  standup: 'standup',
  plan: 'planContainer',
  'plan-wave': 'planContainer',
  'plan-sprint': 'planContainer',
  'plan-cycle': 'planContainer',
  board: 'board',
  compliance: 'compliance',
  health: 'health',
  retro: 'retro',
  review: 'review',
  'execute-task': 'execute',
};

/**
 * Suffix verb per ceremony when `containerName` is provided.
 *
 * These mirror the exact language `registerPrompts` uses in `prompts/index.ts`
 * so shell-rendered output is byte-identical to MCP-prompt-invoked output for
 * the same profile + parameters.
 */
const CONTAINER_SUFFIX_VERB: Record<string, string> = {
  plan: 'name to use',
  'plan-wave': 'name to use',
  'plan-sprint': 'name to use',
  'plan-cycle': 'name to use',
  board: 'to display',
  retro: 'to analyze',
  review: 'to review',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderOptions {
  /**
   * Optional container name (wave name, sprint name, cycle name) to append
   * as a parameter suffix. Applicable to `plan*`, `board`, `retro`, `review`.
   */
  containerName?: string;
  /**
   * Optional issue number for the `execute-task` ceremony. Appended as
   * `Task to execute: #<n>`.
   */
  issueNumber?: number;
}

export interface RenderResult {
  /** The fully-rendered ceremony prompt text, ready to be emitted to stdout. */
  text: string;
}

/** Ceremony names renderPrompt accepts. Exposed for CLI arg validation and tests. */
export const VALID_CEREMONIES = Object.freeze(Object.keys(CEREMONY_ALIASES));

export class UnknownCeremonyError extends Error {
  constructor(name: string) {
    super(
      `Unknown ceremony: "${name}". Valid ceremonies: ${VALID_CEREMONIES.join(', ')}`,
    );
    this.name = 'UnknownCeremonyError';
  }
}

export class UnknownMethodologyError extends Error {
  constructor(profileId: string) {
    super(
      `No prompt generators registered for methodology "${profileId}". ` +
      `Known methodologies: ${Object.keys(GENERATORS).join(', ')}`,
    );
    this.name = 'UnknownMethodologyError';
  }
}

/**
 * Render a methodology-aware ceremony prompt as a string.
 *
 * Output is byte-identical to what `prompts/index.ts:registerPrompts` would
 * produce for the same profile + parameters when an MCP client invokes the
 * corresponding MCP prompt. This is the contract: the two code paths (MCP
 * prompt handler, shell skill bash injection) render the same content.
 *
 * Falls back to Hydro generators for unknown `profile.id` values — matches
 * the behavior of `prompts/index.ts:getGenerators`, which supports custom
 * profiles that extend a built-in methodology.
 *
 * @throws UnknownCeremonyError if `ceremonyName` isn't in VALID_CEREMONIES
 */
export function renderPrompt(
  profile: MethodologyProfile,
  ceremonyName: string,
  options: RenderOptions = {},
): RenderResult {
  const key = CEREMONY_ALIASES[ceremonyName];
  if (!key) {
    throw new UnknownCeremonyError(ceremonyName);
  }

  const generators = GENERATORS[profile.id] ?? HYDRO_GENERATORS;
  const generator = generators[key];
  // Defensive: every PromptGenerators implementation ships all slots, but guard
  // against a profile whose generators object is incomplete (unknown runtime state).
  if (!generator) {
    throw new UnknownMethodologyError(profile.id);
  }

  const ctx = buildPromptContext(profile);
  let text = generator(ctx);
  text = appendSuffix(text, ctx, ceremonyName, options);

  return { text };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function appendSuffix(
  text: string,
  ctx: PromptContext,
  ceremonyName: string,
  options: RenderOptions,
): string {
  if (options.containerName !== undefined) {
    const verb = CONTAINER_SUFFIX_VERB[ceremonyName];
    if (verb) {
      return `${text}\n\n${ctx.containerSingular} ${verb}: ${options.containerName}`;
    }
  }
  if (options.issueNumber !== undefined && ceremonyName === 'execute-task') {
    return `${text}\n\nTask to execute: #${options.issueNumber}`;
  }
  return text;
}
