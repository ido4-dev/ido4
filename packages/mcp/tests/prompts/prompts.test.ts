import { describe, it, expect, beforeEach } from 'vitest';
import { callPrompt, hasRegisteredPrompt } from '../helpers/test-utils.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerPrompts,
  STANDUP_PROMPT,
  PLAN_WAVE_PROMPT,
  BOARD_PROMPT,
  COMPLIANCE_PROMPT,
  RETRO_PROMPT,
} from '../../src/prompts/index.js';

type PromptResult = {
  messages: Array<{ role: string; content: { type: string; text: string } }>;
};

describe('Prompts', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerPrompts(server);
  });

  describe('standup', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'standup')).toBe(true);
    });

    it('returns user message with governance-aware briefing instructions', async () => {
      const result = await callPrompt(server, 'standup') as PromptResult;

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.role).toBe('user');
      expect(result.messages[0]!.content.type).toBe('text');
      expect(result.messages[0]!.content.text).toContain('morning');
    });

    it('includes blocker analysis framework', async () => {
      const result = await callPrompt(server, 'standup') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Blocker Analysis');
    });

    it('includes review bottleneck detection', async () => {
      const result = await callPrompt(server, 'standup') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Review Bottleneck');
    });

    it('includes leverage point identification', async () => {
      const result = await callPrompt(server, 'standup') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Leverage Point');
    });
  });

  describe('plan-wave', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'plan-wave')).toBe(true);
    });

    it('returns base prompt without waveName', async () => {
      const result = await callPrompt(server, 'plan-wave') as PromptResult;

      expect(result.messages[0]!.content.text).toContain('composing the next development wave');
      expect(result.messages[0]!.content.text).not.toContain('Wave name to use:');
    });

    it('appends waveName when provided', async () => {
      const result = await callPrompt(server, 'plan-wave', { waveName: 'Wave 3' }) as PromptResult;

      expect(result.messages[0]!.content.text).toContain('Wave name to use: Wave 3');
    });

    it('includes Epic Integrity enforcement', async () => {
      const result = await callPrompt(server, 'plan-wave') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Epic Integrity');
      expect(result.messages[0]!.content.text).toContain('NON-NEGOTIABLE');
    });

    it('includes dependency coherence reasoning', async () => {
      const result = await callPrompt(server, 'plan-wave') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Dependency Coherence');
    });

    it('includes conflict detection guidance', async () => {
      const result = await callPrompt(server, 'plan-wave') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Conflict Detection');
    });
  });

  describe('board', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'board')).toBe(true);
    });

    it('returns base prompt without waveName', async () => {
      const result = await callPrompt(server, 'board') as PromptResult;

      expect(result.messages[0]!.content.text).toContain('kanban');
      expect(result.messages[0]!.content.text).not.toContain('Wave to display:');
    });

    it('appends waveName when provided', async () => {
      const result = await callPrompt(server, 'board', { waveName: 'Wave 1' }) as PromptResult;

      expect(result.messages[0]!.content.text).toContain('Wave to display: Wave 1');
    });

    it('includes column balance analysis', async () => {
      const result = await callPrompt(server, 'board') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Column Balance');
    });

    it('includes flow analysis guidance', async () => {
      const result = await callPrompt(server, 'board') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('flow');
    });
  });

  describe('compliance', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'compliance')).toBe(true);
    });

    it('returns user message with audit instructions', async () => {
      const result = await callPrompt(server, 'compliance') as PromptResult;

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.role).toBe('user');
      expect(result.messages[0]!.content.type).toBe('text');
    });

    it('audits all 5 Unbreakable Principles', async () => {
      const result = await callPrompt(server, 'compliance') as PromptResult;
      const text = result.messages[0]!.content.text;

      expect(text).toContain('Epic Integrity');
      expect(text).toContain('Active Wave Singularity');
      expect(text).toContain('Dependency Coherence');
      expect(text).toContain('Self-Contained Execution');
      expect(text).toContain('Atomic Completion');
    });

    it('includes remediation guidance', async () => {
      const result = await callPrompt(server, 'compliance') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Remediation');
    });

    it('includes compliance scoring', async () => {
      const result = await callPrompt(server, 'compliance') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Overall Compliance');
    });
  });

  describe('retro', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'retro')).toBe(true);
    });

    it('returns base prompt without waveName', async () => {
      const result = await callPrompt(server, 'retro') as PromptResult;

      expect(result.messages[0]!.content.text).toContain('wave retrospective');
      expect(result.messages[0]!.content.text).not.toContain('Wave to analyze:');
    });

    it('appends waveName when provided', async () => {
      const result = await callPrompt(server, 'retro', { waveName: 'Wave 2' }) as PromptResult;

      expect(result.messages[0]!.content.text).toContain('Wave to analyze: Wave 2');
    });

    it('includes delivery and flow analysis', async () => {
      const result = await callPrompt(server, 'retro') as PromptResult;
      const text = result.messages[0]!.content.text;

      expect(text).toContain('Delivery Analysis');
      expect(text).toContain('Flow Analysis');
    });

    it('includes blocker pattern analysis', async () => {
      const result = await callPrompt(server, 'retro') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Blocker Analysis');
    });

    it('includes actionable recommendations', async () => {
      const result = await callPrompt(server, 'retro') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('Recommendations');
    });
  });

  describe('few-shot examples', () => {
    it('STANDUP_PROMPT includes example output', () => {
      expect(STANDUP_PROMPT).toContain('What Governance Expertise Sounds Like');
      expect(STANDUP_PROMPT).toContain('cascade');
    });

    it('PLAN_WAVE_PROMPT includes example output', () => {
      expect(PLAN_WAVE_PROMPT).toContain('What Principle-Aware Planning Sounds Like');
      expect(PLAN_WAVE_PROMPT).toContain('All included per Epic Integrity');
    });

    it('BOARD_PROMPT includes example output', () => {
      expect(BOARD_PROMPT).toContain('Board With Flow Intelligence');
    });

    it('COMPLIANCE_PROMPT includes example output', () => {
      expect(COMPLIANCE_PROMPT).toContain('Compliance Audit With Teeth');
    });

    it('RETRO_PROMPT includes example output', () => {
      expect(RETRO_PROMPT).toContain('Retrospective With Insight');
    });
  });

  describe('phase detection', () => {
    it('STANDUP_PROMPT includes wave phase detection', () => {
      expect(STANDUP_PROMPT).toContain('Phase Detection');
      expect(STANDUP_PROMPT).toContain('Early (<30%)');
      expect(STANDUP_PROMPT).toContain('Late (>70%)');
    });

    it('BOARD_PROMPT includes phase-aware focus', () => {
      expect(BOARD_PROMPT).toContain('Phase-Aware Focus');
    });
  });

  describe('severity scoring', () => {
    it('COMPLIANCE_PROMPT includes severity model', () => {
      expect(COMPLIANCE_PROMPT).toContain('Severity Scoring');
      expect(COMPLIANCE_PROMPT).toContain('Wave proximity multiplier');
      expect(COMPLIANCE_PROMPT).toContain('Cascade multiplier');
    });
  });

  describe('exported prompt strings', () => {
    it('STANDUP_PROMPT includes governance reasoning', () => {
      expect(STANDUP_PROMPT).toContain('leverage');
      expect(STANDUP_PROMPT).toContain('Wave Health');
      expect(STANDUP_PROMPT).toContain('Blocker Analysis');
    });

    it('PLAN_WAVE_PROMPT includes principle enforcement', () => {
      expect(PLAN_WAVE_PROMPT).toContain('Epic Integrity');
      expect(PLAN_WAVE_PROMPT).toContain('Dependency Coherence');
      expect(PLAN_WAVE_PROMPT).toContain('Self-Contained');
    });

    it('BOARD_PROMPT includes flow analysis', () => {
      expect(BOARD_PROMPT).toContain('kanban');
      expect(BOARD_PROMPT).toContain('Column Balance');
      expect(BOARD_PROMPT).toContain('bottleneck');
    });

    it('COMPLIANCE_PROMPT audits all principles', () => {
      expect(COMPLIANCE_PROMPT).toContain('5 Unbreakable Principles');
      expect(COMPLIANCE_PROMPT).toContain('Remediation');
    });

    it('RETRO_PROMPT includes retrospective framework', () => {
      expect(RETRO_PROMPT).toContain('Velocity');
      expect(RETRO_PROMPT).toContain('Recommendations');
      expect(RETRO_PROMPT).toContain('Carry Forward');
    });
  });
});
