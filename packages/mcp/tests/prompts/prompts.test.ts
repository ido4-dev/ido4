import { describe, it, expect, beforeEach } from 'vitest';
import { callPrompt, hasRegisteredPrompt } from '../helpers/test-utils.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HYDRO_PROFILE } from '@ido4/core';
import {
  registerPrompts,
  generateStandupPrompt,
  generatePlanContainerPrompt,
  generateBoardPrompt,
  generateCompliancePrompt,
  generateHealthPrompt,
  generateRetroPrompt,
  buildPromptContext,
} from '../../src/prompts/index.js';

type PromptResult = {
  messages: Array<{ role: string; content: { type: string; text: string } }>;
};

describe('Prompts', () => {
  let server: McpServer;
  const ctx = buildPromptContext(HYDRO_PROFILE);

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.1.0' });
    registerPrompts(server, HYDRO_PROFILE);
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

      expect(result.messages[0]!.content.text).toContain('flow intelligence');
      expect(result.messages[0]!.content.text).not.toContain('Wave to display:');
    });

    it('appends waveName when provided', async () => {
      const result = await callPrompt(server, 'board', { waveName: 'Wave 1' }) as PromptResult;

      expect(result.messages[0]!.content.text).toContain('Wave to display: Wave 1');
    });

    it('includes cascade and false status analysis', async () => {
      const result = await callPrompt(server, 'board') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('cascade');
      expect(result.messages[0]!.content.text).toContain('False status');
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
      expect(result.messages[0]!.content.text).toContain('Compliance Score');
    });
  });

  describe('health', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'health')).toBe(true);
    });

    it('returns user message with health check instructions', async () => {
      const result = await callPrompt(server, 'health') as PromptResult;

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.role).toBe('user');
      expect(result.messages[0]!.content.text).toContain('health check');
    });

    it('includes RED/YELLOW/GREEN assessment criteria', async () => {
      const result = await callPrompt(server, 'health') as PromptResult;
      const text = result.messages[0]!.content.text;

      expect(text).toContain('RED');
      expect(text).toContain('YELLOW');
      expect(text).toContain('GREEN');
    });

    it('uses get_health_data composite tool', async () => {
      const result = await callPrompt(server, 'health') as PromptResult;
      expect(result.messages[0]!.content.text).toContain('get_health_data');
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
      expect(text).toContain('Flow');
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
    it('standup prompt includes example output', () => {
      const prompt = generateStandupPrompt(ctx);
      expect(prompt).toContain('Data-Backed Governance Expertise Sounds Like');
      expect(prompt).toContain('cascade');
    });

    it('plan prompt includes example output', () => {
      const prompt = generatePlanContainerPrompt(ctx);
      expect(prompt).toContain('Data-Driven Principle-Aware Planning Sounds Like');
      expect(prompt).toContain('All included per Epic Integrity');
    });

    it('board prompt includes example output', () => {
      const prompt = generateBoardPrompt(ctx);
      expect(prompt).toContain('Flow Intelligence Report');
    });

    it('compliance prompt includes example output', () => {
      const prompt = generateCompliancePrompt(ctx);
      expect(prompt).toContain('Compliance Intelligence');
    });

    it('retro prompt includes example output', () => {
      const prompt = generateRetroPrompt(ctx);
      expect(prompt).toContain('Data-Backed Retrospective');
    });
  });

  describe('phase detection', () => {
    it('standup prompt includes wave phase detection', () => {
      const prompt = generateStandupPrompt(ctx);
      expect(prompt).toContain('Phase Detection');
      expect(prompt).toContain('Early (<30%)');
      expect(prompt).toContain('Late (>70%)');
    });

    it('board prompt includes phase detection', () => {
      const prompt = generateBoardPrompt(ctx);
      expect(prompt).toContain('Phase Detection');
    });
  });

  describe('severity scoring', () => {
    it('compliance prompt includes severity model', () => {
      const prompt = generateCompliancePrompt(ctx);
      expect(prompt).toContain('Severity Scoring');
      expect(prompt).toContain('Wave proximity multiplier');
      expect(prompt).toContain('Cascade multiplier');
    });
  });

  describe('exported prompt generators', () => {
    it('standup prompt includes governance reasoning', () => {
      const prompt = generateStandupPrompt(ctx);
      expect(prompt).toContain('leverage');
      expect(prompt).toContain('Wave Health');
      expect(prompt).toContain('Blocker Analysis');
    });

    it('plan container prompt includes principle enforcement', () => {
      const prompt = generatePlanContainerPrompt(ctx);
      expect(prompt).toContain('Epic Integrity');
      expect(prompt).toContain('Dependency Coherence');
      expect(prompt).toContain('Self-Contained');
    });

    it('board prompt includes flow intelligence', () => {
      const prompt = generateBoardPrompt(ctx);
      expect(prompt).toContain('flow intelligence');
      expect(prompt).toContain('cascade');
      expect(prompt).toContain('bottleneck');
    });

    it('compliance prompt audits all principles', () => {
      const prompt = generateCompliancePrompt(ctx);
      expect(prompt).toContain('Structural Principle Audit');
      expect(prompt).toContain('Remediation');
    });

    it('health prompt includes multi-dimensional assessment', () => {
      const prompt = generateHealthPrompt(ctx);
      expect(prompt).toContain('flow');
      expect(prompt).toContain('governance');
      expect(prompt).toContain('team');
    });

    it('retro prompt includes retrospective framework', () => {
      const prompt = generateRetroPrompt(ctx);
      expect(prompt).toContain('Velocity');
      expect(prompt).toContain('Recommendations');
      expect(prompt).toContain('Carry Forward');
    });
  });
});
