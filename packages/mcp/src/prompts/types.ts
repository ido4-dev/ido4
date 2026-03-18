/**
 * PromptGenerators — interface for methodology-specific prompt generation.
 *
 * Each methodology (Hydro, Scrum, Shape Up) provides its own implementation
 * with governance reasoning native to that methodology's mental model.
 * 8 prompt slots, completely different analytical frameworks.
 */

import type { PromptContext } from './prompt-context.js';

export interface PromptGenerators {
  standup(ctx: PromptContext): string;
  planContainer(ctx: PromptContext): string;
  board(ctx: PromptContext): string;
  compliance(ctx: PromptContext): string;
  health(ctx: PromptContext): string;
  retro(ctx: PromptContext): string;
  review(ctx: PromptContext): string;
  execute(ctx: PromptContext): string;
}
