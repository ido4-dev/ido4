import { describe, it, expect, beforeEach } from 'vitest';
import { callPrompt, hasRegisteredPrompt } from '../helpers/test-utils.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerPrompts, STANDUP_PROMPT, PLAN_WAVE_PROMPT, BOARD_PROMPT } from '../../src/prompts/index.js';

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

    it('returns user message with standup instructions', async () => {
      const result = await callPrompt(server, 'standup') as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.role).toBe('user');
      expect(result.messages[0]!.content.type).toBe('text');
      expect(result.messages[0]!.content.text).toContain('standup');
    });
  });

  describe('plan-wave', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'plan-wave')).toBe(true);
    });

    it('returns base prompt without waveName', async () => {
      const result = await callPrompt(server, 'plan-wave') as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages[0]!.content.text).toContain('Plan the next development wave');
      expect(result.messages[0]!.content.text).not.toContain('Wave name to use:');
    });

    it('appends waveName when provided', async () => {
      const result = await callPrompt(server, 'plan-wave', { waveName: 'Wave 3' }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages[0]!.content.text).toContain('Wave name to use: Wave 3');
    });
  });

  describe('board', () => {
    it('is registered', () => {
      expect(hasRegisteredPrompt(server, 'board')).toBe(true);
    });

    it('returns base prompt without waveName', async () => {
      const result = await callPrompt(server, 'board') as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages[0]!.content.text).toContain('task board');
      expect(result.messages[0]!.content.text).not.toContain('Wave to display:');
    });

    it('appends waveName when provided', async () => {
      const result = await callPrompt(server, 'board', { waveName: 'Wave 1' }) as {
        messages: Array<{ role: string; content: { type: string; text: string } }>;
      };

      expect(result.messages[0]!.content.text).toContain('Wave to display: Wave 1');
    });
  });

  describe('exported prompt strings', () => {
    it('STANDUP_PROMPT mentions priorities', () => {
      expect(STANDUP_PROMPT).toContain('priorities');
    });

    it('PLAN_WAVE_PROMPT mentions Epic Integrity', () => {
      expect(PLAN_WAVE_PROMPT).toContain('Epic Integrity');
    });

    it('BOARD_PROMPT mentions kanban', () => {
      expect(BOARD_PROMPT).toContain('kanban');
    });
  });
});
