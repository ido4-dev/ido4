// Audit domain exports
export { AuditService } from './audit-service.js';
export type { IAuditService } from './audit-service.js';
export { JsonlAuditStore } from './audit-store.js';
export type {
  IAuditStore,
  SerializedDomainEvent,
  PersistedAuditEvent,
  AuditQuery,
  AuditQueryResult,
  AuditSummary,
  AuditSummaryOptions,
} from './audit-store.js';
export { classifyObservation, classifySpecOrphanRate, VALID_FINDING_CATEGORIES } from './finding-classifier.js';
export type {
  Observation, ClosureObservation, BypassObservation, EpicObservation,
  Classification, FindingCategory, FindingSeverity,
} from './finding-classifier.js';
