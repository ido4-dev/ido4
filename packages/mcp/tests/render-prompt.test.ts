/**
 * Tests for renderPrompt — the Runtime Prompt Rendering engine used by
 * ido4dev plugin shell skills (see ido4dev/docs/phase-2-brief.md §2).
 *
 * Contract being verified: renderPrompt produces byte-identical output to
 * what `prompts/index.ts:registerPrompts` would produce for the same profile
 * + parameters. The two code paths (MCP prompt handler, shell-skill bash
 * injection) must never drift.
 *
 * Covers the 8 ceremonies × 3 methodologies = 24 scenarios, parameter
 * suffix handling, cross-methodology differentiation, error cases, and
 * fallback behavior for unknown profiles.
 */

import { describe, it, expect } from 'vitest';
import { HYDRO_PROFILE, SCRUM_PROFILE, SHAPE_UP_PROFILE } from '@ido4/core';
import {
  renderPrompt,
  VALID_CEREMONIES,
  UnknownCeremonyError,
} from '../src/render-prompt.js';
import { HYDRO_GENERATORS } from '../src/prompts/hydro-prompts.js';
import { SCRUM_GENERATORS } from '../src/prompts/scrum-prompts.js';
import { SHAPE_UP_GENERATORS } from '../src/prompts/shape-up-prompts.js';
import { buildPromptContext } from '../src/prompts/prompt-context.js';

// ---------------------------------------------------------------------------
// Helper: expected text from in-process generator (ground truth)
// ---------------------------------------------------------------------------

function expectedText(
  profile: typeof HYDRO_PROFILE,
  generators: typeof HYDRO_GENERATORS,
  slot: keyof typeof HYDRO_GENERATORS,
): string {
  return generators[slot](buildPromptContext(profile));
}

// ---------------------------------------------------------------------------
// Core contract: renderPrompt output matches in-process generator output
// ---------------------------------------------------------------------------

describe('renderPrompt — contract with prompt generators', () => {
  const triplets = [
    { name: 'Hydro', profile: HYDRO_PROFILE, generators: HYDRO_GENERATORS },
    { name: 'Scrum', profile: SCRUM_PROFILE, generators: SCRUM_GENERATORS },
    { name: 'Shape Up', profile: SHAPE_UP_PROFILE, generators: SHAPE_UP_GENERATORS },
  ] as const;

  for (const { name, profile, generators } of triplets) {
    describe(`${name} methodology`, () => {
      it('renders standup matching in-process generator', () => {
        const result = renderPrompt(profile, 'standup');
        expect(result.text).toBe(expectedText(profile, generators, 'standup'));
      });

      it('renders board matching in-process generator', () => {
        const result = renderPrompt(profile, 'board');
        expect(result.text).toBe(expectedText(profile, generators, 'board'));
      });

      it('renders compliance matching in-process generator', () => {
        const result = renderPrompt(profile, 'compliance');
        expect(result.text).toBe(expectedText(profile, generators, 'compliance'));
      });

      it('renders health matching in-process generator', () => {
        const result = renderPrompt(profile, 'health');
        expect(result.text).toBe(expectedText(profile, generators, 'health'));
      });

      it('renders retro matching in-process generator', () => {
        const result = renderPrompt(profile, 'retro');
        expect(result.text).toBe(expectedText(profile, generators, 'retro'));
      });

      it('renders review matching in-process generator', () => {
        const result = renderPrompt(profile, 'review');
        expect(result.text).toBe(expectedText(profile, generators, 'review'));
      });

      it('renders plan (planContainer slot) matching in-process generator', () => {
        const result = renderPrompt(profile, 'plan');
        expect(result.text).toBe(expectedText(profile, generators, 'planContainer'));
      });

      it('renders execute-task (execute slot) matching in-process generator', () => {
        const result = renderPrompt(profile, 'execute-task');
        expect(result.text).toBe(expectedText(profile, generators, 'execute'));
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Container name suffix handling — must mirror prompts/index.ts exactly
// ---------------------------------------------------------------------------

describe('renderPrompt — container name suffixes', () => {
  describe('Hydro (container = Wave)', () => {
    it('plan suffix: "Wave name to use: <name>"', () => {
      const result = renderPrompt(HYDRO_PROFILE, 'plan', { containerName: 'Wave 3' });
      expect(result.text).toContain('Wave name to use: Wave 3');
    });

    it('board suffix: "Wave to display: <name>"', () => {
      const result = renderPrompt(HYDRO_PROFILE, 'board', { containerName: 'Wave 1' });
      expect(result.text).toContain('Wave to display: Wave 1');
    });

    it('retro suffix: "Wave to analyze: <name>"', () => {
      const result = renderPrompt(HYDRO_PROFILE, 'retro', { containerName: 'Wave 2' });
      expect(result.text).toContain('Wave to analyze: Wave 2');
    });

    it('review suffix: "Wave to review: <name>"', () => {
      const result = renderPrompt(HYDRO_PROFILE, 'review', { containerName: 'Wave-002' });
      expect(result.text).toContain('Wave to review: Wave-002');
    });
  });

  describe('Scrum (container = Sprint)', () => {
    it('plan suffix uses Sprint terminology', () => {
      const result = renderPrompt(SCRUM_PROFILE, 'plan', { containerName: 'Sprint 5' });
      expect(result.text).toContain('Sprint name to use: Sprint 5');
    });

    it('board suffix uses Sprint terminology', () => {
      const result = renderPrompt(SCRUM_PROFILE, 'board', { containerName: 'Sprint 3' });
      expect(result.text).toContain('Sprint to display: Sprint 3');
    });

    it('retro suffix uses Sprint terminology', () => {
      const result = renderPrompt(SCRUM_PROFILE, 'retro', { containerName: 'Sprint 2' });
      expect(result.text).toContain('Sprint to analyze: Sprint 2');
    });

    it('review suffix uses Sprint terminology', () => {
      const result = renderPrompt(SCRUM_PROFILE, 'review', { containerName: 'Sprint 4' });
      expect(result.text).toContain('Sprint to review: Sprint 4');
    });
  });

  describe('Shape Up (container = Cycle)', () => {
    it('plan suffix uses Cycle terminology', () => {
      const result = renderPrompt(SHAPE_UP_PROFILE, 'plan', { containerName: 'Cycle 3' });
      expect(result.text).toContain('Cycle name to use: Cycle 3');
    });

    it('board suffix uses Cycle terminology', () => {
      const result = renderPrompt(SHAPE_UP_PROFILE, 'board', { containerName: 'Cycle 2' });
      expect(result.text).toContain('Cycle to display: Cycle 2');
    });

    it('retro suffix uses Cycle terminology', () => {
      const result = renderPrompt(SHAPE_UP_PROFILE, 'retro', { containerName: 'Cycle 1' });
      expect(result.text).toContain('Cycle to analyze: Cycle 1');
    });

    it('review suffix uses Cycle terminology', () => {
      const result = renderPrompt(SHAPE_UP_PROFILE, 'review', { containerName: 'Cycle 2' });
      expect(result.text).toContain('Cycle to review: Cycle 2');
    });
  });

  describe('legacy per-methodology plan aliases (plan-wave, plan-sprint, plan-cycle)', () => {
    it('plan-wave renders the same as plan for Hydro', () => {
      const via_plan = renderPrompt(HYDRO_PROFILE, 'plan', { containerName: 'Wave 1' });
      const via_plan_wave = renderPrompt(HYDRO_PROFILE, 'plan-wave', { containerName: 'Wave 1' });
      expect(via_plan_wave.text).toBe(via_plan.text);
    });

    it('plan-sprint renders the same as plan for Scrum', () => {
      const via_plan = renderPrompt(SCRUM_PROFILE, 'plan', { containerName: 'Sprint 1' });
      const via_plan_sprint = renderPrompt(SCRUM_PROFILE, 'plan-sprint', { containerName: 'Sprint 1' });
      expect(via_plan_sprint.text).toBe(via_plan.text);
    });

    it('plan-cycle renders the same as plan for Shape Up', () => {
      const via_plan = renderPrompt(SHAPE_UP_PROFILE, 'plan', { containerName: 'Cycle 1' });
      const via_plan_cycle = renderPrompt(SHAPE_UP_PROFILE, 'plan-cycle', { containerName: 'Cycle 1' });
      expect(via_plan_cycle.text).toBe(via_plan.text);
    });
  });

  it('no containerName → no suffix appended', () => {
    const result = renderPrompt(HYDRO_PROFILE, 'plan');
    expect(result.text).not.toContain('name to use:');
  });

  it('containerName on ceremony without container slot → no suffix', () => {
    // standup doesn't accept containerName
    const bare = renderPrompt(HYDRO_PROFILE, 'standup');
    const withContainer = renderPrompt(HYDRO_PROFILE, 'standup', { containerName: 'Wave 5' });
    expect(withContainer.text).toBe(bare.text);
  });
});

// ---------------------------------------------------------------------------
// Issue number suffix handling for execute-task
// ---------------------------------------------------------------------------

describe('renderPrompt — issueNumber suffix for execute-task', () => {
  it('appends "Task to execute: #<n>" for Hydro', () => {
    const result = renderPrompt(HYDRO_PROFILE, 'execute-task', { issueNumber: 42 });
    expect(result.text).toContain('Task to execute: #42');
  });

  it('appends "Task to execute: #<n>" for Scrum', () => {
    const result = renderPrompt(SCRUM_PROFILE, 'execute-task', { issueNumber: 7 });
    expect(result.text).toContain('Task to execute: #7');
  });

  it('appends "Task to execute: #<n>" for Shape Up', () => {
    const result = renderPrompt(SHAPE_UP_PROFILE, 'execute-task', { issueNumber: 123 });
    expect(result.text).toContain('Task to execute: #123');
  });

  it('no issueNumber → no suffix appended', () => {
    const result = renderPrompt(HYDRO_PROFILE, 'execute-task');
    expect(result.text).not.toContain('Task to execute:');
  });

  it('issueNumber on non-execute ceremony → no suffix', () => {
    // standup doesn't accept issueNumber
    const bare = renderPrompt(HYDRO_PROFILE, 'standup');
    const withIssue = renderPrompt(HYDRO_PROFILE, 'standup', { issueNumber: 99 });
    expect(withIssue.text).toBe(bare.text);
  });
});

// ---------------------------------------------------------------------------
// Cross-methodology differentiation — guard against accidental collapse
// ---------------------------------------------------------------------------

describe('renderPrompt — cross-methodology differentiation', () => {
  const ceremonies = ['standup', 'plan', 'board', 'compliance', 'health', 'retro', 'review', 'execute-task'] as const;

  for (const ceremony of ceremonies) {
    it(`${ceremony} produces distinct output across Hydro / Scrum / Shape Up`, () => {
      const hydro = renderPrompt(HYDRO_PROFILE, ceremony);
      const scrum = renderPrompt(SCRUM_PROFILE, ceremony);
      const shapeUp = renderPrompt(SHAPE_UP_PROFILE, ceremony);

      expect(hydro.text).not.toBe(scrum.text);
      expect(hydro.text).not.toBe(shapeUp.text);
      expect(scrum.text).not.toBe(shapeUp.text);
    });
  }
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('renderPrompt — error handling', () => {
  it('throws UnknownCeremonyError on unknown ceremony name', () => {
    expect(() => renderPrompt(HYDRO_PROFILE, 'nonexistent')).toThrow(UnknownCeremonyError);
    expect(() => renderPrompt(HYDRO_PROFILE, 'nonexistent')).toThrow(/Unknown ceremony/);
  });

  it('error message lists valid ceremonies', () => {
    try {
      renderPrompt(HYDRO_PROFILE, 'bogus');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownCeremonyError);
      const message = (err as Error).message;
      for (const valid of VALID_CEREMONIES) {
        expect(message).toContain(valid);
      }
    }
  });

  it('falls back to Hydro generators for unknown profile.id (matches prompts/index.ts behavior)', () => {
    // Mirrors getGenerators() in prompts/index.ts: unknown profile → Hydro default.
    // This supports custom profiles that extend a built-in methodology.
    const customProfile = { ...HYDRO_PROFILE, id: 'custom-extends-hydro' };
    const rendered = renderPrompt(customProfile, 'standup');
    const hydroExpected = renderPrompt(HYDRO_PROFILE, 'standup');
    // Content should be Hydro-style (built from customProfile's data but Hydro's generators)
    expect(rendered.text).toBe(hydroExpected.text);
  });

  it('empty ceremony name throws UnknownCeremonyError', () => {
    expect(() => renderPrompt(HYDRO_PROFILE, '')).toThrow(UnknownCeremonyError);
  });
});

// ---------------------------------------------------------------------------
// VALID_CEREMONIES export — covers all 8 ceremony names + legacy plan aliases
// ---------------------------------------------------------------------------

describe('renderPrompt — VALID_CEREMONIES surface', () => {
  it('includes all 8 canonical ceremony names', () => {
    for (const ceremony of ['standup', 'plan', 'board', 'compliance', 'health', 'retro', 'review', 'execute-task']) {
      expect(VALID_CEREMONIES).toContain(ceremony);
    }
  });

  it('includes legacy plan aliases for backward-compatible invocation', () => {
    expect(VALID_CEREMONIES).toContain('plan-wave');
    expect(VALID_CEREMONIES).toContain('plan-sprint');
    expect(VALID_CEREMONIES).toContain('plan-cycle');
  });

  it('does not include unknown names', () => {
    expect(VALID_CEREMONIES).not.toContain('demo');
    expect(VALID_CEREMONIES).not.toContain('show');
    expect(VALID_CEREMONIES).not.toContain('planContainer');
  });
});
