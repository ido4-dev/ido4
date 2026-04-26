import { describe, it, expect } from 'vitest';
import {
  formatIdo4LineageMarker,
  withLineageMarker,
  parseIdo4LineageMarker,
} from '../../../src/shared/utils/lineage-marker.js';

describe('lineage-marker', () => {
  describe('formatIdo4LineageMarker', () => {
    it('formats a task ref', () => {
      expect(formatIdo4LineageMarker('T-001')).toBe('<!-- ido4-lineage: ref=T-001 -->');
    });

    it('formats a capability ref with colon', () => {
      expect(formatIdo4LineageMarker('capability:Auth')).toBe(
        '<!-- ido4-lineage: ref=capability:Auth -->',
      );
    });
  });

  describe('withLineageMarker', () => {
    it('prepends marker above existing body with blank line', () => {
      const out = withLineageMarker('T-001', 'Body content here.');
      expect(out).toBe('<!-- ido4-lineage: ref=T-001 -->\n\nBody content here.');
    });

    it('returns marker only when body is empty', () => {
      expect(withLineageMarker('T-001', '')).toBe('<!-- ido4-lineage: ref=T-001 -->');
    });

    it('is idempotent — re-applying same ref does not duplicate', () => {
      const once = withLineageMarker('T-001', 'Body');
      const twice = withLineageMarker('T-001', once);
      expect(twice).toBe(once);
    });
  });

  describe('parseIdo4LineageMarker', () => {
    it('recovers a task ref from a body with marker on top', () => {
      const body = '<!-- ido4-lineage: ref=T-001 -->\n\nBody content.';
      expect(parseIdo4LineageMarker(body)).toEqual({ ref: 'T-001' });
    });

    it('recovers a capability ref', () => {
      const body = '<!-- ido4-lineage: ref=capability:Auth -->\n\nDescription';
      expect(parseIdo4LineageMarker(body)).toEqual({ ref: 'capability:Auth' });
    });

    it('returns null when no marker is present', () => {
      expect(parseIdo4LineageMarker('Plain body without marker.')).toEqual({ ref: null });
    });

    it('returns null on empty input', () => {
      expect(parseIdo4LineageMarker('')).toEqual({ ref: null });
    });

    it('tolerates extra whitespace inside the marker', () => {
      const body = '<!--   ido4-lineage:   ref=T-042   -->';
      expect(parseIdo4LineageMarker(body)).toEqual({ ref: 'T-042' });
    });

    it('does not match unrelated HTML comments', () => {
      const body = '<!-- ido4:context transition=start -->\nContent';
      expect(parseIdo4LineageMarker(body)).toEqual({ ref: null });
    });
  });
});
