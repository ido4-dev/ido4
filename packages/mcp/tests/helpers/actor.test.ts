import { describe, it, expect } from 'vitest';
import { createMcpActor } from '../../src/helpers/actor.js';

describe('createMcpActor', () => {
  it('returns an ai-agent actor', () => {
    const actor = createMcpActor();
    expect(actor.type).toBe('ai-agent');
    expect(actor.id).toBe('mcp-session');
    expect(actor.name).toBe('Claude Code');
  });

  it('returns a new object each time', () => {
    const a = createMcpActor();
    const b = createMcpActor();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
