export { parseSpec } from '@ido4/tech-spec-format';
export { parseStrategicSpec } from '@ido4/spec-format';
export { mapSpec, findGroupingContainer, topologicalSort } from './spec-mapper.js';
export { IngestionService } from './ingestion-service.js';
export type {
  ParsedSpec,
  ParsedProjectHeader,
  ParsedGroup,
  ParsedTask,
  ParseError,
} from '@ido4/tech-spec-format';
export type {
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
} from '@ido4/spec-format';
export { STRATEGIC_PRIORITIES, STRATEGIC_RISKS } from '@ido4/spec-format';
