/**
 * Tests for methodology-specific prompt generators.
 *
 * Verifies that Scrum and Shape Up profiles produce prompts with their
 * native governance reasoning — not just Hydro prompts with different
 * vocabulary.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SCRUM_PROFILE, SHAPE_UP_PROFILE, HYDRO_PROFILE } from '@ido4/core';
import { registerPrompts, buildPromptContext } from '../../src/prompts/index.js';
import { SCRUM_GENERATORS } from '../../src/prompts/scrum-prompts.js';
import { SHAPE_UP_GENERATORS } from '../../src/prompts/shape-up-prompts.js';
import { HYDRO_GENERATORS } from '../../src/prompts/hydro-prompts.js';
import { callPrompt, hasRegisteredPrompt } from '../helpers/test-utils.js';

type PromptResult = {
  messages: Array<{ role: string; content: { type: string; text: string } }>;
};

// ---------------------------------------------------------------------------
// Scrum Prompts
// ---------------------------------------------------------------------------

describe('Scrum prompt generators', () => {
  const ctx = buildPromptContext(SCRUM_PROFILE);

  describe('terminology', () => {
    it('standup uses Sprint Goal-driven language', () => {
      const text = SCRUM_GENERATORS.standup(ctx);
      expect(text).toContain('Sprint Goal');
      expect(text).toContain('Daily Scrum');
      // Should not reference Hydro concepts (wave-based planning, epic integrity)
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Epic Integrity');
    });

    it('planContainer uses Sprint Planning language', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).toContain('Sprint Planning');
      expect(text).toContain('Sprint Goal');
      expect(text).not.toContain('wave-based');
    });

    it('board uses sprint-focused language', () => {
      const text = SCRUM_GENERATORS.board(ctx);
      expect(text).toContain('sprint');
      expect(text).not.toContain('wave-based');
    });

    it('compliance uses Scrum governance concepts', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('Definition of Done');
      expect(text).toContain('Sprint Discipline');
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Epic Integrity');
    });

    it('health uses Sprint Goal assessment', () => {
      const text = SCRUM_GENERATORS.health(ctx);
      expect(text).toContain('Sprint Goal');
      expect(text).not.toContain('wave-based');
    });

    it('retro uses Sprint retrospective language', () => {
      const text = SCRUM_GENERATORS.retro(ctx);
      expect(text).toContain('Sprint Retrospective');
      expect(text).not.toContain('wave-based');
    });
  });

  describe('Scrum-native governance reasoning', () => {
    it('standup focuses on Sprint Goal progress, not wave health', () => {
      const text = SCRUM_GENERATORS.standup(ctx);
      expect(text).toContain('Sprint Goal');
      expect(text).toContain('burndown');
      expect(text).toContain('impediment');
    });

    it('planContainer implements 3-topic Sprint Planning', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).toContain('Topic 1: WHY');
      expect(text).toContain('Topic 2: WHAT');
      expect(text).toContain('Topic 3: HOW');
    });

    it('planContainer uses velocity-based capacity', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).toContain('Velocity');
      expect(text).toContain('focus factor');
    });

    it('compliance prioritizes DoD compliance as highest priority', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('HIGHEST PRIORITY');
      expect(text).toContain('Definition of Done');
    });

    it('compliance checks carry-over rate as a trend', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('carry-over');
      expect(text).toContain('trend');
    });

    it('compliance audits Definition of Ready compliance', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('Definition of Ready');
      expect(text).toContain('acceptance criteria');
    });

    it('compliance checks retrospective improvement follow-through', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('Retrospective Improvement Follow-Through');
      expect(text).toContain('commitment');
    });

    it('compliance checks sprint scope discipline', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('Sprint Scope Discipline');
      expect(text).toContain('scope creep');
    });

    it('health uses Sprint Goal as primary signal', () => {
      const text = SCRUM_GENERATORS.health(ctx);
      expect(text).toContain('Sprint Goal');
      expect(text).toContain('RED');
      expect(text).toContain('YELLOW');
      expect(text).toContain('GREEN');
    });

    it('retro checks Sprint Goal achievement (binary)', () => {
      const text = SCRUM_GENERATORS.retro(ctx);
      expect(text).toContain('Sprint Goal');
      expect(text).toContain('achieved');
    });

    it('retro analyzes velocity trends', () => {
      const text = SCRUM_GENERATORS.retro(ctx);
      expect(text).toContain('velocity');
      expect(text).toContain('carry-over');
    });
  });

  describe('execute prompt', () => {
    it('uses Sprint Goal-driven language', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('Sprint Goal');
      expect(text).not.toContain('wave-based');
    });

    it('references Definition of Done as the completion standard', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('Definition of Done');
      expect(text).toContain('DoD');
    });

    it('includes story point tracking', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('story point');
    });

    it('references get_task_execution_data', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('get_task_execution_data');
    });

    it('includes context capture instructions', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('Context Capture');
      expect(text).toContain('ido4:context');
    });

    it('includes DoD checklist', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('DoD Checklist');
    });

    it('includes escalation protocol and pattern detection', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('Escalation Protocol');
      expect(text).toContain('Pattern Detection');
      expect(text).toContain('Dependency Prioritization');
      expect(text).toContain('AI agents must not fill in missing requirements');
    });

    it('includes context capture template', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('Context Capture Template');
      expect(text).toContain('150-300 words');
    });

    it('includes effort budget awareness', () => {
      const text = SCRUM_GENERATORS.execute(ctx);
      expect(text).toContain('1.5x');
      expect(text).toContain('impediment');
    });
  });

  describe('anti-patterns from PROMPT-DESIGN.md', () => {
    it('standup does not use cascade analysis (sprint backlog is flat)', () => {
      const text = SCRUM_GENERATORS.standup(ctx);
      // Scrum standup should focus on Sprint Goal, not dependency cascades
      expect(text).toContain('Sprint Goal');
    });

    it('planContainer uses Product Owner ordering, not epic-first grouping', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).toContain('Product Owner');
      expect(text).toContain('ordering');
      // Should not reference epic-first as the primary organizing principle
      expect(text).not.toContain('Epic-First Grouping');
    });

    it('compliance warns against velocity as performance metric', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('velocity');
      expect(text).toContain('planning tool');
    });
  });

  describe('adversarial review fixes', () => {
    it('planContainer does not prescribe focus factor (XP/SAFe concept)', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).not.toMatch(/focus factor.*0\.[6-8]/i);
      expect(text).toContain('Do not apply a "focus factor"');
    });

    it('planContainer treats Sprint Goal as commitment, not just organizing principle', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).toContain('Sprint Goal is a commitment');
    });

    it('planContainer references Product Goal', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).toContain('Product Goal');
    });

    it('standup surfaces observations, not commands', () => {
      const text = SCRUM_GENERATORS.standup(ctx);
      // Should not issue direct commands
      expect(text).not.toContain('Escalate payment API access today');
      // Should surface observations for the self-managing team
      expect(text).toContain('Team may want to consider');
    });

    it('planContainer does not prescribe task decomposition size', () => {
      const text = SCRUM_GENERATORS.planContainer(ctx);
      expect(text).not.toContain('~1 day or less');
      expect(text).toContain("Developers' choice");
    });

    it('retro frames velocity as forecasting stability, not performance', () => {
      const text = SCRUM_GENERATORS.retro(ctx);
      expect(text).toContain('planning tool, not a performance metric');
    });

    it('retro includes Scrum Values reflection', () => {
      const text = SCRUM_GENERATORS.retro(ctx);
      expect(text).toContain('Scrum Values');
      expect(text).toContain('Commitment');
      expect(text).toContain('Courage');
      expect(text).toContain('Focus');
      expect(text).toContain('Openness');
      expect(text).toContain('Respect');
    });

    it('compliance checks Increment coherence beyond individual DoD', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('coherent, usable Increment');
    });

    it('compliance checks refinement health', () => {
      const text = SCRUM_GENERATORS.compliance(ctx);
      expect(text).toContain('Refinement health');
    });
  });
});

describe('Scrum prompt registration', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerPrompts(server, SCRUM_PROFILE);
  });

  it('registers plan-sprint (not plan-wave)', () => {
    expect(hasRegisteredPrompt(server, 'plan-sprint')).toBe(true);
  });

  it('standup returns Scrum-specific content', async () => {
    const result = await callPrompt(server, 'standup') as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint Goal');
  });

  it('plan-sprint accepts sprintName parameter', async () => {
    const result = await callPrompt(server, 'plan-sprint', { sprintName: 'Sprint 5' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint name to use: Sprint 5');
  });

  it('board accepts sprintName parameter', async () => {
    const result = await callPrompt(server, 'board', { sprintName: 'Sprint 3' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint to display: Sprint 3');
  });

  it('retro accepts sprintName parameter', async () => {
    const result = await callPrompt(server, 'retro', { sprintName: 'Sprint 2' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint to analyze: Sprint 2');
  });

  it('registers review prompt', () => {
    expect(hasRegisteredPrompt(server, 'review')).toBe(true);
  });

  it('review accepts sprintName parameter', async () => {
    const result = await callPrompt(server, 'review', { sprintName: 'Sprint 4' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint to review: Sprint 4');
  });

  it('review returns Sprint Review content', async () => {
    const result = await callPrompt(server, 'review') as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint Review');
  });

  it('registers execute-task prompt', () => {
    expect(hasRegisteredPrompt(server, 'execute-task')).toBe(true);
  });

  it('execute-task returns Scrum-specific content', async () => {
    const result = await callPrompt(server, 'execute-task', { issueNumber: 42 }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Sprint Goal');
    expect(result.messages[0]!.content.text).toContain('Task to execute: #42');
  });
});

// ---------------------------------------------------------------------------
// Shape Up Prompts
// ---------------------------------------------------------------------------

describe('Shape Up prompt generators', () => {
  const ctx = buildPromptContext(SHAPE_UP_PROFILE);

  describe('terminology', () => {
    it('standup uses cycle/bet language', () => {
      const text = SHAPE_UP_GENERATORS.standup(ctx);
      expect(text).toContain('cycle');
      expect(text).toContain('circuit breaker');
      // Should not reference Hydro or Scrum concepts
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Sprint Goal');
    });

    it('planContainer uses betting table language', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('Betting Table');
      expect(text).toContain('pitch');
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Sprint Planning');
    });

    it('board uses hill chart language', () => {
      const text = SHAPE_UP_GENERATORS.board(ctx);
      expect(text).toContain('Hill Chart');
      expect(text).toContain('uphill');
      expect(text).toContain('downhill');
      expect(text).not.toContain('wave-based');
    });

    it('compliance uses Shape Up concepts', () => {
      const text = SHAPE_UP_GENERATORS.compliance(ctx);
      expect(text).toContain('circuit breaker');
      expect(text).toContain('appetite');
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Epic Integrity');
    });

    it('health uses circuit breaker assessment', () => {
      const text = SHAPE_UP_GENERATORS.health(ctx);
      expect(text).toContain('circuit breaker');
      expect(text).not.toContain('wave-based');
    });

    it('retro uses ship rate analysis', () => {
      const text = SHAPE_UP_GENERATORS.retro(ctx);
      expect(text).toContain('ship rate');
      expect(text).toContain('killed');
      expect(text).not.toContain('wave-based');
    });
  });

  describe('Shape Up-native governance reasoning', () => {
    it('standup assesses hill chart positions, not burndown', () => {
      const text = SHAPE_UP_GENERATORS.standup(ctx);
      expect(text).toContain('hill');
      expect(text).toContain('uphill');
      expect(text).toContain('downhill');
    });

    it('standup tracks appetite consumption', () => {
      const text = SHAPE_UP_GENERATORS.standup(ctx);
      expect(text).toContain('appetite');
    });

    it('planContainer evaluates shaped pitches', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('Problem');
      expect(text).toContain('Appetite');
      expect(text).toContain('Solution');
      expect(text).toContain('Rabbit Holes');
      expect(text).toContain('No Gos');
    });

    it('planContainer enforces no-backlog principle', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('No Backlog');
    });

    it('planContainer checks bet independence', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('Bet Independence');
    });

    it('compliance prioritizes circuit breaker enforcement', () => {
      const text = SHAPE_UP_GENERATORS.compliance(ctx);
      expect(text).toContain('Circuit Breaker');
      expect(text).toContain('HIGHEST PRIORITY');
    });

    it('compliance checks appetite discipline', () => {
      const text = SHAPE_UP_GENERATORS.compliance(ctx);
      expect(text).toContain('appetite');
    });

    it('compliance checks shaping quality', () => {
      const text = SHAPE_UP_GENERATORS.compliance(ctx);
      expect(text).toContain('shaping');
    });

    it('board presents scope-level hill chart analysis', () => {
      const text = SHAPE_UP_GENERATORS.board(ctx);
      expect(text).toContain('scope');
      expect(text).toContain('Hill Chart');
    });

    it('board detects scope hammering vs creep', () => {
      const text = SHAPE_UP_GENERATORS.board(ctx);
      expect(text).toContain('hammering');
      expect(text).toContain('creep');
    });

    it('health uses circuit breaker proximity as primary signal', () => {
      const text = SHAPE_UP_GENERATORS.health(ctx);
      expect(text).toContain('circuit breaker');
      expect(text).toContain('RED');
      expect(text).toContain('YELLOW');
      expect(text).toContain('GREEN');
    });

    it('retro assesses ship rate (50-80% healthy)', () => {
      const text = SHAPE_UP_GENERATORS.retro(ctx);
      expect(text).toContain('ship rate');
      expect(text).toContain('50-80%');
    });

    it('retro analyzes killed bets', () => {
      const text = SHAPE_UP_GENERATORS.retro(ctx);
      expect(text).toContain('Killed Bet');
    });

    it('retro evaluates shaping quality', () => {
      const text = SHAPE_UP_GENERATORS.retro(ctx);
      expect(text).toContain('shaping');
    });
  });

  describe('execute prompt', () => {
    it('uses appetite-driven language', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('appetite');
      expect(text).toContain('circuit breaker');
      expect(text).not.toContain('Sprint Goal');
      expect(text).not.toContain('wave-based');
    });

    it('includes scope hammering guidance', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('Scope Hammering');
      expect(text).toContain('Scope Creep');
    });

    it('includes rabbit hole awareness', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('Rabbit Holes');
    });

    it('includes hill chart progress tracking', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('Hill Chart');
      expect(text).toContain('uphill');
      expect(text).toContain('downhill');
    });

    it('includes vertical slice discipline', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('vertical slices');
    });

    it('references get_task_execution_data', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('get_task_execution_data');
    });

    it('includes context capture with scope decisions', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('Context Capture');
      expect(text).toContain('what you cut');
    });

    it('includes escalation protocol and pattern detection', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('Escalation Protocol');
      expect(text).toContain('Pattern Detection');
      expect(text).toContain('Dependency Prioritization');
      expect(text).toContain('AI agents must not fill in missing requirements');
    });

    it('includes context capture template', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('Context Capture Template');
      expect(text).toContain('150-300 words');
    });

    it('includes time-based self-check for appetite reasoning', () => {
      const text = SHAPE_UP_GENERATORS.execute(ctx);
      expect(text).toContain('every 30 minutes');
      expect(text).toContain('uphill or downhill');
    });
  });

  describe('anti-patterns from PROMPT-DESIGN.md', () => {
    it('standup is on-demand, not daily cadence', () => {
      const text = SHAPE_UP_GENERATORS.standup(ctx);
      expect(text).toContain('on-demand');
      expect(text).not.toContain('Daily Scrum');
    });

    it('planContainer has no backlog — fresh pitches only', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('No Backlog');
    });

    it('planContainer checks for bet independence (no dependencies)', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('independent');
    });
  });

  describe('adversarial review fixes', () => {
    it('retro uses fixed-time, variable-scope (not inverted)', () => {
      const text = SHAPE_UP_GENERATORS.retro(ctx);
      expect(text).toContain('fixed-time, variable-scope');
      expect(text).not.toContain('fixed-scope, variable-time');
    });

    it('standup acknowledges hill chart positions are self-reported proxies', () => {
      const text = SHAPE_UP_GENERATORS.standup(ctx);
      expect(text).toContain('self-reported');
      expect(text).toContain('rough proxy');
    });

    it('board acknowledges hill chart heuristics are approximate', () => {
      const text = SHAPE_UP_GENERATORS.board(ctx);
      expect(text).toContain('self-reported');
      expect(text).toContain('heuristics, NOT definitive');
    });

    it('standup distinguishes natural vs unhealthy scope growth', () => {
      const text = SHAPE_UP_GENERATORS.standup(ctx);
      expect(text).toContain('discovered vs imagined');
      expect(text).toContain('Natural');
      expect(text).toContain('Unhealthy');
    });

    it('planContainer specifies breadboards and fat marker sketches', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('breadboards');
      expect(text).toContain('fat marker sketches');
    });

    it('planContainer enforces exactly two batch sizes', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('EXACTLY two sizes');
    });

    it('board includes vertical slice discipline check', () => {
      const text = SHAPE_UP_GENERATORS.board(ctx);
      expect(text).toContain('Vertical');
      expect(text).toContain('horizontal-layer risk');
    });

    it('planContainer includes shaping pipeline health', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('Shaping Pipeline');
    });

    it('compliance treats return-to-shaping as kill for ship rate', () => {
      const text = SHAPE_UP_GENERATORS.compliance(ctx);
      expect(text).toContain('returned to shaping');
      expect(text).toContain('functionally equivalent to a killed bet');
    });

    it('planContainer frames capacity as team count, not individual', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('team count');
    });

    it('planContainer does not suggest cooldown activities', () => {
      const text = SHAPE_UP_GENERATORS.planContainer(ctx);
      expect(text).toContain('leadership does not assign or suggest');
    });
  });
});

describe('Shape Up prompt registration', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerPrompts(server, SHAPE_UP_PROFILE);
  });

  it('registers plan-cycle (not plan-wave)', () => {
    expect(hasRegisteredPrompt(server, 'plan-cycle')).toBe(true);
  });

  it('standup returns Shape Up-specific content', async () => {
    const result = await callPrompt(server, 'standup') as PromptResult;
    expect(result.messages[0]!.content.text).toContain('circuit breaker');
  });

  it('plan-cycle accepts cycleName parameter', async () => {
    const result = await callPrompt(server, 'plan-cycle', { cycleName: 'Cycle 3' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Cycle name to use: Cycle 3');
  });

  it('board accepts cycleName parameter', async () => {
    const result = await callPrompt(server, 'board', { cycleName: 'Cycle 2' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Cycle to display: Cycle 2');
  });

  it('retro accepts cycleName parameter', async () => {
    const result = await callPrompt(server, 'retro', { cycleName: 'Cycle 1' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Cycle to analyze: Cycle 1');
  });

  it('registers review prompt', () => {
    expect(hasRegisteredPrompt(server, 'review')).toBe(true);
  });

  it('review accepts cycleName parameter', async () => {
    const result = await callPrompt(server, 'review', { cycleName: 'Cycle 2' }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Cycle to review: Cycle 2');
  });

  it('review returns Cycle Demo content', async () => {
    const result = await callPrompt(server, 'review') as PromptResult;
    expect(result.messages[0]!.content.text).toContain('Demo');
  });

  it('registers execute-task prompt', () => {
    expect(hasRegisteredPrompt(server, 'execute-task')).toBe(true);
  });

  it('execute-task returns Shape Up-specific content', async () => {
    const result = await callPrompt(server, 'execute-task', { issueNumber: 10 }) as PromptResult;
    expect(result.messages[0]!.content.text).toContain('appetite');
    expect(result.messages[0]!.content.text).toContain('Task to execute: #10');
  });
});

// ---------------------------------------------------------------------------
// Review prompt — universal slot across all methodologies
// ---------------------------------------------------------------------------

describe('Review prompt (universal)', () => {
  describe('Hydro review', () => {
    const ctx = buildPromptContext(HYDRO_PROFILE);

    it('generates a Wave Review prompt', () => {
      const text = HYDRO_GENERATORS.review(ctx);
      expect(text).toContain('Wave Review');
      expect(text).toContain('Hydro');
    });

    it('includes deliverable assessment and governance quality', () => {
      const text = HYDRO_GENERATORS.review(ctx);
      expect(text).toContain('Deliverable Assessment');
      expect(text).toContain('Quality Assessment');
      expect(text).toContain('BRE pass rate');
    });

    it('includes stakeholder summary and forward analysis', () => {
      const text = HYDRO_GENERATORS.review(ctx);
      expect(text).toContain('Stakeholder');
      expect(text).toContain('Forward');
    });

    it('references epic integrity', () => {
      const text = HYDRO_GENERATORS.review(ctx);
      expect(text).toContain('Epic');
      expect(text).toContain('validate_epic_integrity');
    });
  });

  describe('Scrum review', () => {
    const ctx = buildPromptContext(SCRUM_PROFILE);

    it('generates a Sprint Review prompt with Scrum framing', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('Sprint Review');
      expect(text).toContain('Scrum');
    });

    it('frames review as inspection and adaptation, not a demo', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('inspection and adaptation');
      expect(text).toContain('NOT a demo');
    });

    it('starts with Sprint Goal assessment (binary)', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('Sprint Goal Assessment');
      expect(text).toContain('Binary');
    });

    it('includes Increment inspection with DoD', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('Increment');
      expect(text).toContain('Definition of Done');
    });

    it('includes Product Backlog adaptation', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('Product Backlog Adaptation');
      expect(text).toContain('Product Goal');
    });

    it('includes stakeholder feedback section', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('Stakeholder');
    });

    it('uses velocity as forecasting tool, not performance', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).toContain('forecasting tool');
    });

    it('does not reference Hydro concepts', () => {
      const text = SCRUM_GENERATORS.review(ctx);
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Epic Integrity');
    });
  });

  describe('Shape Up review', () => {
    const ctx = buildPromptContext(SHAPE_UP_PROFILE);

    it('generates a Cycle Demo prompt', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('Demo');
      expect(text).toContain('Shape Up');
    });

    it('leads with ship/kill summary', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('Ship/Kill Summary');
      expect(text).toContain('Ship rate');
    });

    it('includes shipped bet showcase with scope hammering', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('Shipped Bet Showcase');
      expect(text).toContain('hammered');
    });

    it('includes killed bet accounting with shaping quality analysis', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('Killed Bet Accounting');
      expect(text).toContain('shaping failure');
    });

    it('treats killing as circuit breaker working', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('circuit breaker working');
    });

    it('feeds into the betting table', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('Betting Table Input');
      expect(text).toContain('re-pitch');
    });

    it('includes cooldown preview', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).toContain('Cooldown');
    });

    it('does not reference Scrum or Hydro concepts', () => {
      const text = SHAPE_UP_GENERATORS.review(ctx);
      expect(text).not.toContain('Sprint Goal');
      expect(text).not.toContain('wave-based');
      expect(text).not.toContain('Epic Integrity');
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-profile differentiation
// ---------------------------------------------------------------------------

describe('cross-profile prompt differentiation', () => {
  const hydroCtx = buildPromptContext(HYDRO_PROFILE);
  const scrumCtx = buildPromptContext(SCRUM_PROFILE);
  const shapeUpCtx = buildPromptContext(SHAPE_UP_PROFILE);

  it('each methodology produces distinct standup prompts', () => {
    const hydro = HYDRO_GENERATORS.standup(hydroCtx);
    const scrum = SCRUM_GENERATORS.standup(scrumCtx);
    const shapeUp = SHAPE_UP_GENERATORS.standup(shapeUpCtx);

    // Each should have different governance framing
    expect(hydro).toContain('morning briefing');
    expect(scrum).toContain('Daily Scrum');
    expect(shapeUp).toContain('on-demand');

    // They should be substantially different, not just word replacements
    expect(hydro).not.toEqual(scrum);
    expect(hydro).not.toEqual(shapeUp);
    expect(scrum).not.toEqual(shapeUp);
  });

  it('each methodology produces distinct compliance prompts', () => {
    const hydro = HYDRO_GENERATORS.compliance(hydroCtx);
    const scrum = SCRUM_GENERATORS.compliance(scrumCtx);
    const shapeUp = SHAPE_UP_GENERATORS.compliance(shapeUpCtx);

    // Each has different compliance priorities
    expect(hydro).toContain('Structural Principle Audit');
    expect(scrum).toContain('Definition of Done');
    expect(shapeUp).toContain('Circuit Breaker');
  });

  it('each methodology produces distinct planning prompts', () => {
    const hydro = HYDRO_GENERATORS.planContainer(hydroCtx);
    const scrum = SCRUM_GENERATORS.planContainer(scrumCtx);
    const shapeUp = SHAPE_UP_GENERATORS.planContainer(shapeUpCtx);

    expect(hydro).toContain('Epic-First Grouping');
    expect(scrum).toContain('Sprint Planning');
    expect(shapeUp).toContain('Betting Table');
  });

  it('each methodology produces distinct review prompts', () => {
    const hydro = HYDRO_GENERATORS.review(hydroCtx);
    const scrum = SCRUM_GENERATORS.review(scrumCtx);
    const shapeUp = SHAPE_UP_GENERATORS.review(shapeUpCtx);

    // Each has different review framing
    expect(hydro).toContain('Wave Review');
    expect(scrum).toContain('Sprint Review');
    expect(shapeUp).toContain('Demo');

    // They should be substantially different
    expect(hydro).not.toEqual(scrum);
    expect(hydro).not.toEqual(shapeUp);
    expect(scrum).not.toEqual(shapeUp);
  });

  it('each methodology produces distinct execute prompts', () => {
    const hydro = HYDRO_GENERATORS.execute(hydroCtx);
    const scrum = SCRUM_GENERATORS.execute(scrumCtx);
    const shapeUp = SHAPE_UP_GENERATORS.execute(shapeUpCtx);

    // Each has different execution framing
    expect(hydro).toContain('Methodology Principles');
    expect(scrum).toContain('Definition of Done');
    expect(shapeUp).toContain('Scope Hammering');

    // All reference get_task_execution_data
    expect(hydro).toContain('get_task_execution_data');
    expect(scrum).toContain('get_task_execution_data');
    expect(shapeUp).toContain('get_task_execution_data');

    // All include context capture
    expect(hydro).toContain('Context Capture');
    expect(scrum).toContain('Context Capture');
    expect(shapeUp).toContain('Context Capture');

    // They should be substantially different
    expect(hydro).not.toEqual(scrum);
    expect(hydro).not.toEqual(shapeUp);
    expect(scrum).not.toEqual(shapeUp);
  });
});
