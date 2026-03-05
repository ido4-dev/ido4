/**
 * Actor identity utilities — serialization, parsing, and constants.
 *
 * ActorIdentity is defined in logger.ts (canonical location).
 * This module provides utilities for working with actors across
 * the governance chain: request → service → validation → audit → event.
 */

import type { ActorIdentity } from './logger.js';

/** System actor for internal/automated operations (config loading, migrations, etc.) */
export const SYSTEM_ACTOR: Readonly<ActorIdentity> = Object.freeze({
  type: 'system',
  id: 'ido4-system',
  name: 'ido4 System',
});

/**
 * Serialize an ActorIdentity to a compact string for log messages, branch names, etc.
 *
 * Format: `{type}:{id}` or `{type}:{id}:{name}` if name is present.
 *
 * @example
 *   serializeActor({ type: 'ai-agent', id: 'agent-1', name: 'Claude' })
 *   // => 'ai-agent:agent-1:Claude'
 *
 *   serializeActor({ type: 'human', id: 'jdoe' })
 *   // => 'human:jdoe'
 */
export function serializeActor(actor: ActorIdentity): string {
  if (actor.name) {
    return `${actor.type}:${actor.id}:${actor.name}`;
  }
  return `${actor.type}:${actor.id}`;
}

/**
 * Parse a serialized actor string back to ActorIdentity.
 *
 * @throws Error if the string format is invalid
 */
export function parseActor(serialized: string): ActorIdentity {
  const parts = serialized.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid actor format: "${serialized}". Expected "{type}:{id}" or "{type}:{id}:{name}"`);
  }

  const type = parts[0]!;
  const id = parts[1]!;

  if (type !== 'human' && type !== 'ai-agent' && type !== 'system') {
    throw new Error(`Invalid actor type: "${type}". Expected "human", "ai-agent", or "system"`);
  }

  const result: ActorIdentity = { type, id };
  // Name may contain colons (e.g., "ai-agent:agent-1:Claude: Code Edition")
  // so join remaining parts
  if (parts.length > 2) {
    return { ...result, name: parts.slice(2).join(':') };
  }
  return result;
}
