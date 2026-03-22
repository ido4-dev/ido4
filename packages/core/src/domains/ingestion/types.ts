/**
 * Types for the Spec Artifact Ingestion Engine.
 *
 * Three layers: Parser (markdown → ParsedSpec), Mapper (ParsedSpec → MappedSpec),
 * and IngestionService (MappedSpec → GitHub issues).
 */

import type { MethodologyProfile } from '../../profiles/types.js';

// ─── Parser Output ───

export interface ParsedSpec {
  project: ParsedProjectHeader;
  groups: ParsedGroup[];
  orphanTasks: ParsedTask[];
  errors: ParseError[];
}

export interface ParsedProjectHeader {
  name: string;
  description: string;
  constraints: string[];
  nonGoals: string[];
  openQuestions: string[];
}

export interface ParsedGroup {
  name: string;
  prefix: string;
  size?: string;
  risk?: string;
  description: string;
  tasks: ParsedTask[];
}

export interface ParsedTask {
  ref: string;
  title: string;
  body: string;
  effort?: string;
  risk?: string;
  taskType?: string;
  aiSuitability?: string;
  dependsOn: string[];
  successConditions: string[];
  groupName: string | null;
}

export interface ParseError {
  line: number;
  message: string;
  severity: 'warning' | 'error';
}

// ─── Mapper Output ───

export interface MappedSpec {
  groupIssues: MappedGroupIssue[];
  tasks: MappedTask[];
  errors: MappingError[];
  warnings: string[];
}

export interface MappedGroupIssue {
  ref: string;
  title: string;
  body: string;
  containerTypeId: string | null;
}

export interface MappedTask {
  ref: string;
  groupRef: string | null;
  dependsOn: string[];
  request: {
    title: string;
    body: string;
    initialStatus: string;
    containers: Record<string, string>;
    dependencies?: string;
    effort?: string;
    riskLevel?: string;
    aiSuitability?: string;
    taskType?: string;
  };
}

export interface MappingError {
  ref: string;
  message: string;
}

// ─── Ingestion Result ───

export interface IngestSpecResult {
  success: boolean;
  parsed: {
    projectName: string;
    groupCount: number;
    taskCount: number;
    parseErrors: ParseError[];
  };
  created: {
    groupIssues: Array<{ ref: string; issueNumber: number; title: string; url: string }>;
    tasks: Array<{ ref: string; issueNumber: number; title: string; url: string; dependsOn: string[]; groupRef: string | null }>;
    subIssueRelationships: number;
    totalIssues: number;
  };
  failed: Array<{ ref: string; title: string; error: string }>;
  warnings: string[];
  suggestions: string[];
}

// ─── Ingestion Options ───

export interface IngestSpecOptions {
  specContent: string;
  dryRun: boolean;
  profile: MethodologyProfile;
}
