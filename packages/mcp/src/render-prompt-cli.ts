#!/usr/bin/env node
/**
 * render-prompt CLI — used by ido4dev plugin shell skills via bash injection.
 *
 * Usage:
 *   ido4-render-prompt <ceremony> [<param>] [--container <name>] [--issue <number>]
 *
 * - Positional <param> is an optional context-dependent value:
 *     • For `plan`, `plan-*`, `board`, `retro`, `review`: treated as container name
 *     • For `execute-task`: treated as issue number (must parse as positive integer)
 *     • For other ceremonies: ignored (warning on stderr in verbose mode)
 *   An empty positional is treated as "no param" — convenient for skill invocations
 *   where `$ARGUMENTS` may be an empty string.
 * - `--container <name>` and `--issue <n>` are explicit flags that override positional.
 *
 * Reads the methodology profile from `.ido4/methodology-profile.json` in
 * `IDO4_PROJECT_ROOT` (or cwd), dispatches to the correct methodology-specific
 * generator, and prints the rendered ceremony prompt to stdout.
 *
 * Exit codes:
 *   0 — success (rendered prompt on stdout)
 *   1 — error (missing profile, unknown ceremony, invalid args, etc.) with
 *       diagnostic on stderr
 *
 * Used by the ido4dev plugin's ceremony shell skills (see
 * `~/dev-projects/ido4dev/docs/phase-2-brief.md` §2 for the pattern).
 */

import { ProfileConfigLoader } from '@ido4/core';
import { renderPrompt, VALID_CEREMONIES } from './render-prompt.js';

export interface ParsedArgs {
  ceremony: string;
  containerName?: string;
  issueNumber?: number;
}

const CEREMONIES_ACCEPTING_CONTAINER = new Set([
  'plan',
  'plan-wave',
  'plan-sprint',
  'plan-cycle',
  'board',
  'retro',
  'review',
]);

export function usage(): string {
  return (
    `Usage: ido4-render-prompt <ceremony> [<param>] [--container <name>] [--issue <number>]\n` +
    `\n` +
    `Valid ceremonies: ${VALID_CEREMONIES.join(', ')}\n` +
    `\n` +
    `Positional <param> is optional:\n` +
    `  • plan/board/retro/review: used as container name (e.g., "Wave-003", "Sprint 5")\n` +
    `  • execute-task: used as issue number (positive integer)\n` +
    `  • other ceremonies: ignored\n` +
    `Empty string is treated as "no param" (supports skill $ARGUMENTS substitution).\n` +
    `\n` +
    `Reads .ido4/methodology-profile.json from IDO4_PROJECT_ROOT (or cwd).`
  );
}

/**
 * Parse CLI argv into a ParsedArgs struct.
 *
 * Exported for unit tests — keeps the CLI entry point thin.
 *
 * @throws Error with usage text on invalid args
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  if (args.length === 0) {
    throw new Error(usage());
  }
  const ceremony = args[0]!;
  if (ceremony.startsWith('--') || ceremony === '-h' || ceremony === '--help') {
    throw new Error(usage());
  }

  let containerName: string | undefined;
  let issueNumber: number | undefined;
  let positionalParamSeen = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--container') {
      const value = args[++i];
      if (value === undefined) throw new Error(`--container requires a value`);
      if (value !== '') containerName = value;
    } else if (arg === '--issue') {
      const value = args[++i];
      if (value === undefined) throw new Error(`--issue requires a value`);
      if (value !== '') {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== value) {
          throw new Error(`--issue must be a positive integer, got: ${value}`);
        }
        issueNumber = parsed;
      }
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    } else {
      // Positional param. Empty string (from $ARGUMENTS substitution with no user
      // input) is treated as "no param" — no error.
      if (positionalParamSeen) {
        throw new Error(`Unexpected extra argument: ${arg}\n\n${usage()}`);
      }
      positionalParamSeen = true;
      if (arg === '') continue;

      if (ceremony === 'execute-task') {
        const parsed = Number.parseInt(arg, 10);
        if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== arg) {
          throw new Error(`execute-task positional arg must be a positive integer (issue number), got: ${arg}`);
        }
        if (issueNumber === undefined) issueNumber = parsed;
      } else if (CEREMONIES_ACCEPTING_CONTAINER.has(ceremony)) {
        if (containerName === undefined) containerName = arg;
      }
      // For ceremonies without container/issue support (standup, compliance, health),
      // a positional is silently ignored (common for skill invocation patterns).
    }
  }

  return { ceremony, containerName, issueNumber };
}

async function main(): Promise<void> {
  try {
    const { ceremony, containerName, issueNumber } = parseArgs(process.argv);
    const projectRoot = process.env.IDO4_PROJECT_ROOT ?? process.cwd();
    const profile = await ProfileConfigLoader.load(projectRoot);
    const result = renderPrompt(profile, ceremony, { containerName, issueNumber });
    process.stdout.write(result.text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`ido4-render-prompt: ${message}\n`);
    process.exit(1);
  }
}

// Run main only when executed as a CLI, not when imported (for tests).
// Handles both direct invocation (node render-prompt-cli.js) and npm bin symlinks.
const isMain = process.argv[1] && (
  process.argv[1].endsWith('render-prompt-cli.js') ||
  process.argv[1].endsWith('ido4-render-prompt')
);
if (isMain) {
  void main();
}
