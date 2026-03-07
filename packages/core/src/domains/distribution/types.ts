/**
 * Work Distribution types — intelligent task recommendation and handoff.
 *
 * Scoring dimensions:
 * - Cascade value (0-40): downstream tasks unblocked by completing this task
 * - Epic momentum (0-25): prefer finishing epics already in progress
 * - Capability match (0-20): agent role/capabilities vs task characteristics
 * - Dependency freshness (0-15): recently-unblocked tasks have momentum
 */

export interface ScoreBreakdown {
  /** 0-40 — how many downstream tasks does completing this unblock? */
  cascadeValue: number;
  /** 0-25 — is this task's epic already in progress? Prefer finishing. */
  epicMomentum: number;
  /** 0-20 — does the agent's role match the task's characteristics? */
  capabilityMatch: number;
  /** 0-15 — was a dependency recently completed? Momentum bonus. */
  dependencyFreshness: number;
}

export interface TaskRecommendation {
  issueNumber: number;
  title: string;
  reasoning: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface WorkRecommendation {
  recommendation: TaskRecommendation | null;
  alternatives: TaskRecommendation[];
  context: {
    activeWave: string;
    agentId: string;
    lockedTasks: number[];
    totalCandidates: number;
  };
}

export interface HandoffResult {
  completed: { issueNumber: number; title: string };
  newlyUnblocked: Array<{
    issueNumber: number;
    title: string;
    recommendedAgent: string | null;
    reasoning: string;
  }>;
  agentNextTask: WorkRecommendation;
}
