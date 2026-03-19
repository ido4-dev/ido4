/**
 * Types for the Strategic Spec Parser.
 *
 * Strategic specs (produced by ido4shape) capture multi-stakeholder understanding
 * with minimal metadata. They use the same heading patterns as technical specs
 * but different metadata fields and richer prose content.
 *
 * These types are the parser output — consumed by the decomposition pipeline,
 * NOT by the ingestion pipeline (which consumes technical specs).
 */

// ─── Parser Output ───

export interface ParsedStrategicSpec {
  project: StrategicProjectHeader;
  crossCuttingConcerns: CrossCuttingConcern[];
  groups: StrategicGroup[];
  orphanCapabilities: StrategicCapability[];
  errors: StrategicParseError[];
}

export interface StrategicProjectHeader {
  name: string;
  format: string;
  version: string;
  description: string;
  stakeholders: Stakeholder[];
  constraints: string[];
  nonGoals: string[];
  openQuestions: string[];
}

export interface Stakeholder {
  name: string;
  perspective: string;
}

export interface CrossCuttingConcern {
  name: string;
  content: string;
}

export interface StrategicGroup {
  name: string;
  prefix: string;
  priority?: string;
  description: string;
  capabilities: StrategicCapability[];
}

export interface StrategicCapability {
  ref: string;
  title: string;
  body: string;
  priority?: string;
  risk?: string;
  dependsOn: string[];
  successConditions: string[];
  groupName: string | null;
}

export interface StrategicParseError {
  line: number;
  message: string;
  severity: 'warning' | 'error';
}

// ─── Allowed Values ───

export const STRATEGIC_PRIORITIES = ['must-have', 'should-have', 'nice-to-have'] as const;
export type StrategicPriority = typeof STRATEGIC_PRIORITIES[number];

export const STRATEGIC_RISKS = ['low', 'medium', 'high'] as const;
export type StrategicRisk = typeof STRATEGIC_RISKS[number];
