/**
 * Error handler — catches Ido4Error subtypes and maps to error responses.
 *
 * Used as an inline wrapper inside tool handlers, not as a function wrapper,
 * to preserve the SDK's typed callback signatures.
 */

import { Ido4Error } from '@ido4/core';
import { toErrorResult } from './response.js';

export async function handleErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Ido4Error) {
      return toErrorResult({
        message: error.message,
        code: error.code,
        remediation: error.remediation,
        retryable: error.retryable,
      }) as T;
    }
    return toErrorResult({
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    }) as T;
  }
}
