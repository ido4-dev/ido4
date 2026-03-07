/**
 * Actor helper — creates the MCP session actor identity.
 *
 * All tool calls from the MCP server use this actor for audit trail entries.
 * In multi-agent mode, IDO4_AGENT_ID env var provides agent-specific identity.
 */

import type { ActorIdentity } from '@ido4/core';

export function createMcpActor(agentId?: string): ActorIdentity {
  const id = agentId ?? process.env.IDO4_AGENT_ID;
  if (id) {
    return { type: 'ai-agent', id, name: `Agent ${id}` };
  }
  return { type: 'ai-agent', id: 'mcp-session', name: 'Claude Code' };
}
