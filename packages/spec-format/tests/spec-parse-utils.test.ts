import { describe, it, expect } from 'vitest';
import { derivePrefix, parseMetadataLine } from '../src/spec-parse-utils.js';

// The downstream task-ref pattern. derivePrefix output that violates this
// would, when used to generate new task refs (e.g. by ido4specs), produce
// headings that fail the technical-spec parser.
const TASK_REF_PREFIX = /^[A-Z]{2,5}$/;

describe('derivePrefix', () => {
  describe('basic cases (preserved behavior)', () => {
    it('returns first 3 letters uppercased for a single word', () => {
      expect(derivePrefix('Preferences')).toBe('PRE');
    });

    it('returns initials uppercased for two words', () => {
      expect(derivePrefix('Notification Core')).toBe('NC');
      expect(derivePrefix('Email Channel')).toBe('EC');
    });

    it('handles arbitrary whitespace between words', () => {
      expect(derivePrefix('Notification   Core')).toBe('NC');
      expect(derivePrefix('  Email\tChannel  ')).toBe('EC');
    });

    it('uppercases lowercase input', () => {
      expect(derivePrefix('notification core')).toBe('NC');
    });
  });

  describe('non-letter characters as separators', () => {
    it('treats em-dash as a separator, not a word', () => {
      expect(derivePrefix('Warehouse Foundation — Views and Pricing Tables')).toBe('WFVAP');
    });

    it('treats en-dash as a separator', () => {
      expect(derivePrefix('Foo – Bar Baz')).toBe('FBB');
    });

    it('treats hyphens as separators', () => {
      expect(derivePrefix('Foo-Bar-Baz')).toBe('FBB');
    });

    it('treats commas as separators', () => {
      expect(derivePrefix('Foo, Bar, Baz')).toBe('FBB');
    });

    it('treats slashes as separators', () => {
      expect(derivePrefix('Foo/Bar/Baz')).toBe('FBB');
    });

    it('strips digits from prefix derivation', () => {
      // "V1 Catalog — 10 RPCs" → words ["V", "Catalog", "RPCs"] → "VCR"
      expect(derivePrefix('V1 Catalog — 10 RPCs')).toBe('VCR');
    });
  });

  describe('length cap', () => {
    it('caps multi-word prefix at 5 characters', () => {
      expect(derivePrefix('Documentation and Developer Experience')).toBe('DADE');
      expect(derivePrefix('Alpha Beta Gamma Delta Epsilon Zeta')).toBe('ABGDE');
    });

    it('caps multi-word prefix at exactly 5 even with many separators', () => {
      // Six words: "Foo Bar Baz Qux Quux Corge" → "FBBQQC" → cap to "FBBQQ"
      expect(derivePrefix('Foo Bar Baz Qux Quux Corge')).toBe('FBBQQ');
    });
  });

  describe('edge cases', () => {
    it('returns GRP fallback for all-symbol input', () => {
      expect(derivePrefix('—')).toBe('GRP');
      expect(derivePrefix('123')).toBe('GRP');
      expect(derivePrefix('---')).toBe('GRP');
    });

    it('returns GRP fallback for empty string', () => {
      expect(derivePrefix('')).toBe('GRP');
      expect(derivePrefix('   ')).toBe('GRP');
    });

    it('handles single 1-letter word', () => {
      expect(derivePrefix('A')).toBe('A');
    });

    it('handles single 2-letter word', () => {
      expect(derivePrefix('Hi')).toBe('HI');
    });
  });

  describe('contract: every output for a realistic group title satisfies [A-Z]{2,5}', () => {
    // The contract only holds for inputs with at least 2 letters total —
    // single-letter group names are not realistic spec authoring and produce
    // a 1-char prefix as preexisting behavior.
    const inputs = [
      'Notification Core',
      'Email Channel',
      'Preferences',
      'Warehouse Foundation — Views and Pricing Tables',
      'Saved Metabase Questions — V1 Catalog Backing',
      'V1 Catalog — 10 RPCs',
      'Documentation and Developer Experience',
      'Foo, Bar, Baz, Qux, Quux, Corge, Garply',
      'a-b-c-d-e-f-g',
      'Hi',
      '—',
      '   ',
      'mixed CASE words',
    ];

    for (const input of inputs) {
      it(`derivePrefix(${JSON.stringify(input)}) satisfies the contract`, () => {
        expect(derivePrefix(input)).toMatch(TASK_REF_PREFIX);
      });
    }
  });
});

describe('parseMetadataLine', () => {
  it('parses a single key-value pair', () => {
    expect(parseMetadataLine('priority: must-have')).toEqual({
      priority: 'must-have',
    });
  });

  it('parses multiple pipe-delimited pairs', () => {
    expect(parseMetadataLine('size: M | risk: low | type: feature')).toEqual({
      size: 'M',
      risk: 'low',
      type: 'feature',
    });
  });

  it('trims whitespace around keys and values', () => {
    expect(parseMetadataLine('  size:  M  |  risk: low  ')).toEqual({
      size: 'M',
      risk: 'low',
    });
  });

  it('returns empty object for non-metadata content', () => {
    expect(parseMetadataLine('this is just prose')).toEqual({});
  });
});
