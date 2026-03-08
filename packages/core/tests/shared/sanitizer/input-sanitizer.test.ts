import { describe, it, expect } from 'vitest';
import { InputSanitizer } from '../../../src/shared/sanitizer/input-sanitizer.js';

describe('InputSanitizer', () => {
  describe('sanitizeIssueNumber', () => {
    it('accepts valid positive integers', () => {
      expect(InputSanitizer.sanitizeIssueNumber(42)).toEqual({ valid: true, value: 42 });
      expect(InputSanitizer.sanitizeIssueNumber(1)).toEqual({ valid: true, value: 1 });
      expect(InputSanitizer.sanitizeIssueNumber(999999)).toEqual({ valid: true, value: 999999 });
    });

    it('accepts valid numeric strings', () => {
      expect(InputSanitizer.sanitizeIssueNumber('42')).toEqual({ valid: true, value: 42 });
      expect(InputSanitizer.sanitizeIssueNumber(' 123 ')).toEqual({ valid: true, value: 123 });
    });

    it('rejects zero', () => {
      expect(InputSanitizer.sanitizeIssueNumber(0).valid).toBe(false);
    });

    it('rejects negative numbers', () => {
      expect(InputSanitizer.sanitizeIssueNumber(-1).valid).toBe(false);
    });

    it('rejects floats', () => {
      expect(InputSanitizer.sanitizeIssueNumber(1.5).valid).toBe(false);
    });

    it('rejects numbers exceeding max', () => {
      expect(InputSanitizer.sanitizeIssueNumber(1000000).valid).toBe(false);
    });

    it('rejects non-numeric strings', () => {
      expect(InputSanitizer.sanitizeIssueNumber('abc').valid).toBe(false);
      expect(InputSanitizer.sanitizeIssueNumber('12abc').valid).toBe(false);
    });

    it('rejects null and undefined', () => {
      expect(InputSanitizer.sanitizeIssueNumber(null).valid).toBe(false);
      expect(InputSanitizer.sanitizeIssueNumber(undefined).valid).toBe(false);
    });

    it('rejects overly long strings', () => {
      expect(InputSanitizer.sanitizeIssueNumber('12345678901').valid).toBe(false);
    });
  });

  describe('sanitizeBranchName', () => {
    it('passes valid branch names through', () => {
      expect(InputSanitizer.sanitizeBranchName('feature/auth-system')).toEqual({ valid: true, value: 'feature/auth-system' });
    });

    it('strips invalid git ref characters', () => {
      const result = InputSanitizer.sanitizeBranchName('feature~auth^system');
      expect(result.valid).toBe(true);
      expect(result.value).not.toContain('~');
      expect(result.value).not.toContain('^');
    });

    it('blocks path traversal', () => {
      expect(InputSanitizer.sanitizeBranchName('feature/../main').valid).toBe(false);
    });

    it('removes .lock suffix', () => {
      const result = InputSanitizer.sanitizeBranchName('feature.lock');
      expect(result.valid).toBe(true);
      expect(result.value).not.toMatch(/\.lock$/);
    });

    it('collapses consecutive dashes', () => {
      const result = InputSanitizer.sanitizeBranchName('feature---auth');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('feature-auth');
    });

    it('truncates to max length', () => {
      const long = 'a'.repeat(200);
      const result = InputSanitizer.sanitizeBranchName(long);
      expect(result.valid).toBe(true);
      expect(result.value.length).toBeLessThanOrEqual(100);
    });

    it('rejects empty input', () => {
      expect(InputSanitizer.sanitizeBranchName('').valid).toBe(false);
    });
  });

  describe('validateProjectId', () => {
    it('accepts valid project IDs', () => {
      expect(InputSanitizer.validateProjectId('PVT_abc123').valid).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(InputSanitizer.validateProjectId('invalid').valid).toBe(false);
      expect(InputSanitizer.validateProjectId('pvt_lower').valid).toBe(false);
    });
  });

  describe('validateFieldId', () => {
    it('accepts valid field IDs', () => {
      expect(InputSanitizer.validateFieldId('PVTF_abc123').valid).toBe(true);
      expect(InputSanitizer.validateFieldId('PVTSF_abc123').valid).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(InputSanitizer.validateFieldId('PVTI_wrong').valid).toBe(false);
    });
  });

  describe('validateItemId', () => {
    it('accepts valid item IDs', () => {
      expect(InputSanitizer.validateItemId('PVTI_abc123').valid).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(InputSanitizer.validateItemId('PVT_wrong').valid).toBe(false);
    });
  });

  describe('validateContainerFormat', () => {
    it('accepts valid wave formats', () => {
      expect(InputSanitizer.validateContainerFormat('wave-001-auth-system').valid).toBe(true);
      expect(InputSanitizer.validateContainerFormat('wave-042-simple').valid).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(InputSanitizer.validateContainerFormat('wave-1-test').valid).toBe(false);
      expect(InputSanitizer.validateContainerFormat('not-a-wave').valid).toBe(false);
      expect(InputSanitizer.validateContainerFormat('wave-001-UPPERCASE').valid).toBe(false);
    });
  });

  describe('validateRepositoryName', () => {
    it('accepts valid owner/repo format', () => {
      expect(InputSanitizer.validateRepositoryName('owner/repo').valid).toBe(true);
      expect(InputSanitizer.validateRepositoryName('my-org/my-repo.js').valid).toBe(true);
    });

    it('rejects missing owner or repo', () => {
      expect(InputSanitizer.validateRepositoryName('justname').valid).toBe(false);
      expect(InputSanitizer.validateRepositoryName('/repo').valid).toBe(false);
    });

    it('rejects overly long owner names', () => {
      const longOwner = 'a'.repeat(40) + '/repo';
      expect(InputSanitizer.validateRepositoryName(longOwner).valid).toBe(false);
    });

    it('rejects overly long repo names', () => {
      const longRepo = 'owner/' + 'a'.repeat(101);
      expect(InputSanitizer.validateRepositoryName(longRepo).valid).toBe(false);
    });
  });

  describe('sanitizeFilePath', () => {
    it('accepts valid absolute paths', () => {
      expect(InputSanitizer.sanitizeFilePath('/usr/local/bin/test').valid).toBe(true);
    });

    it('rejects relative paths', () => {
      expect(InputSanitizer.sanitizeFilePath('relative/path').valid).toBe(false);
    });

    it('blocks path traversal', () => {
      expect(InputSanitizer.sanitizeFilePath('/etc/../passwd').valid).toBe(false);
    });

    it('blocks null bytes', () => {
      expect(InputSanitizer.sanitizeFilePath('/etc/\0passwd').valid).toBe(false);
    });

    it('blocks tilde paths', () => {
      expect(InputSanitizer.sanitizeFilePath('~/Desktop').valid).toBe(false);
    });

    it('rejects overly long paths', () => {
      const long = '/' + 'a'.repeat(4096);
      expect(InputSanitizer.sanitizeFilePath(long).valid).toBe(false);
    });
  });

  describe('sanitizeFileName', () => {
    it('accepts valid filenames', () => {
      expect(InputSanitizer.sanitizeFileName('report.pdf').valid).toBe(true);
    });

    it('blocks path separators', () => {
      expect(InputSanitizer.sanitizeFileName('dir/file.txt').valid).toBe(false);
      expect(InputSanitizer.sanitizeFileName('dir\\file.txt').valid).toBe(false);
    });

    it('blocks null bytes', () => {
      expect(InputSanitizer.sanitizeFileName('file\0.txt').valid).toBe(false);
    });

    it('blocks Windows reserved names', () => {
      expect(InputSanitizer.sanitizeFileName('CON.txt').valid).toBe(false);
      expect(InputSanitizer.sanitizeFileName('NUL').valid).toBe(false);
      expect(InputSanitizer.sanitizeFileName('COM1.log').valid).toBe(false);
    });
  });

  describe('sanitizeWaveName', () => {
    it('accepts valid wave names', () => {
      expect(InputSanitizer.sanitizeWaveName('wave-001').valid).toBe(true);
      expect(InputSanitizer.sanitizeWaveName('wave-001-auth').valid).toBe(true);
    });

    it('blocks path traversal', () => {
      expect(InputSanitizer.sanitizeWaveName('wave..001').valid).toBe(false);
    });

    it('blocks slashes', () => {
      expect(InputSanitizer.sanitizeWaveName('wave/001').valid).toBe(false);
    });

    it('blocks reserved names', () => {
      expect(InputSanitizer.sanitizeWaveName('main').valid).toBe(false);
      expect(InputSanitizer.sanitizeWaveName('master').valid).toBe(false);
      expect(InputSanitizer.sanitizeWaveName('develop').valid).toBe(false);
    });
  });

  describe('sanitizeTextValue', () => {
    it('passes clean text through', () => {
      expect(InputSanitizer.sanitizeTextValue('Hello world')).toEqual({ valid: true, value: 'Hello world' });
    });

    it('strips control characters', () => {
      const result = InputSanitizer.sanitizeTextValue('Hello\x00World');
      expect(result.valid).toBe(true);
      expect(result.value).not.toContain('\x00');
    });

    it('preserves newlines and tabs', () => {
      const result = InputSanitizer.sanitizeTextValue('Line1\nLine2\tTabbed');
      expect(result.valid).toBe(true);
      expect(result.value).toContain('\n');
      expect(result.value).toContain('\t');
    });

    it('truncates to max length', () => {
      const long = 'x'.repeat(6000);
      const result = InputSanitizer.sanitizeTextValue(long);
      expect(result.valid).toBe(true);
      expect(result.value.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('sanitizeCommentText', () => {
    it('accepts valid comments', () => {
      expect(InputSanitizer.sanitizeCommentText('Great work!').valid).toBe(true);
    });

    it('truncates to GitHub limit', () => {
      const long = 'x'.repeat(70000);
      const result = InputSanitizer.sanitizeCommentText(long);
      expect(result.valid).toBe(true);
      expect(result.value.length).toBeLessThanOrEqual(65536);
    });
  });

  describe('validateWorkflowStatus', () => {
    it('accepts valid status without config', () => {
      expect(InputSanitizer.validateWorkflowStatus('In Progress').valid).toBe(true);
    });

    it('validates against provided statuses', () => {
      const statuses = ['Backlog', 'In Progress', 'Done'];
      expect(InputSanitizer.validateWorkflowStatus('In Progress', statuses).valid).toBe(true);
      expect(InputSanitizer.validateWorkflowStatus('Invalid', statuses).valid).toBe(false);
    });

    it('is case-insensitive when validating', () => {
      const statuses = ['In Progress'];
      const result = InputSanitizer.validateWorkflowStatus('in progress', statuses);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('In Progress');
    });
  });

  describe('sanitizeRepositoryReference', () => {
    it('accepts valid repository references', () => {
      expect(InputSanitizer.sanitizeRepositoryReference('owner/repo').valid).toBe(true);
    });

    it('blocks shell metacharacters', () => {
      expect(InputSanitizer.sanitizeRepositoryReference('owner/re$po').valid).toBe(false);
      expect(InputSanitizer.sanitizeRepositoryReference('owner/re`po').valid).toBe(false);
    });
  });

  describe('all methods return SanitizeResult shape', () => {
    it('valid results have valid=true and a value', () => {
      const result = InputSanitizer.sanitizeIssueNumber(42);
      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('value', 42);
      expect(result.error).toBeUndefined();
    });

    it('invalid results have valid=false and an error', () => {
      const result = InputSanitizer.sanitizeIssueNumber(-1);
      expect(result).toHaveProperty('valid', false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });
  });
});
