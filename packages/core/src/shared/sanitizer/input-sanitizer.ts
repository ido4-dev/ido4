/**
 * InputSanitizer — Static validation and sanitization for all user inputs.
 *
 * Every method returns SanitizeResult<T> — no throwing, no null returns.
 *
 * Changes from CLI:
 * - Unified return type (SanitizeResult<T>) across all methods
 * - Uses scaffold's ValidationError (not local duplicate)
 * - Dropped CLI-only: validateProjectInitInput, sanitizeScenarioType, sanitizeAIAssistantType
 * - Consolidated validateIssueNumber + sanitizeIssueNumber into single sanitizeIssueNumber
 */

import type { SanitizeResult } from './types.js';

const MAX_ISSUE_NUMBER = 999_999;
const MAX_BRANCH_LENGTH = 100;
const MAX_TEXT_LENGTH = 5_000;
const MAX_COMMENT_LENGTH = 65_536;
const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_FIELD_NAME_LENGTH = 50;
const MAX_FIELD_OPTION_LENGTH = 30;
const MAX_FILE_PATH_LENGTH = 4_096;
const MAX_FILE_NAME_LENGTH = 255;
const MAX_WAVE_NAME_LENGTH = 100;
const MAX_REPO_OWNER_LENGTH = 39;
const MAX_REPO_NAME_LENGTH = 100;

const PROJECT_ID_PATTERN = /^PVT_[a-zA-Z0-9_-]+$/;
const FIELD_ID_PATTERN = /^PVT[A-Z]*F_[a-zA-Z0-9_-]+$/;
const ITEM_ID_PATTERN = /^PVTI_[a-zA-Z0-9_-]+$/;
const CONTAINER_FORMAT_PATTERN = /^wave-\d{3}-[a-z0-9-]+$/;
const REPO_NAME_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

const RESERVED_BRANCH_NAMES = new Set([
  'main', 'master', 'develop', 'dev', 'staging', 'production', 'prod',
  'release', 'hotfix', 'HEAD',
]);

export class InputSanitizer {
  /**
   * Validate and sanitize an issue number.
   * Accepts number or string input, returns validated number.
   */
  static sanitizeIssueNumber(input: unknown): SanitizeResult<number> {
    if (input === undefined || input === null) {
      return { valid: false, value: 0, error: 'Issue number is required' };
    }

    let num: number;
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.length > 10 || !/^\d+$/.test(trimmed)) {
        return { valid: false, value: 0, error: 'Issue number must be a positive integer' };
      }
      num = parseInt(trimmed, 10);
    } else if (typeof input === 'number') {
      num = input;
    } else {
      return { valid: false, value: 0, error: 'Issue number must be a number or numeric string' };
    }

    if (!Number.isInteger(num) || num < 1 || num > MAX_ISSUE_NUMBER) {
      return { valid: false, value: 0, error: `Issue number must be between 1 and ${MAX_ISSUE_NUMBER}` };
    }

    return { valid: true, value: num };
  }

  /** Sanitize a git branch name. */
  static sanitizeBranchName(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Branch name is required' };
    }

    let sanitized = input.trim();

    // Block path traversal
    if (sanitized.includes('..')) {
      return { valid: false, value: '', error: 'Branch name cannot contain ".."' };
    }

    // Strip invalid git ref chars
    sanitized = sanitized.replace(/[\x00-\x1f\x7f ~^:?*\[\\]/g, '-');

    // Collapse consecutive dashes and slashes
    sanitized = sanitized.replace(/-{2,}/g, '-');
    sanitized = sanitized.replace(/\/{2,}/g, '/');

    // Remove leading/trailing dashes and slashes
    sanitized = sanitized.replace(/^[-/]+|[-/]+$/g, '');

    // Strip .lock suffix
    sanitized = sanitized.replace(/\.lock$/i, '');

    if (sanitized.length === 0) {
      return { valid: false, value: '', error: 'Branch name is empty after sanitization' };
    }

    if (sanitized.length > MAX_BRANCH_LENGTH) {
      sanitized = sanitized.slice(0, MAX_BRANCH_LENGTH);
    }

    return { valid: true, value: sanitized };
  }

  /** Sanitize a general text value. */
  static sanitizeTextValue(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Text value is required' };
    }

    // Strip control characters (except newline, tab)
    let sanitized = input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

    if (sanitized.length > MAX_TEXT_LENGTH) {
      sanitized = sanitized.slice(0, MAX_TEXT_LENGTH);
    }

    return { valid: true, value: sanitized };
  }

  /** Validate a GitHub Projects V2 project ID. */
  static validateProjectId(projectId: string): SanitizeResult<string> {
    if (!projectId || typeof projectId !== 'string') {
      return { valid: false, value: '', error: 'Project ID is required' };
    }

    if (!PROJECT_ID_PATTERN.test(projectId)) {
      return { valid: false, value: projectId, error: 'Project ID must match format PVT_...' };
    }

    return { valid: true, value: projectId };
  }

  /** Validate a GitHub Projects V2 field ID. */
  static validateFieldId(fieldId: string): SanitizeResult<string> {
    if (!fieldId || typeof fieldId !== 'string') {
      return { valid: false, value: '', error: 'Field ID is required' };
    }

    if (!FIELD_ID_PATTERN.test(fieldId)) {
      return { valid: false, value: fieldId, error: 'Field ID must match format PVTF_... or PVTSF_...' };
    }

    return { valid: true, value: fieldId };
  }

  /** Validate a GitHub Projects V2 item ID. */
  static validateItemId(itemId: string): SanitizeResult<string> {
    if (!itemId || typeof itemId !== 'string') {
      return { valid: false, value: '', error: 'Item ID is required' };
    }

    if (!ITEM_ID_PATTERN.test(itemId)) {
      return { valid: false, value: itemId, error: 'Item ID must match format PVTI_...' };
    }

    return { valid: true, value: itemId };
  }

  /** Validate wave format (wave-NNN-description). */
  static validateContainerFormat(waveName: string): SanitizeResult<string> {
    if (!waveName || typeof waveName !== 'string') {
      return { valid: false, value: '', error: 'Wave name is required' };
    }

    if (!CONTAINER_FORMAT_PATTERN.test(waveName)) {
      return { valid: false, value: waveName, error: 'Wave name must match format wave-NNN-description (e.g., wave-001-auth-system)' };
    }

    return { valid: true, value: waveName };
  }

  /** Sanitize a GitHub issue comment. */
  static sanitizeCommentText(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Comment text is required' };
    }

    // Strip control characters (except newline, tab, carriage return)
    let sanitized = input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');

    if (sanitized.length > MAX_COMMENT_LENGTH) {
      sanitized = sanitized.slice(0, MAX_COMMENT_LENGTH);
    }

    return { valid: true, value: sanitized };
  }

  /** Validate a workflow status value. */
  static validateWorkflowStatus(status: string, validStatuses?: readonly string[]): SanitizeResult<string> {
    if (!status || typeof status !== 'string') {
      return { valid: false, value: '', error: 'Status is required' };
    }

    const trimmed = status.trim();

    if (validStatuses && validStatuses.length > 0) {
      const found = validStatuses.find((s) => s.toLowerCase() === trimmed.toLowerCase());
      if (!found) {
        return { valid: false, value: trimmed, error: `Invalid status "${trimmed}". Valid: ${validStatuses.join(', ')}` };
      }
      return { valid: true, value: found };
    }

    return { valid: true, value: trimmed };
  }

  /** Validate a repository name (owner/repo format). */
  static validateRepositoryName(repo: string): SanitizeResult<string> {
    if (!repo || typeof repo !== 'string') {
      return { valid: false, value: '', error: 'Repository name is required' };
    }

    const trimmed = repo.trim();
    if (!REPO_NAME_PATTERN.test(trimmed)) {
      return { valid: false, value: trimmed, error: 'Repository must be in owner/repo format' };
    }

    const parts = trimmed.split('/');
    const owner = parts[0];
    const name = parts[1];
    if (!owner || !name) {
      return { valid: false, value: trimmed, error: 'Repository must have both owner and name' };
    }

    if (owner.length > MAX_REPO_OWNER_LENGTH) {
      return { valid: false, value: trimmed, error: `Owner name must be ${MAX_REPO_OWNER_LENGTH} characters or fewer` };
    }

    if (name.length > MAX_REPO_NAME_LENGTH) {
      return { valid: false, value: trimmed, error: `Repository name must be ${MAX_REPO_NAME_LENGTH} characters or fewer` };
    }

    return { valid: true, value: trimmed };
  }

  /** Sanitize a project name. */
  static sanitizeProjectName(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Project name is required' };
    }

    let sanitized = input.trim();
    // Collapse whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    if (sanitized.length > MAX_PROJECT_NAME_LENGTH) {
      sanitized = sanitized.slice(0, MAX_PROJECT_NAME_LENGTH);
    }

    if (sanitized.length === 0) {
      return { valid: false, value: '', error: 'Project name is empty after sanitization' };
    }

    return { valid: true, value: sanitized };
  }

  /** Sanitize a field name. */
  static sanitizeFieldName(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Field name is required' };
    }

    let sanitized = input.trim();
    if (sanitized.length > MAX_FIELD_NAME_LENGTH) {
      sanitized = sanitized.slice(0, MAX_FIELD_NAME_LENGTH);
    }

    if (sanitized.length === 0) {
      return { valid: false, value: '', error: 'Field name is empty after sanitization' };
    }

    return { valid: true, value: sanitized };
  }

  /** Sanitize a field option value. */
  static sanitizeFieldOption(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Field option is required' };
    }

    let sanitized = input.trim();
    if (sanitized.length > MAX_FIELD_OPTION_LENGTH) {
      sanitized = sanitized.slice(0, MAX_FIELD_OPTION_LENGTH);
    }

    if (sanitized.length === 0) {
      return { valid: false, value: '', error: 'Field option is empty after sanitization' };
    }

    return { valid: true, value: sanitized };
  }

  /**
   * Sanitize a file path.
   * Must be absolute. Blocks path traversal (..), null bytes, and ~.
   */
  static sanitizeFilePath(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'File path is required' };
    }

    if (input.includes('\0')) {
      return { valid: false, value: '', error: 'File path cannot contain null bytes' };
    }

    if (input.includes('..')) {
      return { valid: false, value: '', error: 'File path cannot contain path traversal (..)' };
    }

    if (input.startsWith('~')) {
      return { valid: false, value: '', error: 'File path cannot start with ~ (use absolute path)' };
    }

    if (!input.startsWith('/')) {
      return { valid: false, value: '', error: 'File path must be absolute (start with /)' };
    }

    if (input.length > MAX_FILE_PATH_LENGTH) {
      return { valid: false, value: '', error: `File path must be ${MAX_FILE_PATH_LENGTH} characters or fewer` };
    }

    return { valid: true, value: input };
  }

  /**
   * Sanitize a file name (not a path).
   * Blocks separators, control chars, Windows reserved names.
   */
  static sanitizeFileName(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'File name is required' };
    }

    if (input.includes('\0')) {
      return { valid: false, value: '', error: 'File name cannot contain null bytes' };
    }

    // Block path separators
    if (input.includes('/') || input.includes('\\')) {
      return { valid: false, value: '', error: 'File name cannot contain path separators' };
    }

    // Strip control characters
    let sanitized = input.replace(/[\x00-\x1f\x7f]/g, '');

    // Check Windows reserved names
    const baseName = sanitized.split('.')[0]?.toLowerCase() ?? '';
    if (WINDOWS_RESERVED_NAMES.has(baseName)) {
      return { valid: false, value: '', error: `"${baseName}" is a reserved file name` };
    }

    if (sanitized.length > MAX_FILE_NAME_LENGTH) {
      sanitized = sanitized.slice(0, MAX_FILE_NAME_LENGTH);
    }

    if (sanitized.length === 0) {
      return { valid: false, value: '', error: 'File name is empty after sanitization' };
    }

    return { valid: true, value: sanitized };
  }

  /**
   * Sanitize a wave name for branch/label use.
   * Alphanumeric + -_. only. Blocks reserved names, path traversal, slashes.
   */
  static sanitizeWaveName(input: string): SanitizeResult<string> {
    if (!input || typeof input !== 'string') {
      return { valid: false, value: '', error: 'Wave name is required' };
    }

    const trimmed = input.trim();

    if (trimmed.includes('..')) {
      return { valid: false, value: '', error: 'Wave name cannot contain ".."' };
    }

    if (trimmed.includes('/')) {
      return { valid: false, value: '', error: 'Wave name cannot contain "/"' };
    }

    // Only allow alphanumeric, dash, underscore, dot
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(trimmed) && trimmed.length > 1) {
      return { valid: false, value: '', error: 'Wave name must start and end with alphanumeric characters' };
    }

    if (trimmed.length === 1 && !/^[a-zA-Z0-9]$/.test(trimmed)) {
      return { valid: false, value: '', error: 'Wave name must be alphanumeric' };
    }

    if (RESERVED_BRANCH_NAMES.has(trimmed.toLowerCase())) {
      return { valid: false, value: '', error: `"${trimmed}" is a reserved name` };
    }

    if (trimmed.length > MAX_WAVE_NAME_LENGTH) {
      return { valid: false, value: '', error: `Wave name must be ${MAX_WAVE_NAME_LENGTH} characters or fewer` };
    }

    return { valid: true, value: trimmed };
  }

  /** Sanitize a repository reference for shell safety. */
  static sanitizeRepositoryReference(input: string): SanitizeResult<string> {
    const repoResult = InputSanitizer.validateRepositoryName(input);
    if (!repoResult.valid) return repoResult;

    // Block shell metacharacters
    if (/[<>:"'|?*\\$`{}()]/.test(repoResult.value)) {
      return { valid: false, value: '', error: 'Repository reference contains unsafe characters' };
    }

    return repoResult;
  }
}
