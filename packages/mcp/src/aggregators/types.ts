/**
 * Type definitions for composite skill data aggregators.
 *
 * Each type represents the complete data payload a skill needs,
 * gathered in a single tool call instead of 5-12 individual calls.
 */

import type {
  WaveStatusData,
  TaskData,
  PullRequestInfo,
  PullRequestReviewData,
  DependencyAnalysisResult,
  EpicIntegrityResult,
  WaveSummary,
  RegisteredAgent,
  TaskLock,
  WaveAnalytics,
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
  waveStatus: WaveStatusData;
  tasks: TaskData[];
  reviewStatuses: TaskReviewStatus[];
  blockerAnalyses: TaskBlockerAnalysis[];
  auditTrail: AuditQueryResult;
  analytics: WaveAnalytics;
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
  waveStatus: WaveStatusData;
  tasks: TaskData[];
  annotations: TaskAnnotation[];
  analytics: WaveAnalytics;
  agents: RegisteredAgent[];
  projectUrl: string | null;
  summary: string;
}

// ─── Compliance Data ───

export interface EpicIntegrityCheck {
  epicName: string;
  issueNumber: number;
  result: EpicIntegrityResult;
}

export interface ComplianceData {
  compliance: ComplianceScore;
  auditTrail: AuditQueryResult;
  analytics: WaveAnalytics;
  waves: WaveSummary[];
  tasks: TaskData[];
  blockerAnalyses: TaskBlockerAnalysis[];
  epicIntegrityChecks: EpicIntegrityCheck[];
  summary: string;
}

// ─── Health Data ───

export interface HealthData {
  waveStatus: WaveStatusData;
  compliance: ComplianceScore;
  analytics: WaveAnalytics;
  agents: RegisteredAgent[];
  summary: string;
}
