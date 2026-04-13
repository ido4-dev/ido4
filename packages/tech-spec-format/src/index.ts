/**
 * @ido4/tech-spec-format — Technical spec format parser.
 *
 * Zero-runtime-dependency package (aside from the peer parser utilities shared
 * with @ido4/spec-format) for parsing and validating technical spec artifacts
 * produced by ido4specs. Consumed by @ido4/core for MCP-side ingestion and by
 * ido4specs directly via the bundled CLI for deterministic structural validation.
 */

// Parser
export { parseSpec } from './spec-parser.js';

// Types
export type {
  ParsedSpec,
  ParsedProjectHeader,
  ParsedGroup,
  ParsedTask,
  ParseError,
  SupportedFormatVersion,
} from './types.js';

// Version contract
export { SUPPORTED_FORMAT_VERSIONS } from './types.js';
