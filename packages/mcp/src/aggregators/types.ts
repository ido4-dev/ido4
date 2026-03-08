/**
 * Type definitions for composite skill data aggregators.
 *
 * Each type represents the complete data payload a skill needs,
 * gathered in a single tool call instead of 5-12 individual calls.
 */

import type {
  ContainerStatusData,
  TaskData,
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
  waveStatus: ContainerStatusData;
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
  waveStatus: ContainerStatusData;
  tasks: TaskData[];
  annotations: TaskAnnotation[];
  analytics: ContainerAnalytics;
  agents: RegisteredAgent[];
  projectUrl: string | null;
  summary: string;
}

// ─── Compliance Data ───

export interface EpicIntegrityCheck {
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
  epicIntegrityChecks: EpicIntegrityCheck[];
  summary: string;
}

// ─── Health Data ───

export interface HealthData {
  waveStatus: ContainerStatusData;
  compliance: ComplianceScore;
  analytics: ContainerAnalytics;
  agents: RegisteredAgent[];
  summary: string;
}
