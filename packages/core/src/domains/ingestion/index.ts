export { parseSpec } from './spec-parser.js';
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
