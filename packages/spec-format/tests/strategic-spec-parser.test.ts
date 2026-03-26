import { describe, it, expect } from 'vitest';
import { parseStrategicSpec } from '../src/strategic-spec-parser.js';

const MINIMAL_SPEC = `# Test Project
> format: strategic-spec | version: 1.0

> A simple test project.

## Group: Core
> priority: must-have

Core functionality.

### COR-01: First Capability
> priority: must-have | risk: low
> depends_on: -

This is the first capability description with enough content to be meaningful.

**Success conditions:**
- First condition
- Second condition
`;

const FULL_SPEC = `# Real-time Notification System
> format: strategic-spec | version: 1.0

> Our mobile app has grown to 50K active users but has no systematic way
> to reach them about things that matter.

**Stakeholders:**
- Sarah (Product Manager): Shaped problem understanding, user pain points, priority decisions
- Marcus (Technical Architect): Defined throughput requirements, channel integration constraints
- Aisha (UX Designer): Defined preference model, quiet hours concept

**Constraints:**
- Must integrate with existing user service
- Email delivery through SendGrid only

**Non-goals:**
- In-app notification center
- Marketing/bulk email campaigns

**Open questions:**
- Should we support notification batching in v1?

---

## Cross-Cutting Concerns

### Performance
Throughput target: 10,000 notification events per minute at peak.

### Security
Email suppression list is legally required (CAN-SPAM).
Push notification device tokens are user-linked PII.

---

## Group: Notification Core
> priority: must-have

Backbone of the notification system — event intake, routing logic, and delivery pipeline.

### NCO-01: Notification Event Model
> priority: must-have | risk: low
> depends_on: -

Define the core data structure flowing through the entire system. Must handle different event types while being extensible.

Per Marcus: needs idempotency key. Per Aisha: needs priority signal for quiet hours.

**Success conditions:**
- Covers all required fields: event type, recipient, payload, priority, timestamp, idempotency key
- Supports at least 3 event types at launch
- Extensible without changes to routing layer

### NCO-02: Channel Abstraction
> priority: must-have | risk: low
> depends_on: NCO-01

Define how delivery channels plug into the system. Clean contract for email, push, and future channels.

**Success conditions:**
- Channel contract implemented without leaking platform specifics
- Adding new channel requires only implementing contract

### NCO-03: Routing & Dispatch
> priority: must-have | risk: medium
> depends_on: NCO-01, NCO-02

Central dispatcher — receives event, determines channels, dispatches. Highest throughput component.

**Success conditions:**
- Routes to correct channels based on user preferences
- Handles 10K events/minute under sustained load
- Dispatch is non-blocking

---

## Group: Email Channel
> priority: must-have

SendGrid integration, template rendering, bounce handling.

### EML-01: SendGrid Delivery
> priority: must-have | risk: low
> depends_on: NCO-02

Implement email delivery through SendGrid API.

**Success conditions:**
- Sends email via SendGrid API with proper authentication
- Maps error codes correctly

### EML-02: Email Templates
> priority: must-have | risk: low
> depends_on: NCO-01

Render notification events into email content.

**Success conditions:**
- Each event type maps to email template
- Templates updateable without code deployment

---

## Group: Preferences
> priority: should-have

User notification preferences — which channels for which events.

### PRF-01: Preference Management
> priority: must-have | risk: low
> depends_on: NCO-01

API for users to manage notification preferences per event type, per channel.

**Success conditions:**
- Users can set preferences per event type, per channel
- Default preferences enable all channels
`;

describe('Strategic Spec Parser', () => {
  describe('project header', () => {
    it('extracts project name', () => {
      const result = parseStrategicSpec(MINIMAL_SPEC);
      expect(result.project.name).toBe('Test Project');
    });

    it('extracts format and version', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.project.format).toBe('strategic-spec');
      expect(result.project.version).toBe('1.0');
    });

    it('extracts multi-line description from blockquotes', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.project.description).toContain('50K active users');
      expect(result.project.description).toContain('things that matter');
    });

    it('extracts stakeholders', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.project.stakeholders).toHaveLength(3);
      expect(result.project.stakeholders[0]!.name).toBe('Sarah (Product Manager)');
      expect(result.project.stakeholders[0]!.perspective).toContain('problem understanding');
      expect(result.project.stakeholders[2]!.name).toBe('Aisha (UX Designer)');
    });

    it('extracts constraints', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.project.constraints).toHaveLength(2);
      expect(result.project.constraints[0]).toContain('existing user service');
    });

    it('extracts non-goals', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.project.nonGoals).toHaveLength(2);
      expect(result.project.nonGoals[0]).toContain('notification center');
    });

    it('extracts open questions', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.project.openQuestions).toHaveLength(1);
      expect(result.project.openQuestions[0]).toContain('batching');
    });
  });

  describe('cross-cutting concerns', () => {
    it('extracts concern sections', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.crossCuttingConcerns).toHaveLength(2);
    });

    it('extracts concern names', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.crossCuttingConcerns[0]!.name).toBe('Performance');
      expect(result.crossCuttingConcerns[1]!.name).toBe('Security');
    });

    it('preserves concern content as prose', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.crossCuttingConcerns[0]!.content).toContain('10,000 notification events');
      expect(result.crossCuttingConcerns[1]!.content).toContain('CAN-SPAM');
      expect(result.crossCuttingConcerns[1]!.content).toContain('device tokens');
    });
  });

  describe('groups', () => {
    it('extracts groups', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.groups).toHaveLength(3);
      expect(result.groups[0]!.name).toBe('Notification Core');
      expect(result.groups[1]!.name).toBe('Email Channel');
      expect(result.groups[2]!.name).toBe('Preferences');
    });

    it('extracts group priority', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.groups[0]!.priority).toBe('must-have');
      expect(result.groups[2]!.priority).toBe('should-have');
    });

    it('derives prefix from group name', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.groups[0]!.prefix).toBe('NC');
      expect(result.groups[1]!.prefix).toBe('EC');
      expect(result.groups[2]!.prefix).toBe('PRE');
    });

    it('extracts group description', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.groups[0]!.description).toContain('Backbone');
    });
  });

  describe('capabilities', () => {
    it('extracts capabilities within groups', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.groups[0]!.capabilities).toHaveLength(3);
      expect(result.groups[1]!.capabilities).toHaveLength(2);
      expect(result.groups[2]!.capabilities).toHaveLength(1);
    });

    it('extracts capability ref and title', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      expect(nco01.ref).toBe('NCO-01');
      expect(nco01.title).toBe('Notification Event Model');
    });

    it('extracts capability priority', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      expect(nco01.priority).toBe('must-have');
    });

    it('extracts capability risk', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      const nco03 = result.groups[0]!.capabilities[2]!;
      expect(nco01.risk).toBe('low');
      expect(nco03.risk).toBe('medium');
    });

    it('extracts depends_on as empty array for "-"', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      expect(nco01.dependsOn).toEqual([]);
    });

    it('extracts single dependency', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco02 = result.groups[0]!.capabilities[1]!;
      expect(nco02.dependsOn).toEqual(['NCO-01']);
    });

    it('extracts multiple dependencies', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco03 = result.groups[0]!.capabilities[2]!;
      expect(nco03.dependsOn).toEqual(['NCO-01', 'NCO-02']);
    });

    it('extracts cross-group dependencies', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const eml01 = result.groups[1]!.capabilities[0]!;
      expect(eml01.dependsOn).toEqual(['NCO-02']);
    });

    it('extracts capability body prose', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      expect(nco01.body).toContain('core data structure');
      expect(nco01.body).toContain('Per Marcus');
      expect(nco01.body).toContain('Per Aisha');
    });

    it('extracts success conditions', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      expect(nco01.successConditions).toHaveLength(3);
      expect(nco01.successConditions[0]).toContain('event type, recipient');
    });

    it('tracks group name on capabilities', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      const eml01 = result.groups[1]!.capabilities[0]!;
      expect(nco01.groupName).toBe('Notification Core');
      expect(eml01.groupName).toBe('Email Channel');
    });
  });

  describe('validation', () => {
    it('errors on missing format marker', () => {
      const spec = `# Test\n\n## Group: Core\n> priority: must-have\n\n### COR-01: Task\n> priority: must-have | risk: low\n\nDescription.\n\n**Success conditions:**\n- Done`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('format marker'))).toBe(true);
    });

    it('errors on duplicate capability refs', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Core\n> priority: must-have\n\n### COR-01: First\n> priority: must-have | risk: low\n\nDesc.\n\n### COR-01: Duplicate\n> priority: must-have | risk: low\n\nDesc.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
    });

    it('errors on invalid dependency references', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Core\n> priority: must-have\n\n### COR-01: First\n> priority: must-have | risk: low\n> depends_on: NONEXISTENT-99\n\nDescription.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('does not exist'))).toBe(true);
    });

    it('detects circular dependencies', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Core\n> priority: must-have\n\n### COR-01: A\n> priority: must-have | risk: low\n> depends_on: COR-02\n\nDesc.\n\n### COR-02: B\n> priority: must-have | risk: low\n> depends_on: COR-01\n\nDesc.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('Circular'))).toBe(true);
    });

    it('warns on invalid priority values', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Core\n> priority: critical\n\n### COR-01: Task\n> priority: must-have | risk: low\n\nDesc.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('invalid priority'))).toBe(true);
    });

    it('warns on invalid risk values', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Core\n> priority: must-have\n\n### COR-01: Task\n> priority: must-have | risk: critical\n\nDesc.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('invalid risk'))).toBe(true);
    });

    it('warns on unknown metadata keys', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Core\n> priority: must-have\n\n### COR-01: Task\n> priority: must-have | risk: low | effort: M\n\nDesc.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('Unknown capability metadata key: effort'))).toBe(true);
    });

    it('warns on empty spec', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('no capabilities'))).toBe(true);
    });

    it('warns on group with no capabilities', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n## Group: Empty\n> priority: must-have\n\nJust a description.`;
      const result = parseStrategicSpec(spec);
      expect(result.errors.some(e => e.message.includes('no capabilities'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = parseStrategicSpec('');
      expect(result.project.name).toBe('');
      expect(result.groups).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles spec with only project header', () => {
      const result = parseStrategicSpec('# Just a Title\n> format: strategic-spec | version: 1.0');
      expect(result.project.name).toBe('Just a Title');
      expect(result.groups).toHaveLength(0);
    });

    it('captures orphan capabilities outside groups', () => {
      const spec = `# Test\n> format: strategic-spec | version: 1.0\n\n### ORP-01: Orphan\n> priority: must-have | risk: low\n\nOrphan capability.`;
      const result = parseStrategicSpec(spec);
      expect(result.orphanCapabilities).toHaveLength(1);
      expect(result.orphanCapabilities[0]!.ref).toBe('ORP-01');
      expect(result.orphanCapabilities[0]!.groupName).toBeNull();
    });

    it('produces no errors for valid minimal spec', () => {
      const result = parseStrategicSpec(MINIMAL_SPEC);
      const realErrors = result.errors.filter(e => e.severity === 'error');
      expect(realErrors).toHaveLength(0);
    });

    it('produces no errors for valid full spec', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const realErrors = result.errors.filter(e => e.severity === 'error');
      expect(realErrors).toHaveLength(0);
    });

    it('handles cross-cutting concerns before groups', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      expect(result.crossCuttingConcerns.length).toBeGreaterThan(0);
      expect(result.groups.length).toBeGreaterThan(0);
    });

    it('preserves capability body without success conditions section', () => {
      const result = parseStrategicSpec(FULL_SPEC);
      const nco01 = result.groups[0]!.capabilities[0]!;
      // Body should NOT contain "Success conditions:" header or the conditions themselves
      expect(nco01.body).not.toContain('**Success conditions:**');
    });
  });
});
