import { describe, it, expect } from 'vitest';
import { toCallToolResult, toErrorResult } from '../../src/helpers/response.js';

describe('toCallToolResult', () => {
  it('serializes data as JSON text content', () => {
    const result = toCallToolResult({ success: true, data: { id: 1 } });
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe('text');

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.success).toBe(true);
    expect(parsed.data.id).toBe(1);
  });

  it('does not set isError', () => {
    const result = toCallToolResult({ ok: true });
    expect(result.isError).toBeUndefined();
  });

  it('handles null', () => {
    const result = toCallToolResult(null);
    expect(JSON.parse(result.content[0]!.text)).toBeNull();
  });

  it('handles arrays', () => {
    const result = toCallToolResult([1, 2, 3]);
    expect(JSON.parse(result.content[0]!.text)).toEqual([1, 2, 3]);
  });

  it('pretty-prints with 2-space indent', () => {
    const result = toCallToolResult({ a: 1 });
    expect(result.content[0]!.text).toContain('\n');
    expect(result.content[0]!.text).toContain('  ');
  });
});

describe('toErrorResult', () => {
  it('sets isError to true', () => {
    const result = toErrorResult({ message: 'fail' });
    expect(result.isError).toBe(true);
  });

  it('serializes error details', () => {
    const result = toErrorResult({
      message: 'Not found',
      code: 'NOT_FOUND',
      remediation: 'Check the issue number',
    });
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.message).toBe('Not found');
    expect(parsed.code).toBe('NOT_FOUND');
    expect(parsed.remediation).toBe('Check the issue number');
  });

  it('includes retryable flag when provided', () => {
    const result = toErrorResult({
      message: 'Rate limited',
      code: 'RATE_LIMIT',
      retryable: true,
    });
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.retryable).toBe(true);
  });
});
