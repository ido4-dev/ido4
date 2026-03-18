/**
 * MCP prompt registrations — profile-driven intelligent prompts.
 *
 * These are the portable intelligence layer (Layer 2). Any MCP-compatible LLM
 * can use these prompts. They encode governance reasoning frameworks, not just
 * tool call sequences.
 *
 * All prompts use profile terminology via PromptContext — a Scrum user sees
 * "sprint"/"user story", a Shape Up user sees "cycle"/"task", Hydro sees "wave"/"task".
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';
import { z } from 'zod';
import { buildPromptContext } from './prompt-context.js';
import type { PromptGenerators } from './types.js';
import {
  HYDRO_GENERATORS,
  generateStandupPrompt,
  generatePlanContainerPrompt,
  generateBoardPrompt,
  generateCompliancePrompt,
  generateHealthPrompt,
  generateRetroPrompt,
  generateReviewPrompt,
  generateExecutePrompt,
} from './hydro-prompts.js';
import { SCRUM_GENERATORS } from './scrum-prompts.js';
import { SHAPE_UP_GENERATORS } from './shape-up-prompts.js';

// ---------------------------------------------------------------------------
// Generator dispatch
// ---------------------------------------------------------------------------

const GENERATORS: Record<string, PromptGenerators> = {
  hydro: HYDRO_GENERATORS,
  scrum: SCRUM_GENERATORS,
  'shape-up': SHAPE_UP_GENERATORS,
};

/**
 * Return the prompt generators for the given methodology profile.
 * Falls back to Hydro generators for unknown profiles (custom profiles
 * extending a built-in will use their base's generators).
 */
function getGenerators(profileId: string): PromptGenerators {
  return GENERATORS[profileId] ?? HYDRO_GENERATORS;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerPrompts(server: McpServer, profile: MethodologyProfile): void {
  const ctx = buildPromptContext(profile);
  const container = ctx.containerLabel;
  const generators = getGenerators(profile.id);

  const standupPrompt = generators.standup(ctx);
  const planPrompt = generators.planContainer(ctx);
  const boardPrompt = generators.board(ctx);
  const compliancePrompt = generators.compliance(ctx);
  const healthPrompt = generators.health(ctx);
  const retroPrompt = generators.retro(ctx);
  const reviewPrompt = generators.review(ctx);
  const executePrompt = generators.execute(ctx);

  server.prompt(
    'standup',
    'Governance-aware morning briefing that detects risks, surfaces leverage points, and recommends the highest-impact action',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: standupPrompt },
      }],
    }),
  );

  server.prompt(
    `plan-${container}`,
    `Principle-aware ${container} composition engine that groups ${ctx.itemPlural.toLowerCase()} by governance constraints and produces a valid-by-construction ${container} plan`,
    { [`${container}Name`]: z.string().optional().describe(`Name for the ${container} being planned`) },
    async (args) => {
      const nameSuffix = args[`${container}Name`] ? `\n\n${ctx.containerSingular} name to use: ${args[`${container}Name`]}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: planPrompt + nameSuffix },
        }],
      };
    },
  );

  server.prompt(
    'board',
    `Flow intelligence report — surfaces blockers, cascade risks, false statuses, and epic cohesion (arguments: ${container}Name)`,
    { [`${container}Name`]: z.string().optional().describe(`Specific ${container} to display (defaults to active ${container})`) },
    async (args) => {
      const nameSuffix = args[`${container}Name`] ? `\n\n${ctx.containerSingular} to display: ${args[`${container}Name`]}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: boardPrompt + nameSuffix },
        }],
      };
    },
  );

  server.prompt(
    'compliance',
    'Comprehensive compliance intelligence — quantitative score, structural audit, and cross-referenced synthesis',
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: compliancePrompt },
      }],
    }),
  );

  server.prompt(
    'health',
    `Quick multi-dimensional governance dashboard — one-line verdict with key metrics across flow, compliance, and team health`,
    async () => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: healthPrompt },
      }],
    }),
  );

  server.prompt(
    'retro',
    `${ctx.containerSingular} retrospective — data-backed analysis with real metrics, audit trail evidence, and actionable insights`,
    { [`${container}Name`]: z.string().optional().describe(`${ctx.containerSingular} to analyze (defaults to the most recently completed ${container})`) },
    async (args) => {
      const nameSuffix = args[`${container}Name`] ? `\n\n${ctx.containerSingular} to analyze: ${args[`${container}Name`]}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: retroPrompt + nameSuffix },
        }],
      };
    },
  );

  server.prompt(
    'review',
    `${ctx.containerSingular} review — inspect deliverables, assess outcomes, gather stakeholder feedback`,
    { [`${container}Name`]: z.string().optional().describe(`${ctx.containerSingular} to review (defaults to the most recently completed ${container})`) },
    async (args) => {
      const nameSuffix = args[`${container}Name`] ? `\n\n${ctx.containerSingular} to review: ${args[`${container}Name`]}` : '';
      return {
        messages: [{
          role: 'user' as const,
          content: { type: 'text' as const, text: reviewPrompt + nameSuffix },
        }],
      };
    },
  );

  server.prompt(
    'execute-task',
    `Specs-driven ${ctx.itemLabel} execution guidance — understand context, implement with discipline, capture knowledge`,
    { issueNumber: z.number().int().positive().describe(`The ${ctx.itemLabel} issue number to execute`) },
    async (args) => ({
      messages: [{
        role: 'user' as const,
        content: { type: 'text' as const, text: executePrompt + `\n\nTask to execute: #${args.issueNumber}` },
      }],
    }),
  );
}

// Export generators for testing (backward-compatible)
export {
  generateStandupPrompt,
  generatePlanContainerPrompt,
  generateBoardPrompt,
  generateCompliancePrompt,
  generateHealthPrompt,
  generateRetroPrompt,
  generateReviewPrompt,
  generateExecutePrompt,
  buildPromptContext,
};
