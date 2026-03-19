/**
 * Spec Mapper tests — verifies ParsedSpec → MappedSpec transformation
 * with correct value mapping, container detection, and topological sorting.
 */

import { describe, it, expect } from 'vitest';
import { mapSpec, findGroupingContainer, topologicalSort } from '../../../src/domains/ingestion/spec-mapper.js';
import { HYDRO_PROFILE } from '../../../src/profiles/hydro.js';
import { SCRUM_PROFILE } from '../../../src/profiles/scrum.js';
import { SHAPE_UP_PROFILE } from '../../../src/profiles/shape-up.js';
import type { ParsedSpec, MappedTask } from '../../../src/domains/ingestion/types.js';

function makeParsedSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    project: {
      name: 'Test Project',
      description: 'Test description',
      constraints: [],
      nonGoals: [],
      openQuestions: [],
    },
    groups: [{
      name: 'Core',
      prefix: 'COR',
      size: 'M',
      risk: 'low',
      description: 'Core group',
      tasks: [
        {
          ref: 'COR-01',
          title: 'First Task',
          body: 'Body of first task.',
          effort: 'M',
          risk: 'low',
          taskType: 'feature',
          aiSuitability: 'full',
          dependsOn: [],
          successConditions: ['Works'],
          groupName: 'Core',
        },
        {
          ref: 'COR-02',
          title: 'Second Task',
          body: 'Body of second task.',
          effort: 'S',
          risk: 'high',
          taskType: 'feature',
          aiSuitability: 'assisted',
          dependsOn: ['COR-01'],
          successConditions: ['Also works'],
          groupName: 'Core',
        },
      ],
    }],
    orphanTasks: [],
    errors: [],
    ...overrides,
  };
}

describe('findGroupingContainer', () => {
  it('finds epic in Hydro profile', () => {
    const container = findGroupingContainer(HYDRO_PROFILE);
    expect(container).not.toBeNull();
    expect(container!.id).toBe('epic');
  });

  it('finds bet in Shape Up profile', () => {
    const container = findGroupingContainer(SHAPE_UP_PROFILE);
    expect(container).not.toBeNull();
    expect(container!.id).toBe('bet');
  });

  it('returns epic for Scrum profile', () => {
    const container = findGroupingContainer(SCRUM_PROFILE);
    expect(container).not.toBeNull();
    expect(container!.id).toBe('epic');
  });
});

describe('topologicalSort', () => {
  it('sorts tasks with dependencies in correct order', () => {
    const tasks: MappedTask[] = [
      { ref: 'B', groupRef: null, dependsOn: ['A'], request: { title: 'B', body: '', initialStatus: '', containers: {} } },
      { ref: 'A', groupRef: null, dependsOn: [], request: { title: 'A', body: '', initialStatus: '', containers: {} } },
    ];
    const result = topologicalSort(tasks);
    expect(Array.isArray(result)).toBe(true);
    const sorted = result as MappedTask[];
    expect(sorted[0]!.ref).toBe('A');
    expect(sorted[1]!.ref).toBe('B');
  });

  it('detects circular dependencies', () => {
    const tasks: MappedTask[] = [
      { ref: 'A', groupRef: null, dependsOn: ['B'], request: { title: 'A', body: '', initialStatus: '', containers: {} } },
      { ref: 'B', groupRef: null, dependsOn: ['A'], request: { title: 'B', body: '', initialStatus: '', containers: {} } },
    ];
    const result = topologicalSort(tasks);
    expect(Array.isArray(result)).toBe(false);
    expect((result as { cycle: string[] }).cycle).toContain('A');
    expect((result as { cycle: string[] }).cycle).toContain('B');
  });

  it('handles tasks with no dependencies', () => {
    const tasks: MappedTask[] = [
      { ref: 'A', groupRef: null, dependsOn: [], request: { title: 'A', body: '', initialStatus: '', containers: {} } },
      { ref: 'B', groupRef: null, dependsOn: [], request: { title: 'B', body: '', initialStatus: '', containers: {} } },
    ];
    const result = topologicalSort(tasks);
    expect(Array.isArray(result)).toBe(true);
    expect((result as MappedTask[]).length).toBe(2);
  });

  it('handles diamond dependencies', () => {
    const tasks: MappedTask[] = [
      { ref: 'A', groupRef: null, dependsOn: [], request: { title: 'A', body: '', initialStatus: '', containers: {} } },
      { ref: 'B', groupRef: null, dependsOn: ['A'], request: { title: 'B', body: '', initialStatus: '', containers: {} } },
      { ref: 'C', groupRef: null, dependsOn: ['A'], request: { title: 'C', body: '', initialStatus: '', containers: {} } },
      { ref: 'D', groupRef: null, dependsOn: ['B', 'C'], request: { title: 'D', body: '', initialStatus: '', containers: {} } },
    ];
    const result = topologicalSort(tasks);
    expect(Array.isArray(result)).toBe(true);
    const sorted = result as MappedTask[];
    const indexOf = (ref: string) => sorted.findIndex(t => t.ref === ref);
    expect(indexOf('A')).toBeLessThan(indexOf('B'));
    expect(indexOf('A')).toBeLessThan(indexOf('C'));
    expect(indexOf('B')).toBeLessThan(indexOf('D'));
    expect(indexOf('C')).toBeLessThan(indexOf('D'));
  });
});

describe('mapSpec', () => {
  describe('value mapping', () => {
    it('maps effort values correctly', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.effort).toBe('Medium');
      expect(result.tasks[1]!.request.effort).toBe('Small');
    });

    it('maps risk values correctly', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.riskLevel).toBe('Low');
      expect(result.tasks[1]!.request.riskLevel).toBe('High');
    });

    it('maps ai suitability correctly', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.aiSuitability).toBe('AI_ONLY');
      expect(result.tasks[1]!.request.aiSuitability).toBe('AI_REVIEWED');
    });

    it('maps task type correctly', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.taskType).toBe('FEATURE');
    });

    it('maps XL effort to Large', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [{
            ref: 'G-01', title: 'T', body: '', effort: 'XL',
            dependsOn: [], successConditions: [], groupName: 'G',
          }],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.effort).toBe('Large');
    });

    it('maps critical risk to High with warning', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [{
            ref: 'G-01', title: 'T', body: '', risk: 'critical',
            dependsOn: [], successConditions: [], groupName: 'G',
          }],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.riskLevel).toBe('High');
      expect(result.warnings.some(w => w.includes('critical risk'))).toBe(true);
    });

    it('maps pair ai to HYBRID', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [{
            ref: 'G-01', title: 'T', body: '', aiSuitability: 'pair',
            dependsOn: [], successConditions: [], groupName: 'G',
          }],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.aiSuitability).toBe('HYBRID');
    });

    it('maps human ai to HUMAN_ONLY', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [{
            ref: 'G-01', title: 'T', body: '', aiSuitability: 'human',
            dependsOn: [], successConditions: [], groupName: 'G',
          }],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.aiSuitability).toBe('HUMAN_ONLY');
    });
  });

  describe('initial status', () => {
    it('uses BACKLOG for Hydro', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.tasks[0]!.request.initialStatus).toBe('BACKLOG');
    });

    it('uses BACKLOG for Scrum', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, SCRUM_PROFILE);
      expect(result.tasks[0]!.request.initialStatus).toBe('BACKLOG');
    });

    it('uses RAW for Shape Up', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, SHAPE_UP_PROFILE);
      expect(result.tasks[0]!.request.initialStatus).toBe('RAW');
    });
  });

  describe('group mapping', () => {
    it('creates group issues for non-empty groups', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.groupIssues).toHaveLength(1);
      expect(result.groupIssues[0]!.title).toBe('Core');
    });

    it('sets containerTypeId to epic for Hydro', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.groupIssues[0]!.containerTypeId).toBe('epic');
    });

    it('sets containerTypeId to bet for Shape Up', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, SHAPE_UP_PROFILE);
      expect(result.groupIssues[0]!.containerTypeId).toBe('bet');
    });

    it('sets containerTypeId to epic for Scrum', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, SCRUM_PROFILE);
      expect(result.groupIssues[0]!.containerTypeId).toBe('epic');
    });

    it('skips empty groups', () => {
      const parsed = makeParsedSpec({
        groups: [
          { name: 'Empty', prefix: 'E', description: '', tasks: [] },
          {
            name: 'Full', prefix: 'F', description: '', tasks: [{
              ref: 'F-01', title: 'T', body: '', dependsOn: [], successConditions: [], groupName: 'Full',
            }],
          },
        ],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.groupIssues).toHaveLength(1);
      expect(result.groupIssues[0]!.title).toBe('Full');
    });
  });

  describe('dependency validation', () => {
    it('reports missing dependency refs', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [{
            ref: 'G-01', title: 'T', body: '', dependsOn: ['MISSING-01'],
            successConditions: [], groupName: 'G',
          }],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toContain('MISSING-01');
    });

    it('detects circular dependencies', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [
            { ref: 'G-01', title: 'A', body: '', dependsOn: ['G-02'], successConditions: [], groupName: 'G' },
            { ref: 'G-02', title: 'B', body: '', dependsOn: ['G-01'], successConditions: [], groupName: 'G' },
          ],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.errors.some(e => e.message.includes('Circular'))).toBe(true);
    });
  });

  describe('topological ordering', () => {
    it('sorts tasks so dependencies come first', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      const refs = result.tasks.map(t => t.ref);
      expect(refs.indexOf('COR-01')).toBeLessThan(refs.indexOf('COR-02'));
    });
  });

  describe('dependencies field', () => {
    it('sets dependencies as comma-separated refs', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      const task2 = result.tasks.find(t => t.ref === 'COR-02');
      expect(task2!.request.dependencies).toBe('COR-01');
    });

    it('omits dependencies for tasks with none', () => {
      const parsed = makeParsedSpec();
      const result = mapSpec(parsed, HYDRO_PROFILE);
      const task1 = result.tasks.find(t => t.ref === 'COR-01');
      expect(task1!.request.dependencies).toBeUndefined();
    });
  });

  describe('unknown values', () => {
    it('warns on unknown effort value', () => {
      const parsed = makeParsedSpec({
        groups: [{
          name: 'G', prefix: 'G', description: '', tasks: [{
            ref: 'G-01', title: 'T', body: '', effort: 'XXL',
            dependsOn: [], successConditions: [], groupName: 'G',
          }],
        }],
      });
      const result = mapSpec(parsed, HYDRO_PROFILE);
      expect(result.warnings.some(w => w.includes('unknown effort'))).toBe(true);
      expect(result.tasks[0]!.request.effort).toBeUndefined();
    });
  });
});
