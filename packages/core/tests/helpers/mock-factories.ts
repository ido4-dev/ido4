/**
 * Mock factories for test data generation.
 *
 * Each factory returns a complete object with sensible defaults.
 * Use spread overrides for scenario-specific customization.
 */

import type { TaskData, IProjectConfig, IWorkflowConfig, IGitWorkflowConfig, AuditEntry, IGraphQLClient, ProjectItem } from '../../src/index.js';
import { SYSTEM_ACTOR } from '../../src/index.js';

export function createMockTaskData(overrides: Partial<TaskData> = {}): TaskData {
  return {
    id: 'I_test_001',
    itemId: 'PVTI_test_001',
    number: 42,
    title: 'Test Task for Business Rule Validation',
    body: 'Task description with acceptance criteria and implementation details',
    status: 'Backlog',
    wave: 'wave-001',
    epic: undefined,
    dependencies: 'No dependencies',
    aiSuitability: 'ai-only',
    riskLevel: 'Low',
    effort: 'Medium',
    taskType: undefined,
    aiContext: 'Test context for AI implementation',
    assignees: [],
    labels: [],
    url: 'https://github.com/test/repo/issues/42',
    closed: false,
    ...overrides,
  };
}

export function createMockProjectConfig(overrides: Partial<IProjectConfig> = {}): IProjectConfig {
  return {
    project: {
      id: 'PVT_test_project_001',
      number: 1,
      repository: 'test-org/test-repo',
      ...overrides.project,
    },
    fields: {
      status_field_id: 'PVTF_status_001',
      wave_field_id: 'PVTF_wave_001',
      epic_field_id: 'PVTF_epic_001',
      dependencies_field_id: 'PVTF_deps_001',
      ai_suitability_field_id: 'PVTF_ai_001',
      risk_level_field_id: 'PVTF_risk_001',
      effort_field_id: 'PVTF_effort_001',
      ai_context_field_id: 'PVTF_ctx_001',
      ...overrides.fields,
    },
    status_options: {
      BACKLOG: { name: 'Backlog', id: 'opt_backlog' },
      IN_REFINEMENT: { name: 'In Refinement', id: 'opt_refinement' },
      READY_FOR_DEV: { name: 'Ready for Dev', id: 'opt_ready' },
      BLOCKED: { name: 'Blocked', id: 'opt_blocked' },
      IN_PROGRESS: { name: 'In Progress', id: 'opt_progress' },
      IN_REVIEW: { name: 'In Review', id: 'opt_review' },
      DONE: { name: 'Done', id: 'opt_done' },
      ...overrides.status_options,
    },
    effort_options: {
      XS: { name: 'XS', id: 'opt_effort_xs' },
      S: { name: 'S', id: 'opt_effort_s' },
      M: { name: 'M', id: 'opt_effort_m' },
      L: { name: 'L', id: 'opt_effort_l' },
      XL: { name: 'XL', id: 'opt_effort_xl' },
      ...overrides.effort_options,
    },
    risk_level_options: {
      LOW: { name: 'Low', id: 'opt_risk_low' },
      MEDIUM: { name: 'Medium', id: 'opt_risk_medium' },
      HIGH: { name: 'High', id: 'opt_risk_high' },
      CRITICAL: { name: 'Critical', id: 'opt_risk_critical' },
      ...overrides.risk_level_options,
    },
    ai_suitability_options: {
      AI_ONLY: { name: 'AI Only', id: 'opt_ai_only' },
      AI_REVIEWED: { name: 'AI Reviewed', id: 'opt_ai_reviewed' },
      HYBRID: { name: 'Hybrid', id: 'opt_ai_hybrid' },
      HUMAN_ONLY: { name: 'Human Only', id: 'opt_ai_human' },
      ...overrides.ai_suitability_options,
    },
    task_type_options: {
      FEATURE: { name: 'Feature', id: 'opt_type_feature' },
      BUG: { name: 'Bug', id: 'opt_type_bug' },
      ENHANCEMENT: { name: 'Enhancement', id: 'opt_type_enhancement' },
      DOCUMENTATION: { name: 'Documentation', id: 'opt_type_doc' },
      TESTING: { name: 'Testing', id: 'opt_type_testing' },
      ...overrides.task_type_options,
    },
    wave_config: overrides.wave_config,
  };
}

export function createMockWorkflowConfig(overrides: Partial<IWorkflowConfig> = {}): IWorkflowConfig {
  const statusMap: Record<string, string> = {
    BACKLOG: 'Backlog',
    IN_REFINEMENT: 'In Refinement',
    READY_FOR_DEV: 'Ready for Dev',
    BLOCKED: 'Blocked',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    DONE: 'Done',
  };

  const statusIdMap: Record<string, string> = {
    BACKLOG: 'opt_backlog',
    IN_REFINEMENT: 'opt_refinement',
    READY_FOR_DEV: 'opt_ready',
    BLOCKED: 'opt_blocked',
    IN_PROGRESS: 'opt_progress',
    IN_REVIEW: 'opt_review',
    DONE: 'opt_done',
  };

  const fieldIdMap: Record<string, string> = {
    status: 'PVTF_status_001',
    wave: 'PVTF_wave_001',
    epic: 'PVTF_epic_001',
    dependencies: 'PVTF_deps_001',
    ai_suitability: 'PVTF_ai_001',
    risk_level: 'PVTF_risk_001',
    effort: 'PVTF_effort_001',
    ai_context: 'PVTF_ctx_001',
  };

  const validTransitions = new Set([
    'Backlog->In Refinement',
    'Backlog->Ready for Dev',
    'In Refinement->Ready for Dev',
    'Ready for Dev->In Progress',
    'In Progress->In Review',
    'In Review->Done',
    'Done->Done',
    // Block/unblock
    'Backlog->Blocked',
    'In Refinement->Blocked',
    'Ready for Dev->Blocked',
    'In Progress->Blocked',
    'In Review->Blocked',
    'Blocked->Ready for Dev',
    // Return
    'Ready for Dev->In Refinement',
    'In Progress->Ready for Dev',
    'In Review->In Progress',
  ]);

  // Build reverse-lookup for getValidNextTransitions
  const nextMap = new Map<string, string[]>();
  for (const key of validTransitions) {
    const [from, to] = key.split('->');
    if (from && to) {
      const existing = nextMap.get(from) ?? [];
      existing.push(to);
      nextMap.set(from, existing);
    }
  }

  return {
    getStatusId(key: string): string {
      return statusIdMap[key] ?? '';
    },
    getStatusName(key: string): string {
      return statusMap[key] ?? '';
    },
    getFieldId(key: string): string {
      return fieldIdMap[key] ?? '';
    },
    isValidTransition(from: string, to: string): boolean {
      return validTransitions.has(`${from}->${to}`);
    },
    getAllStatusValues(): Record<string, string> {
      return { ...statusMap };
    },
    getValidNextTransitions(fromStatus: string): string[] {
      return nextMap.get(fromStatus) ?? [];
    },
    ...overrides,
  };
}

export function createMockAuditEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    transition: 'start',
    issueNumber: 42,
    fromStatus: 'Ready for Dev',
    toStatus: 'In Progress',
    actor: SYSTEM_ACTOR,
    validationResult: {
      stepsRun: 5,
      stepsPassed: 5,
      stepsFailed: 0,
      stepsWarned: 0,
      details: [],
      ...overrides.validationResult,
    },
    metadata: {
      dryRun: false,
      ...overrides.metadata,
    },
    ...overrides,
  };
}

export function createMockGitWorkflowConfig(overrides: Partial<IGitWorkflowConfig> = {}): IGitWorkflowConfig {
  return {
    isEnabled: () => true,
    requiresPRForReview: () => true,
    shouldShowGitSuggestions: () => true,
    shouldDetectGitContext: () => true,
    ...overrides,
  };
}

export function createMockProjectItem(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: 'PVTI_mock_001',
    content: {
      number: 1,
      title: 'Mock Item',
      body: 'Mock body',
      url: 'https://github.com/test/repo/issues/1',
      closed: false,
      ...overrides.content,
    },
    fieldValues: {
      Status: 'Backlog',
      Wave: 'wave-001-test',
      ...overrides.fieldValues,
    },
    ...overrides,
  };
}
