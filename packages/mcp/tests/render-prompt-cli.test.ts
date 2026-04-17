/**
 * Tests for render-prompt-cli — argument parsing for the CLI wrapper.
 *
 * These cover the shell-invocation patterns the ido4dev plugin shell skills
 * will use (see ido4dev/docs/phase-2-brief.md §2). The key scenario: a skill
 * body contains `!`node ... review "$ARGUMENTS"``. When Claude Code
 * substitutes $ARGUMENTS, it may produce an empty string (user invoked with
 * no args) — the CLI must handle that gracefully without error.
 */

import { describe, it, expect } from 'vitest';
import { parseArgs } from '../src/render-prompt-cli.js';

describe('render-prompt-cli parseArgs', () => {
  // argv[0] is the node executable, argv[1] is the script path.
  // parseArgs slices starting from index 2.
  const prefix = ['node', '/path/to/render-prompt-cli.js'];

  describe('happy path', () => {
    it('ceremony only', () => {
      const result = parseArgs([...prefix, 'standup']);
      expect(result).toEqual({ ceremony: 'standup' });
    });

    it('ceremony + positional container name', () => {
      const result = parseArgs([...prefix, 'review', 'Wave-002']);
      expect(result).toEqual({ ceremony: 'review', containerName: 'Wave-002' });
    });

    it('ceremony + explicit --container flag', () => {
      const result = parseArgs([...prefix, 'review', '--container', 'Sprint 5']);
      expect(result).toEqual({ ceremony: 'review', containerName: 'Sprint 5' });
    });

    it('execute-task + positional issue number', () => {
      const result = parseArgs([...prefix, 'execute-task', '42']);
      expect(result).toEqual({ ceremony: 'execute-task', issueNumber: 42 });
    });

    it('execute-task + explicit --issue flag', () => {
      const result = parseArgs([...prefix, 'execute-task', '--issue', '42']);
      expect(result).toEqual({ ceremony: 'execute-task', issueNumber: 42 });
    });
  });

  describe('empty-string positional (skill $ARGUMENTS with no user input)', () => {
    it('review with empty positional → no containerName set', () => {
      const result = parseArgs([...prefix, 'review', '']);
      expect(result).toEqual({ ceremony: 'review' });
      expect(result.containerName).toBeUndefined();
    });

    it('execute-task with empty positional → no issueNumber set', () => {
      const result = parseArgs([...prefix, 'execute-task', '']);
      expect(result).toEqual({ ceremony: 'execute-task' });
      expect(result.issueNumber).toBeUndefined();
    });

    it('standup with empty positional → fine, no error', () => {
      const result = parseArgs([...prefix, 'standup', '']);
      expect(result).toEqual({ ceremony: 'standup' });
    });

    it('board with empty --container value → no containerName set', () => {
      const result = parseArgs([...prefix, 'board', '--container', '']);
      expect(result).toEqual({ ceremony: 'board' });
    });

    it('execute-task with empty --issue value → no issueNumber set', () => {
      const result = parseArgs([...prefix, 'execute-task', '--issue', '']);
      expect(result).toEqual({ ceremony: 'execute-task' });
    });
  });

  describe('ceremonies without container/issue support silently ignore positional', () => {
    it('standup + positional is ignored, not an error', () => {
      const result = parseArgs([...prefix, 'standup', 'Wave-001']);
      expect(result).toEqual({ ceremony: 'standup' });
    });

    it('compliance + positional is ignored', () => {
      const result = parseArgs([...prefix, 'compliance', 'anything']);
      expect(result).toEqual({ ceremony: 'compliance' });
    });

    it('health + positional is ignored', () => {
      const result = parseArgs([...prefix, 'health', 'foo']);
      expect(result).toEqual({ ceremony: 'health' });
    });
  });

  describe('flag overrides positional (explicit wins)', () => {
    it('review with both positional and --container: flag wins', () => {
      const result = parseArgs([...prefix, 'review', 'from-positional', '--container', 'from-flag']);
      expect(result.containerName).toBe('from-flag');
    });

    it('execute-task with both positional and --issue: flag wins', () => {
      const result = parseArgs([...prefix, 'execute-task', '10', '--issue', '20']);
      expect(result.issueNumber).toBe(20);
    });
  });

  describe('error cases', () => {
    it('no args → usage error', () => {
      expect(() => parseArgs([...prefix])).toThrow(/Usage:/);
    });

    it('--help → usage', () => {
      expect(() => parseArgs([...prefix, '--help'])).toThrow(/Usage:/);
    });

    it('-h → usage', () => {
      expect(() => parseArgs([...prefix, '-h'])).toThrow(/Usage:/);
    });

    it('flag-like first arg → usage error', () => {
      expect(() => parseArgs([...prefix, '--container', 'x'])).toThrow(/Usage:/);
    });

    it('--container without value → error', () => {
      expect(() => parseArgs([...prefix, 'review', '--container'])).toThrow(/--container requires a value/);
    });

    it('--issue without value → error', () => {
      expect(() => parseArgs([...prefix, 'execute-task', '--issue'])).toThrow(/--issue requires a value/);
    });

    it('--issue with non-integer → error', () => {
      expect(() => parseArgs([...prefix, 'execute-task', '--issue', 'abc'])).toThrow(/positive integer/);
    });

    it('--issue with zero → error', () => {
      expect(() => parseArgs([...prefix, 'execute-task', '--issue', '0'])).toThrow(/positive integer/);
    });

    it('--issue with negative → error', () => {
      expect(() => parseArgs([...prefix, 'execute-task', '--issue', '-5'])).toThrow(/positive integer/);
    });

    it('--issue with fractional → error', () => {
      expect(() => parseArgs([...prefix, 'execute-task', '--issue', '1.5'])).toThrow(/positive integer/);
    });

    it('execute-task with non-integer positional → error', () => {
      expect(() => parseArgs([...prefix, 'execute-task', 'notanumber'])).toThrow(/positive integer/);
    });

    it('unknown flag → error', () => {
      expect(() => parseArgs([...prefix, 'standup', '--bogus'])).toThrow(/Unknown argument/);
    });

    it('extra positional arg → error', () => {
      expect(() => parseArgs([...prefix, 'review', 'Wave-001', 'extra'])).toThrow(/Unexpected extra argument/);
    });
  });

  describe('all valid ceremonies accepted', () => {
    const valid = ['standup', 'plan', 'plan-wave', 'plan-sprint', 'plan-cycle', 'board', 'compliance', 'health', 'retro', 'review', 'execute-task'];
    for (const ceremony of valid) {
      it(`accepts "${ceremony}"`, () => {
        // parseArgs doesn't validate ceremony name — that's done downstream by
        // renderPrompt. So any string (not starting with --) is syntactically valid here.
        const result = parseArgs([...prefix, ceremony]);
        expect(result.ceremony).toBe(ceremony);
      });
    }
  });
});
