import { describe, it, expect } from 'vitest';
import { FieldExtractor } from '../../../src/shared/utils/field-extractor.js';
import type { FieldValue } from '../../../src/shared/utils/field-extractor.js';

const sampleFieldValues: FieldValue[] = [
  { field: { name: 'Status', id: 'f1' }, name: 'In Progress' },
  { field: { name: 'Wave', id: 'f2' }, text: 'wave-001' },
  { field: { name: 'Epic', id: 'f3' }, text: 'Epic-Auth' },
  { field: { name: 'Dependencies', id: 'f4' }, text: '#123 (Done), #124 (In Progress)' },
  { field: { name: 'AI Suitability', id: 'f5' }, name: 'ai-only' },
  { field: { name: 'Risk Level', id: 'f6' }, name: 'Medium' },
  { field: { name: 'Effort', id: 'f7' }, name: 'Large', number: 8 },
  { field: { name: 'AI Context', id: 'f8' }, text: 'Implementation context here' },
  { field: { name: 'Due Date', id: 'f9' }, date: '2025-06-15' },
];

describe('FieldExtractor', () => {
  describe('getFieldValue', () => {
    it('extracts text field (text priority)', () => {
      expect(FieldExtractor.getFieldValue(sampleFieldValues, 'Wave')).toBe('wave-001');
    });

    it('extracts name field when text is absent', () => {
      expect(FieldExtractor.getFieldValue(sampleFieldValues, 'Status')).toBe('In Progress');
    });

    it('is case-insensitive', () => {
      expect(FieldExtractor.getFieldValue(sampleFieldValues, 'status')).toBe('In Progress');
      expect(FieldExtractor.getFieldValue(sampleFieldValues, 'STATUS')).toBe('In Progress');
      expect(FieldExtractor.getFieldValue(sampleFieldValues, 'wave')).toBe('wave-001');
    });

    it('returns undefined for missing fields', () => {
      expect(FieldExtractor.getFieldValue(sampleFieldValues, 'NonExistent')).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(FieldExtractor.getFieldValue([], 'Status')).toBeUndefined();
    });

    it('prefers text over name over value', () => {
      const fields: FieldValue[] = [
        { field: { name: 'Test' }, text: 'from-text', name: 'from-name', value: 'from-value' },
      ];
      expect(FieldExtractor.getFieldValue(fields, 'Test')).toBe('from-text');

      const noText: FieldValue[] = [
        { field: { name: 'Test' }, name: 'from-name', value: 'from-value' },
      ];
      expect(FieldExtractor.getFieldValue(noText, 'Test')).toBe('from-name');

      const onlyValue: FieldValue[] = [
        { field: { name: 'Test' }, value: 'from-value' },
      ];
      expect(FieldExtractor.getFieldValue(onlyValue, 'Test')).toBe('from-value');
    });
  });

  describe('getNumericFieldValue', () => {
    it('extracts numeric value', () => {
      expect(FieldExtractor.getNumericFieldValue(sampleFieldValues, 'Effort')).toBe(8);
    });

    it('returns undefined for non-numeric fields', () => {
      expect(FieldExtractor.getNumericFieldValue(sampleFieldValues, 'Status')).toBeUndefined();
    });

    it('returns undefined for missing fields', () => {
      expect(FieldExtractor.getNumericFieldValue(sampleFieldValues, 'NotHere')).toBeUndefined();
    });
  });

  describe('getDateFieldValue', () => {
    it('extracts date value', () => {
      expect(FieldExtractor.getDateFieldValue(sampleFieldValues, 'Due Date')).toBe('2025-06-15');
    });

    it('returns undefined for non-date fields', () => {
      expect(FieldExtractor.getDateFieldValue(sampleFieldValues, 'Status')).toBeUndefined();
    });
  });

  describe('getMultipleFieldValues', () => {
    it('extracts multiple fields at once', () => {
      const result = FieldExtractor.getMultipleFieldValues(sampleFieldValues, ['Status', 'Wave', 'Missing']);
      expect(result['Status']).toBe('In Progress');
      expect(result['Wave']).toBe('wave-001');
      expect(result['Missing']).toBeUndefined();
    });
  });

  describe('hasFieldValue', () => {
    it('returns true for existing non-empty fields', () => {
      expect(FieldExtractor.hasFieldValue(sampleFieldValues, 'Status')).toBe(true);
    });

    it('returns false for missing fields', () => {
      expect(FieldExtractor.hasFieldValue(sampleFieldValues, 'Missing')).toBe(false);
    });

    it('returns false for empty string values', () => {
      const fields: FieldValue[] = [{ field: { name: 'Empty' }, text: '' }];
      expect(FieldExtractor.hasFieldValue(fields, 'Empty')).toBe(false);
    });
  });

  describe('getFieldNames', () => {
    it('returns all unique field names', () => {
      const names = FieldExtractor.getFieldNames(sampleFieldValues);
      expect(names).toContain('Status');
      expect(names).toContain('Wave');
      expect(names).toContain('Epic');
      expect(names.length).toBe(9);
    });

    it('deduplicates field names', () => {
      const fields: FieldValue[] = [
        { field: { name: 'Status' }, name: 'A' },
        { field: { name: 'Status' }, name: 'B' },
      ];
      expect(FieldExtractor.getFieldNames(fields)).toEqual(['Status']);
    });

    it('skips entries without field name', () => {
      const fields: FieldValue[] = [{ text: 'orphan' }, { field: { id: 'x' } }];
      expect(FieldExtractor.getFieldNames(fields)).toEqual([]);
    });
  });

  describe('extractCommonFields', () => {
    it('extracts all standard project fields', () => {
      const common = FieldExtractor.extractCommonFields(sampleFieldValues);
      expect(common.status).toBe('In Progress');
      expect(common.containers['wave']).toBe('wave-001');
      expect(common.containers['epic']).toBe('Epic-Auth');
      expect(common.dependencies).toBe('#123 (Done), #124 (In Progress)');
      expect(common.aiSuitability).toBe('ai-only');
      expect(common.riskLevel).toBe('Medium');
      expect(common.effort).toBe('Large');
      expect(common.aiContext).toBe('Implementation context here');
    });

    it('returns undefined for missing fields', () => {
      const common = FieldExtractor.extractCommonFields([]);
      expect(common.status).toBeUndefined();
      expect(common.containers['wave']).toBeUndefined();
      expect(common.containers['epic']).toBeUndefined();
    });
  });
});
