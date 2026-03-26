/**
 * @ido4/spec-format — Strategic spec format parser.
 *
 * Zero-dependency package for parsing and validating strategic spec artifacts
 * produced by ido4shape. Used by @ido4/core (MCP server) and by ido4shape
 * (via CLI) for deterministic structural validation.
 */

// Parser
export { parseStrategicSpec } from './strategic-spec-parser.js';

// Types
export type {
  ParsedStrategicSpec,
  StrategicProjectHeader,
  StrategicGroup,
  StrategicCapability,
  StrategicParseError,
  CrossCuttingConcern,
  Stakeholder,
  StrategicPriority,
  StrategicRisk,
} from './strategic-spec-types.js';
export { STRATEGIC_PRIORITIES, STRATEGIC_RISKS } from './strategic-spec-types.js';

// Utilities (also used by @ido4/core's technical spec parser)
export { parseMetadataLine, derivePrefix } from './spec-parse-utils.js';
