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
