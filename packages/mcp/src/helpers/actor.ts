/**
 * Actor helper — creates the MCP session actor identity.
 *
 * All tool calls from the MCP server use this actor for audit trail entries.
 */

import type { ActorIdentity } from '@ido4/core';

export function createMcpActor(): ActorIdentity {
  return { type: 'ai-agent', id: 'mcp-session', name: 'Claude Code' };
}
