import { describe, it, expect } from 'vitest';
import { SYSTEM_ACTOR, serializeActor, parseActor } from '../../src/shared/actor.js';
import type { ActorIdentity } from '../../src/shared/logger.js';

describe('SYSTEM_ACTOR', () => {
  it('is a frozen system actor', () => {
    expect(SYSTEM_ACTOR.type).toBe('system');
    expect(SYSTEM_ACTOR.id).toBe('ido4-system');
    expect(SYSTEM_ACTOR.name).toBe('ido4 System');
    expect(Object.isFrozen(SYSTEM_ACTOR)).toBe(true);
  });
});

describe('serializeActor', () => {
  it('serializes actor without name', () => {
    const actor: ActorIdentity = { type: 'human', id: 'jdoe' };
    expect(serializeActor(actor)).toBe('human:jdoe');
  });

  it('serializes actor with name', () => {
    const actor: ActorIdentity = { type: 'ai-agent', id: 'agent-1', name: 'Claude' };
    expect(serializeActor(actor)).toBe('ai-agent:agent-1:Claude');
  });

  it('serializes system actor', () => {
    expect(serializeActor(SYSTEM_ACTOR)).toBe('system:ido4-system:ido4 System');
  });
});

describe('parseActor', () => {
  it('parses actor without name', () => {
    const actor = parseActor('human:jdoe');
    expect(actor.type).toBe('human');
    expect(actor.id).toBe('jdoe');
    expect(actor.name).toBeUndefined();
  });

  it('parses actor with name', () => {
    const actor = parseActor('ai-agent:agent-1:Claude');
    expect(actor.type).toBe('ai-agent');
    expect(actor.id).toBe('agent-1');
    expect(actor.name).toBe('Claude');
  });

  it('handles names containing colons', () => {
    const actor = parseActor('ai-agent:agent-1:Claude: Code Edition');
    expect(actor.name).toBe('Claude: Code Edition');
  });

  it('round-trips through serialize/parse', () => {
    const original: ActorIdentity = { type: 'ai-agent', id: 'agent-1', name: 'Claude' };
    const roundTripped = parseActor(serializeActor(original));
    expect(roundTripped).toEqual(original);
  });

  it('round-trips actor without name', () => {
    const original: ActorIdentity = { type: 'human', id: 'jdoe' };
    const roundTripped = parseActor(serializeActor(original));
    expect(roundTripped.type).toBe(original.type);
    expect(roundTripped.id).toBe(original.id);
  });

  it('throws on invalid format (no colon)', () => {
    expect(() => parseActor('invalid')).toThrow('Invalid actor format');
  });

  it('throws on invalid actor type', () => {
    expect(() => parseActor('admin:root')).toThrow('Invalid actor type');
  });
});
