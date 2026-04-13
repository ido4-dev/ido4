/**
 * Types for the technical spec parser.
 *
 * These types describe the output of parseSpec — the AST extracted from a
 * technical spec markdown file. Profile-agnostic, zero mapper/service coupling.
 * The mapper and ingestion-service types live in @ido4/core/domains/ingestion,
 * because those layers need the MethodologyProfile and container infrastructure.
 */

/**
 * Format versions this parser supports. Used by consumers to check compatibility
 * before handing a spec to the parser. Major-version mismatches should fail fast
 * with a clear remediation message. Minor mismatches may produce warnings on
 * unknown optional fields but still parse successfully within a major version.
 *
 * This is the version contract between ido4specs (producer) and @ido4/core's
 * ingestion pipeline (consumer). See:
 *   ido4specs/docs/extraction-plan.md (section 5)
 *   ido4specs/references/technical-spec-format.md (once extraction lands)
 */
export const SUPPORTED_FORMAT_VERSIONS = ['1.0'] as const;
export type SupportedFormatVersion = typeof SUPPORTED_FORMAT_VERSIONS[number];

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
  /**
   * Format identifier declared in the spec (e.g., "tech-spec"). Set when the
   * parser finds a `> format: tech-spec | version: X.Y` marker line. Undefined
   * if the spec omits the marker (parser still accepts the spec for backward
   * compatibility with pre-versioned artifacts).
   */
  format?: string;
  /**
   * Format version declared in the spec (e.g., "1.0"). Set when the format
   * marker is present. Used by the parser to fail fast on major-version
   * mismatches with SUPPORTED_FORMAT_VERSIONS.
   */
  version?: string;
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
