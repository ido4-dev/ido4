import { describe, it, expect } from 'vitest';
import { ProfileRegistry } from '../../src/profiles/registry.js';
import { SCRUM_PROFILE } from '../../src/profiles/scrum.js';
import { HYDRO_PROFILE } from '../../src/profiles/hydro.js';
import type { MethodologyProfileFile } from '../../src/profiles/types.js';

describe('ProfileRegistry.resolve — inheritance', () => {
  it('resolves a profile extending scrum', () => {
    const file: MethodologyProfileFile = {
      extends: 'scrum',
      id: 'acme-scrum',
      name: 'ACME Scrum',
    };
    const resolved = ProfileRegistry.resolve(file);
    expect(resolved.id).toBe('acme-scrum');
    expect(resolved.name).toBe('ACME Scrum');
    // Inherits everything else from scrum
    expect(resolved.states).toEqual(SCRUM_PROFILE.states);
    expect(resolved.transitions).toEqual(SCRUM_PROFILE.transitions);
    expect(resolved.containers).toEqual(SCRUM_PROFILE.containers);
  });

  it('override states replaces base states wholesale', () => {
    const customStates = [
      { key: 'TODO', name: 'To Do', category: 'todo' as const },
      { key: 'DOING', name: 'Doing', category: 'active' as const },
      { key: 'DONE', name: 'Done', category: 'done' as const },
    ];
    const file: MethodologyProfileFile = {
      extends: 'hydro',
      id: 'minimal',
      states: customStates,
      semantics: {
        initialState: 'TODO',
        terminalStates: ['DONE'],
        blockedStates: [],
        activeStates: ['DOING'],
        readyStates: [],
        reviewStates: [],
      },
      // Need valid transitions referencing the new states
      transitions: [
        { action: 'start', from: ['TODO'], to: 'DOING', label: 'Start' },
        { action: 'approve', from: ['DOING'], to: 'DONE', label: 'Done' },
      ],
      // Need compliance lifecycle to match
      compliance: {
        lifecycle: ['start', 'approve'],
        weights: HYDRO_PROFILE.compliance.weights,
      },
    };
    const resolved = ProfileRegistry.resolve(file);
    expect(resolved.states).toEqual(customStates);
    expect(resolved.states).not.toEqual(HYDRO_PROFILE.states);
  });

  it('override semantics shallow-merges with base', () => {
    const file: MethodologyProfileFile = {
      extends: 'scrum',
      id: 'custom-scrum',
      semantics: { readyStates: ['SPRINT', 'BACKLOG'] },
    };
    const resolved = ProfileRegistry.resolve(file);
    // readyStates overridden
    expect(resolved.semantics.readyStates).toEqual(['SPRINT', 'BACKLOG']);
    // Other semantic fields inherited
    expect(resolved.semantics.initialState).toBe(SCRUM_PROFILE.semantics.initialState);
    expect(resolved.semantics.terminalStates).toEqual(SCRUM_PROFILE.semantics.terminalStates);
  });

  it('override pipelines merges with base (adds new, replaces existing)', () => {
    const file: MethodologyProfileFile = {
      extends: 'scrum',
      id: 'custom-scrum',
      pipelines: {
        // Override existing
        plan: { steps: ['StatusTransitionValidation:SPRINT'] },
        // Add new type-scoped
        'review:bug': { steps: ['StatusTransitionValidation:IN_REVIEW'] },
      },
    };
    const resolved = ProfileRegistry.resolve(file);
    // Overridden pipeline
    expect(resolved.pipelines['plan'].steps).toEqual(['StatusTransitionValidation:SPRINT']);
    // New pipeline added
    expect(resolved.pipelines['review:bug']).toBeDefined();
    // Existing pipelines preserved
    expect(resolved.pipelines['start']).toEqual(SCRUM_PROFILE.pipelines['start']);
    expect(resolved.pipelines['plan:story']).toEqual(SCRUM_PROFILE.pipelines['plan:story']);
  });

  it('throws for missing required fields without extends', () => {
    const file: MethodologyProfileFile = {
      id: 'incomplete',
      name: 'Incomplete',
    };
    expect(() => ProfileRegistry.resolve(file)).toThrow('must provide all required fields');
  });

  it('throws for invalid extends target', () => {
    const file: MethodologyProfileFile = {
      extends: 'nonexistent',
      id: 'bad-extend',
    };
    expect(() => ProfileRegistry.resolve(file)).toThrow('Unknown methodology profile: "nonexistent"');
  });

  it('resolves a complete custom profile without extends', () => {
    const file: MethodologyProfileFile = {
      id: 'kanban',
      name: 'Kanban',
      version: '1.0',
      description: 'Simple Kanban',
      states: [
        { key: 'TODO', name: 'To Do', category: 'todo' },
        { key: 'WIP', name: 'Work In Progress', category: 'active' },
        { key: 'DONE', name: 'Done', category: 'done' },
      ],
      transitions: [
        { action: 'start', from: ['TODO'], to: 'WIP', label: 'Start' },
        { action: 'finish', from: ['WIP'], to: 'DONE', label: 'Finish' },
      ],
      semantics: {
        initialState: 'TODO',
        terminalStates: ['DONE'],
        blockedStates: [],
        activeStates: ['WIP'],
        readyStates: [],
        reviewStates: [],
      },
      containers: [
        { id: 'board', singular: 'Board', plural: 'Boards', taskField: 'Board', managed: true },
      ],
      integrityRules: [],
      principles: [],
      workItems: {
        primary: { singular: 'Card', plural: 'Cards' },
        typeSource: { method: 'label', identifier: 'type:' },
        defaultType: 'card',
        types: [{ id: 'card', name: 'Card', standardLifecycle: true }],
      },
      pipelines: {
        start: { steps: ['StatusTransitionValidation:WIP'] },
        finish: { steps: ['StatusTransitionValidation:DONE'] },
      },
      compliance: {
        lifecycle: ['start', 'finish'],
        weights: { brePassRate: 0.50, flowEfficiency: 0.50 },
      },
      behaviors: {
        closingTransitions: ['finish'],
      },
    };
    const resolved = ProfileRegistry.resolve(file);
    expect(resolved.id).toBe('kanban');
    expect(resolved.states).toHaveLength(3);
    expect(resolved.workItems.primary.singular).toBe('Card');
  });
});
