/**
 * SecurityScanValidation — Checks for open vulnerability alerts on the repository.
 *
 * Quality gate: verifies the repository has no critical/high security vulnerabilities.
 */

import type { ValidationStep, ValidationStepResult, ValidationContext } from '../types.js';
import type { IRepositoryRepository } from '../../../container/interfaces.js';

export class SecurityScanValidation implements ValidationStep {
  readonly name = 'SecurityScanValidation';

  constructor(
    private readonly repositoryRepository: IRepositoryRepository,
    private readonly maxCriticalAlerts: number = 0,
  ) {}

  async validate(_context: ValidationContext): Promise<ValidationStepResult> {
    let alerts;
    try {
      alerts = await this.repositoryRepository.getVulnerabilityAlerts();
    } catch {
      // If the API fails (e.g., permissions), treat as warning not blocker
      return {
        stepName: this.name,
        passed: true,
        message: 'Unable to check vulnerability alerts (may require additional permissions)',
        severity: 'warning',
      };
    }

    const criticalAlerts = alerts.filter((a) =>
      a.severity === 'CRITICAL' || a.severity === 'HIGH',
    );

    if (criticalAlerts.length > this.maxCriticalAlerts) {
      return {
        stepName: this.name,
        passed: false,
        message: `Repository has ${criticalAlerts.length} critical/high vulnerability alert(s) (max allowed: ${this.maxCriticalAlerts})`,
        severity: 'error',
        details: {
          criticalCount: criticalAlerts.length,
          maxAllowed: this.maxCriticalAlerts,
          alerts: criticalAlerts.map((a) => ({ severity: a.severity, summary: a.summary })),
        },
      };
    }

    return {
      stepName: this.name,
      passed: true,
      message: `No critical/high vulnerability alerts (${alerts.length} total alerts)`,
      severity: 'info',
      details: { totalAlerts: alerts.length, criticalCount: criticalAlerts.length },
    };
  }
}
