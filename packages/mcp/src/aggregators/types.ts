/**
 * Type definitions for composite skill data aggregators.
 *
 * Each type represents the complete data payload a skill needs,
 * gathered in a single tool call instead of 5-12 individual calls.
 */

import type {
  ContainerStatusData,
  TaskData,
  TaskDataWithComments,
  PullRequestInfo,
  PullRequestReviewData,
  DependencyAnalysisResult,
  IntegrityResult,
  ContainerSummary,
  RegisteredAgent,
  TaskLock,
  ContainerAnalytics,
  ComplianceScore,
  AuditQueryResult,
  Ido4ContextBlock,
} from '@ido4/core';

// ─── Standup Data ───

export interface TaskReviewStatus {
  issueNumber: number;
  title: string;
  pullRequest: PullRequestInfo | null;
  reviews: PullRequestReviewData[];
}

export interface TaskBlockerAnalysis {
  issueNumber: number;
  title: string;
  dependencyAnalysis: DependencyAnalysisResult | null;
}

export interface StandupData {
  containerStatus: ContainerStatusData;
  tasks: TaskData[];
  reviewStatuses: TaskReviewStatus[];
  blockerAnalyses: TaskBlockerAnalysis[];
  auditTrail: AuditQueryResult;
  analytics: ContainerAnalytics;
  agents: RegisteredAgent[];
  compliance: ComplianceScore;
  summary: string;
}

// ─── Board Data ───

export interface TaskAnnotation {
  issueNumber: number;
  pullRequest: PullRequestInfo | null;
  lock: TaskLock | null;
}

export interface BoardData {
  containerStatus: ContainerStatusData;
  tasks: TaskData[];
  annotations: TaskAnnotation[];
  analytics: ContainerAnalytics;
  agents: RegisteredAgent[];
  projectUrl: string | null;
  summary: string;
}

// ─── Compliance Data ───

export interface ContainerIntegrityCheck {
  epicName: string;
  issueNumber: number;
  result: IntegrityResult;
}

export interface ComplianceData {
  compliance: ComplianceScore;
  auditTrail: AuditQueryResult;
  analytics: ContainerAnalytics;
  waves: ContainerSummary[];
  tasks: TaskData[];
  blockerAnalyses: TaskBlockerAnalysis[];
  containerIntegrityChecks: ContainerIntegrityCheck[];
  summary: string;
}

// ─── Health Data ───

export interface HealthData {
  containerStatus: ContainerStatusData;
  compliance: ComplianceScore;
  analytics: ContainerAnalytics;
  agents: RegisteredAgent[];
  summary: string;
}

// ─── Task Execution Data ───

export interface UpstreamContext {
  task: TaskDataWithComments;
  relationship: 'dependency';
  satisfied: boolean;
  ido4Context: Ido4ContextBlock[];
}

export interface SiblingContext {
  task: TaskData;
  relationship: 'epic-sibling';
  ido4Context: Ido4ContextBlock[];
}

export interface DownstreamContext {
  task: TaskData;
  relationship: 'dependent';
}

export interface EpicProgressData {
  epicName: string;
  total: number;
  completed: number;
  inProgress: number;
  blocked: number;
  remaining: number;
  completedTasks: Array<{ number: number; title: string }>;
  remainingTasks: Array<{ number: number; title: string }>;
}

export interface TaskExecutionData {
  task: TaskDataWithComments;
  upstream: UpstreamContext[];
  siblings: SiblingContext[];
  downstream: DownstreamContext[];
  epicProgress: EpicProgressData | null;
  summary: string;
  /** Pre-computed execution intelligence — deterministic signals derived from the dependency graph */
  executionIntelligence: ExecutionIntelligence;
}

// ─── Execution Intelligence ───

export interface DependencySignal {
  issueNumber: number;
  title: string;
  priority: 'critical' | 'high' | 'normal';
  priorityReason: string;
  satisfied: boolean;
  status: string;
  contextBlocks: number;
  lastContextTransition: string | null;
  lastContextAge: string | null;
  warnings: string[];
}

export interface SiblingSignal {
  issueNumber: number;
  title: string;
  status: string;
  hasContext: boolean;
  warnings: string[];
}

export interface DownstreamSignal {
  issueNumber: number;
  title: string;
  status: string;
  isWaiting: boolean;
}

export interface ExecutionIntelligence {
  dependencySignals: DependencySignal[];
  siblingSignals: SiblingSignal[];
  downstreamSignals: DownstreamSignal[];
  riskFlags: string[];
  criticalPath: string | null;
}
