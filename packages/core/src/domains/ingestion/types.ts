/**
 * Types for the Spec Artifact Ingestion Engine.
 *
 * Three layers: Parser (markdown → ParsedSpec), Mapper (ParsedSpec → MappedSpec),
 * and IngestionService (MappedSpec → GitHub issues).
 *
 * Parser types are owned by @ido4/tech-spec-format and re-exported here so
 * intra-core callers (spec-mapper, ingestion-service) keep stable import paths.
 * Mapper and service types live in this file — they depend on MethodologyProfile
 * and are not meaningful outside @ido4/core.
 */

import type { MethodologyProfile } from '../../profiles/types.js';

// ─── Parser Output (re-exported from @ido4/tech-spec-format) ───

export type {
  ParsedSpec,
  ParsedProjectHeader,
  ParsedGroup,
  ParsedTask,
  ParseError,
} from '@ido4/tech-spec-format';

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
    parseErrors: import('@ido4/tech-spec-format').ParseError[];
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
