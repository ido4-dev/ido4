/**
 * Unified return type for all sanitizer methods.
 *
 * Every validation/sanitization returns this shape — no throwing, no nulls.
 */

export interface SanitizeResult<T> {
  readonly valid: boolean;
  readonly value: T;
  readonly error?: string;
}
