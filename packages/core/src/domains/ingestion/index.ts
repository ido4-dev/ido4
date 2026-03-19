export { parseSpec } from './spec-parser.js';
export { parseStrategicSpec } from './strategic-spec-parser.js';
export { mapSpec, findGroupingContainer, topologicalSort } from './spec-mapper.js';
export { IngestionService } from './ingestion-service.js';
export type {
  ParsedSpec,
  ParsedProjectHeader,
  ParsedGroup,
  ParsedTask,
  ParseError,
  MappedSpec,
  MappedGroupIssue,
  MappedTask,
  MappingError,
  IngestSpecResult,
  IngestSpecOptions,
} from './types.js';
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
