/**
 * Merge readiness gate types — structured pass/fail for CI/CD governance enforcement.
 */

export interface MergeCheck {
  name: string;
  passed: boolean;
  severity: 'error' | 'warning';
  detail: string;
  remediation?: string;
}

export interface MergeReadinessResult {
  ready: boolean;
  checks: MergeCheck[];
  overrideAvailable: boolean;
  overrideConsequences?: string;
  overrideApplied: boolean;
}
