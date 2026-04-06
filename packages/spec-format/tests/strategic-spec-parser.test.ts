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

  // ─── Plain-text description (matches ido4shape documented format) ───

  describe('plain-text description', () => {
    it('extracts single-paragraph plain-text description', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Our app has grown to 50K active users but has no way to reach them about things that matter.

**Stakeholders:**
- Sarah (PM): Shaped problem understanding

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low
> depends_on: -

Description.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('50K active users');
      expect(result.project.description).toContain('things that matter');
    });

    it('extracts multi-paragraph plain-text description', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

First paragraph about the problem space.

Second paragraph about why solving it now matters.

Third paragraph with stakeholder context.

**Stakeholders:**
- Sarah (PM): Problem understanding

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Description.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('First paragraph');
      expect(result.project.description).toContain('Second paragraph');
      expect(result.project.description).toContain('Third paragraph');
    });

    it('handles mixed blockquote and plain-text description', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

> Blockquote part of the description.

Plain text continuation of the description.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Description.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('Blockquote part');
      expect(result.project.description).toContain('Plain text continuation');
    });

    it('does not capture text after section headers as description', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

The actual description.

**Stakeholders:**
- Sarah (PM): Context

This should NOT be part of the description.

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Description.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toBe('The actual description.');
      expect(result.project.description).not.toContain('should NOT');
    });

    it('returns empty description when no text before first section header', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Description.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toBe('');
    });

    it('preserves inline markdown formatting in plain-text description', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Our app has **50K active users** but _no systematic way_ to reach them.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Description.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('**50K active users**');
      expect(result.project.description).toContain('_no systematic way_');
    });

    it('terminates description on separator before groups', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Description text here.

---

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toBe('Description text here.');
    });

    it('still extracts all project sections with plain-text description', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Plain text description of the problem.

**Stakeholders:**
- Sarah (PM): Problem understanding
- Marcus (Architect): Technical constraints

**Constraints:**
- Must use existing auth
- No new infrastructure

**Non-goals:**
- Mobile app
- Analytics

**Open questions:**
- Should we batch?
- Timeline for v2?

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toBe('Plain text description of the problem.');
      expect(result.project.stakeholders).toHaveLength(2);
      expect(result.project.constraints).toHaveLength(2);
      expect(result.project.nonGoals).toHaveLength(2);
      expect(result.project.openQuestions).toHaveLength(2);
    });

    it('handles the ido4shape example format (plain text, rich narrative)', () => {
      // This matches the format taught in ido4shape's references/strategic-spec-format.md
      // and demonstrated in references/example-strategic-notification-system.md
      const spec = `# Real-time Notification System
> format: strategic-spec | version: 1.0

Our mobile app has grown to 50K active users but has no systematic way to reach them about things that matter — order confirmations, password resets, mentions from teammates. Users currently find out about events by manually checking the app, which means time-sensitive information goes unseen for hours.

We need a multi-channel notification system that delivers the right events to the right users through the right channels. Users must have control — not everyone wants push notifications at 2am.

**Stakeholders:**
- Sarah (Product Manager): Shaped problem understanding, user pain points, priority decisions
- Marcus (Technical Architect): Defined throughput requirements, channel integration constraints

**Constraints:**
- Must integrate with existing user service
- Email delivery through SendGrid only

**Non-goals:**
- In-app notification center

**Open questions:**
- Should we support notification batching in v1?

---

## Group: Notification Core
> priority: must-have

Backbone of the notification system.

### NCO-01: Notification Event Model
> priority: must-have | risk: low
> depends_on: -

Define the core data structure.

**Success conditions:**
- Covers all required fields
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('50K active users');
      expect(result.project.description).toContain('multi-channel notification system');
      expect(result.project.description).toContain('Users must have control');
      expect(result.project.stakeholders).toHaveLength(2);
      expect(result.project.constraints).toHaveLength(2);
      expect(result.project.nonGoals).toHaveLength(1);
      expect(result.project.openQuestions).toHaveLength(1);
      expect(result.groups).toHaveLength(1);
      expect(result.groups[0]!.capabilities).toHaveLength(1);
      const errors = result.errors.filter(e => e.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  // ─── Numbered list items (robustness against synthesizer variation) ───

  describe('numbered and alternative list markers', () => {
    it('extracts numbered stakeholders', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Stakeholders:**
1. Sarah (PM): Problem understanding
2. Marcus (Architect): Technical constraints
3. Aisha (UX): User experience

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.stakeholders).toHaveLength(3);
      expect(result.project.stakeholders[0]!.name).toBe('Sarah (PM)');
      expect(result.project.stakeholders[2]!.name).toBe('Aisha (UX)');
    });

    it('extracts numbered constraints', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Stakeholders:**
- Sarah (PM): Context

**Constraints:**
1. Must use existing auth
2. No new infrastructure

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.constraints).toHaveLength(2);
      expect(result.project.constraints[0]).toContain('existing auth');
    });

    it('extracts numbered open questions', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Stakeholders:**
- Sarah (PM): Context

**Open questions:**
1. Should we support batching?
2. What about retry policy?

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.openQuestions).toHaveLength(2);
      expect(result.project.openQuestions[0]).toContain('batching');
    });

    it('extracts numbered non-goals', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Stakeholders:**
- Sarah (PM): Context

**Non-goals:**
1. Mobile app
2. Analytics dashboard

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.nonGoals).toHaveLength(2);
      expect(result.project.nonGoals[0]).toContain('Mobile app');
    });

    it('extracts numbered success conditions', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Description of the capability.

**Success conditions:**
1. First verifiable condition
2. Second verifiable condition
3. Third verifiable condition
`;
      const result = parseStrategicSpec(spec);
      const cap = result.groups[0]!.capabilities[0]!;
      expect(cap.successConditions).toHaveLength(3);
      expect(cap.successConditions[0]).toContain('First verifiable');
    });

    it('handles mixed dash and numbered items in same section', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Stakeholders:**
- Sarah (PM): Problem understanding
1. Marcus (Architect): Technical constraints
- Aisha (UX): User experience

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.stakeholders).toHaveLength(3);
    });

    it('handles asterisk bullet markers', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Stakeholders:**
* Sarah (PM): Problem understanding
* Marcus (Architect): Technical constraints

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
* First condition
* Second condition
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.stakeholders).toHaveLength(2);
      const cap = result.groups[0]!.capabilities[0]!;
      expect(cap.successConditions).toHaveLength(2);
    });

    it('handles plus bullet markers', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Constraints:**
+ Must use existing auth
+ No new infrastructure

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
+ Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.constraints).toHaveLength(2);
    });

    it('handles double-digit numbered items', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

Description.

**Constraints:**
1. First
2. Second
10. Tenth
11. Eleventh

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.constraints).toHaveLength(4);
    });

    it('does not match numbered items without space after dot', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

**Constraints:**
1.No space here
2. Proper item

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      // "1.No space here" should NOT be captured as a bullet item
      expect(result.project.constraints).toHaveLength(1);
      expect(result.project.constraints[0]).toContain('Proper item');
    });

    it('numbered success conditions do not leak into body', () => {
      const spec = `# Test
> format: strategic-spec | version: 1.0

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Capability description here.

**Success conditions:**
1. First verifiable condition
2. Second verifiable condition
`;
      const result = parseStrategicSpec(spec);
      const cap = result.groups[0]!.capabilities[0]!;
      expect(cap.body).toContain('Capability description');
      expect(cap.body).not.toContain('First verifiable');
      expect(cap.body).not.toContain('**Success conditions:**');
      expect(cap.successConditions).toHaveLength(2);
    });
  });

  // ─── Description edge cases (boundary contract) ───

  describe('description edge cases', () => {
    it('captures plain text immediately after format line (no blank line)', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0
Description starts immediately after format marker.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('Description starts immediately');
    });

    it('captures description when no project sections exist (runs until first group)', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Description that runs until the first group heading because there are no stakeholder or constraint sections.

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('Description that runs until');
      expect(result.project.stakeholders).toHaveLength(0);
      expect(result.project.constraints).toHaveLength(0);
    });

    it('accumulates unrecognized H2 in description area as content (synthesizer drift)', () => {
      // When synthesizer drifts to `## Problem Statement`, the H2 is not recognized
      // by GROUP_HEADING or CROSS_CUTTING_HEADING. It falls through to description
      // accumulation. This is better than silently losing the content.
      const spec = `# My Project
> format: strategic-spec | version: 1.0

## Problem Statement

The actual problem description lives under this heading.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      // Both the H2 text and the content below are captured as description
      expect(result.project.description).toContain('Problem Statement');
      expect(result.project.description).toContain('actual problem description');
      // Downstream still works — stakeholders captured normally
      expect(result.project.stakeholders).toHaveLength(1);
    });

    it('does not treat inline bold with trailing text as section header', () => {
      // **Note:** followed by text on the same line does NOT match SECTION_HEADER
      // (which requires the line to END with **). This should be description content.
      const spec = `# My Project
> format: strategic-spec | version: 1.0

**Important note:** this project addresses a critical gap in our platform.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('Important note');
      expect(result.project.description).toContain('critical gap');
      expect(result.project.stakeholders).toHaveLength(1);
    });

    it('handles empty blockquote line in description area', () => {
      const spec = `# My Project
> format: strategic-spec | version: 1.0

> First line of description.
>
> Second line after empty blockquote.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('First line');
      expect(result.project.description).toContain('Second line');
    });

    it('does not accumulate text after separator as description', () => {
      // Separator (---) is handled before description logic in the loop.
      // After separator, state is still PROJECT but any new plain text
      // would be in a post-separator zone. Currently, if projectDescriptionDone
      // is still false, text after separator DOES accumulate as description.
      // This test documents that behavior.
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Description before separator.

---

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toBe('Description before separator.');
    });

    it('stops description at standalone bold-label even if unrecognized', () => {
      // A bold-label like **Note:** (no trailing text, matches SECTION_HEADER)
      // terminates description even if "Note" is not a recognized section name.
      const spec = `# My Project
> format: strategic-spec | version: 1.0

Description here.

**Note:**
- This is a standalone label that looks like a section header.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toBe('Description here.');
      expect(result.project.description).not.toContain('Note');
      // Stakeholders still captured correctly
      expect(result.project.stakeholders).toHaveLength(1);
    });

    it('blockquote-only description still works (backward compatibility)', () => {
      // Explicitly verify that the original blockquote-only format is unaffected.
      const spec = `# My Project
> format: strategic-spec | version: 1.0

> This is a blockquote-only description.
> It spans multiple blockquote lines.

**Stakeholders:**
- Sarah (PM): Context

## Group: Core
> priority: must-have

### COR-01: Task
> priority: must-have | risk: low

Body.

**Success conditions:**
- Done
`;
      const result = parseStrategicSpec(spec);
      expect(result.project.description).toContain('blockquote-only description');
      expect(result.project.description).toContain('multiple blockquote lines');
      expect(result.project.stakeholders).toHaveLength(1);
    });
  });
});
