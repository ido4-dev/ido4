/**
 * ToolResponse<T> — Canonical shape for all MCP tool responses.
 *
 * CLAUDE.md Rule 3: "Every tool response follows the {success, data, suggestions, warnings} shape."
 *
 * This is a governance concept, not a transport concern:
 * - `data` carries the domain payload
 * - `suggestions` guide agent next-actions
 * - `warnings` surface non-blocking issues
 * - `validationResult` and `auditEntry` are present on write operations
 *
 * Read operations return raw types; the MCP adapter wraps them trivially.
 * Write operations (transitions, assignments) include full governance metadata.
 */

import type { Suggestion, Warning, AuditEntry, AuditValidationResult } from '../container/interfaces.js';

export interface ToolResponse<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /**
   * Whether a state-changing transition committed to GitHub.
   *
   * Present on transition responses. Distinct from `success` — `success: false`
   * with `executed: false` means validation rejected the transition (no GitHub
   * mutation occurred); the response's `data.toStatus` and `auditEntry` describe
   * the *attempted* transition for diagnostic purposes, not a committed state
   * change.
   *
   * Hooks and audit consumers checking for committed transitions should test
   * `executed === true`, not `success === true`.
   *
   * Absent on read-only / non-transition responses (listTasks, getTask, etc.)
   * where the committed-or-not distinction is meaningless.
   */
  executed?: boolean;
  /** The domain-specific data payload */
  data: T;
  /** Suggested next actions for the agent */
  suggestions: Suggestion[];
  /** Non-blocking warnings or informational messages */
  warnings: Warning[];
  /** Validation pipeline results — present on write operations */
  validationResult?: AuditValidationResult;
  /** Audit trail entry — present on write operations */
  auditEntry?: AuditEntry;
}
