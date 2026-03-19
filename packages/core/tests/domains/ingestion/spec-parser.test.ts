/**
 * Spec Parser tests — verifies markdown → ParsedSpec AST transformation.
 */

import { describe, it, expect } from 'vitest';
import { parseSpec } from '../../../src/domains/ingestion/spec-parser.js';

// Minimal spec artifact for reuse
const MINIMAL_SPEC = `# Test Project

> A test project description.

## Capability: Core
> size: M | risk: low

Core group description.

### COR-01: First Task
> effort: M | risk: low | type: feature | ai: full
> depends_on: -

Task body for COR-01.

**Success conditions:**
- Condition one
- Condition two
`;

// Full example spec (from spec-artifact-format.md)
const FULL_SPEC = `# Real-time Notification System

> Build a multi-channel notification system that delivers events to users
> via email and push notifications.

**Constraints:**
- Must integrate with existing user service
- Email through SendGrid only

**Non-goals:**
- In-app notification center
- Marketing campaigns

**Open questions:**
- Should we support batching?

---

## Capability: Notification Core
> size: L | risk: medium

The backbone of the notification system.

### NCO-01: Notification Event Schema
> effort: M | risk: low | type: feature | ai: full
> depends_on: -

Define the core NotificationEvent type that flows through the entire system.

**Success conditions:**
- NotificationEvent type covers all required fields
- Validator returns all errors

### NCO-02: Delivery Channel Interface
> effort: S | risk: low | type: feature | ai: full
> depends_on: NCO-01

Define the DeliveryChannel interface.

**Success conditions:**
- Interface defined with send, supports, and healthCheck methods

### NCO-03: Routing Engine
> effort: L | risk: medium | type: feature | ai: assisted
> depends_on: NCO-01, NCO-02

The routing engine is the central dispatcher.

**Success conditions:**
- Routes events to correct channels
- Handles 10k events/minute

---

## Capability: Email Channel
> size: M | risk: low

Email delivery channel implementation.

### EML-01: SendGrid Integration
> effort: M | risk: low | type: feature | ai: assisted
> depends_on: NCO-02

Implement the DeliveryChannel interface for email.

**Success conditions:**
- Implements DeliveryChannel interface fully
`;

describe('parseSpec', () => {
  describe('project header', () => {
    it('extracts project name', () => {
      const result = parseSpec(MINIMAL_SPEC);
      expect(result.project.name).toBe('Test Project');
    });

    it('extracts project description from blockquotes', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.project.description).toContain('multi-channel notification system');
      expect(result.project.description).toContain('push notifications');
    });

    it('extracts constraints', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.project.constraints).toHaveLength(2);
      expect(result.project.constraints[0]).toContain('existing user service');
    });

    it('extracts non-goals', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.project.nonGoals).toHaveLength(2);
      expect(result.project.nonGoals[0]).toContain('notification center');
    });

    it('extracts open questions', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.project.openQuestions).toHaveLength(1);
      expect(result.project.openQuestions[0]).toContain('batching');
    });
  });

  describe('groups', () => {
    it('parses groups with name and metadata', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0]!.name).toBe('Notification Core');
      expect(result.groups[0]!.size).toBe('L');
      expect(result.groups[0]!.risk).toBe('medium');
    });

    it('derives prefix from group name', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.groups[0]!.prefix).toBe('NC');
      expect(result.groups[1]!.prefix).toBe('EC');
    });

    it('parses group description', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.groups[0]!.description).toContain('backbone');
    });

    it('associates tasks with their parent group', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.groups[0]!.tasks).toHaveLength(3);
      expect(result.groups[1]!.tasks).toHaveLength(1);
    });
  });

  describe('tasks', () => {
    it('parses task ref and title', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[0]!;
      expect(task.ref).toBe('NCO-01');
      expect(task.title).toBe('Notification Event Schema');
    });

    it('parses task metadata', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[0]!;
      expect(task.effort).toBe('M');
      expect(task.risk).toBe('low');
      expect(task.taskType).toBe('feature');
      expect(task.aiSuitability).toBe('full');
    });

    it('parses depends_on: - as empty array', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[0]!;
      expect(task.dependsOn).toEqual([]);
    });

    it('parses depends_on with single ref', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[1]!;
      expect(task.dependsOn).toEqual(['NCO-01']);
    });

    it('parses depends_on with multiple refs', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[2]!;
      expect(task.dependsOn).toEqual(['NCO-01', 'NCO-02']);
    });

    it('extracts success conditions', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[0]!;
      expect(task.successConditions).toHaveLength(2);
      expect(task.successConditions[0]).toContain('NotificationEvent');
    });

    it('captures task body', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[0]!;
      expect(task.body).toContain('Define the core NotificationEvent');
    });

    it('sets groupName on grouped tasks', () => {
      const result = parseSpec(FULL_SPEC);
      const task = result.groups[0]!.tasks[0]!;
      expect(task.groupName).toBe('Notification Core');
    });
  });

  describe('orphan tasks', () => {
    it('captures tasks outside any group', () => {
      const spec = `# Test Project

> Description.

### ORP-01: Orphan Task
> effort: S | risk: low | type: feature | ai: full
> depends_on: -

Body of orphan task.

**Success conditions:**
- It works
`;
      const result = parseSpec(spec);
      expect(result.orphanTasks).toHaveLength(1);
      expect(result.orphanTasks[0]!.ref).toBe('ORP-01');
      expect(result.orphanTasks[0]!.groupName).toBeNull();
    });
  });

  describe('error detection', () => {
    it('detects duplicate task refs', () => {
      const spec = `# Test

> Desc.

## Capability: A
> size: S | risk: low

Desc.

### AAA-01: First
> effort: S | risk: low | type: feature | ai: full
> depends_on: -

Body.

### AAA-01: Duplicate
> effort: S | risk: low | type: feature | ai: full
> depends_on: -

Body.
`;
      const result = parseSpec(spec);
      const dupErrors = result.errors.filter(e => e.message.includes('Duplicate'));
      expect(dupErrors).toHaveLength(1);
      expect(dupErrors[0]!.severity).toBe('error');
    });

    it('warns on unknown metadata keys', () => {
      const spec = `# Test

> Desc.

### AAA-01: Task
> effort: S | risk: low | unknown_key: value
> depends_on: -

Body.
`;
      const result = parseSpec(spec);
      const warnings = result.errors.filter(e => e.message.includes('Unknown task metadata'));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.severity).toBe('warning');
    });

    it('warns on empty spec', () => {
      const result = parseSpec('# Empty Project\n\n> No tasks here.\n');
      const warnings = result.errors.filter(e => e.message.includes('no tasks'));
      expect(warnings).toHaveLength(1);
    });

    it('warns on group with no tasks', () => {
      const spec = `# Test

> Desc.

## Capability: Empty Group
> size: S | risk: low

This group has no tasks.
`;
      const result = parseSpec(spec);
      const warnings = result.errors.filter(e => e.message.includes('no tasks'));
      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('separators and formatting', () => {
    it('handles --- separators between groups', () => {
      const result = parseSpec(FULL_SPEC);
      // Should have 2 groups despite separators
      expect(result.groups).toHaveLength(2);
    });

    it('handles spec with no project sections', () => {
      const spec = `# Simple Project

> Just a description.

### SMP-01: Task
> effort: S | risk: low | type: feature | ai: full
> depends_on: -

Body.
`;
      const result = parseSpec(spec);
      expect(result.project.constraints).toHaveLength(0);
      expect(result.project.nonGoals).toHaveLength(0);
      expect(result.project.openQuestions).toHaveLength(0);
      expect(result.orphanTasks).toHaveLength(1);
    });

    it('handles multi-line project descriptions', () => {
      const result = parseSpec(FULL_SPEC);
      expect(result.project.description).toContain('multi-channel');
      expect(result.project.description).toContain('push notifications');
    });
  });

  describe('technical notes section', () => {
    it('includes technical notes in task body', () => {
      const spec = `# Test

> Desc.

### TST-01: Task
> effort: M | risk: low | type: feature | ai: full
> depends_on: -

Main body.

**Technical notes:**
Use Zod for validation.

**Success conditions:**
- It works
`;
      const result = parseSpec(spec);
      const task = result.orphanTasks[0]!;
      expect(task.body).toContain('Technical notes');
      expect(task.body).toContain('Zod');
    });
  });

  describe('edge cases', () => {
    it('handles empty string input', () => {
      const result = parseSpec('');
      expect(result.project.name).toBe('');
      expect(result.groups).toHaveLength(0);
      expect(result.orphanTasks).toHaveLength(0);
    });

    it('handles spec with only project header', () => {
      const result = parseSpec('# Just a Title\n\n> Description.\n');
      expect(result.project.name).toBe('Just a Title');
      expect(result.errors.some(e => e.message.includes('no tasks'))).toBe(true);
    });

    it('parses full example from spec-artifact-format', () => {
      const result = parseSpec(FULL_SPEC);
      // 2 groups, 4 total tasks
      expect(result.groups).toHaveLength(2);
      const totalTasks = result.groups.reduce((sum, g) => sum + g.tasks.length, 0);
      expect(totalTasks).toBe(4);
      expect(result.orphanTasks).toHaveLength(0);
      expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });
  });
});
