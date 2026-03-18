/**
 * Dynamic methodology activation for bootstrap mode.
 *
 * When the MCP server starts without a methodology profile (no .ido4/ config),
 * it enters bootstrap mode with only profile-independent tools. After init_project
 * or create_sandbox writes the config, this module activates the correct methodology
 * by dynamically registering profile-dependent tools, resources, and prompts.
 *
 * Methodology is immutable once set — activation happens at most once per session.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MethodologyProfile } from '@ido4/core';

type ActivationCallback = (server: McpServer, profile: MethodologyProfile) => void;

let _activationCallback: ActivationCallback | null = null;
let _activated = false;

/**
 * Store the callback that will register profile-dependent tools.
 * Called once during createServer() in bootstrap mode.
 */
export function setActivationCallback(cb: ActivationCallback): void {
  _activationCallback = cb;
}

/**
 * Activate the methodology by loading the profile from disk and calling the
 * stored registration callback. Idempotent — does nothing if already activated
 * or if no callback was set (full mode).
 */
export async function activateMethodology(server: McpServer): Promise<void> {
  if (_activated || !_activationCallback) return;

  const { ProfileConfigLoader } = await import('@ido4/core');
  const projectRoot = process.env.IDO4_PROJECT_ROOT ?? process.cwd();

  const profile = await ProfileConfigLoader.load(projectRoot);
  _activationCallback(server, profile);
  _activated = true;

  process.stderr.write(
    `ido4: methodology activated — ${profile.name} (${profile.id}). Dynamic tool registration complete.\n`,
  );
}

/**
 * Reset activation state. Used in tests and after destroy_sandbox.
 */
export function resetMethodologyActivation(): void {
  _activationCallback = null;
  _activated = false;
}
