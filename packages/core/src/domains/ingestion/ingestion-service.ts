/**
 * IngestionService — Orchestrates spec artifact ingestion.
 *
 * Follows SandboxService pattern: on-demand creation, not wired into ServiceContainer.
 * Flow: parse → map → validate → [dry run] → create capability issues → create tasks → wire sub-issues.
 */

import type { ILogger } from '../../shared/logger.js';
import type { ITaskService, IIssueRepository, IProjectRepository } from '../../container/interfaces.js';
import type { MethodologyProfile } from '../../profiles/types.js';
import type { IngestSpecResult, IngestSpecOptions, MappedTask } from './types.js';
import { parseSpec } from '@ido4/tech-spec-format';
import { mapSpec, findGroupingContainer } from './spec-mapper.js';
import { SYSTEM_ACTOR } from '../../shared/actor.js';
import { withLineageMarker } from '../../shared/utils/lineage-marker.js';

/** Delay between sub-issue creation to avoid GitHub API race conditions */
const SUB_ISSUE_DELAY_MS = 1000;

export class IngestionService {
  constructor(
    private readonly taskService: ITaskService,
    private readonly issueRepository: IIssueRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly profile: MethodologyProfile,
    private readonly logger: ILogger,
  ) {}

  async ingestSpec(options: IngestSpecOptions): Promise<IngestSpecResult> {
    const { specContent, dryRun } = options;

    // Step 1: Parse
    const parsed = parseSpec(specContent);
    this.logger.info('Spec parsed', {
      projectName: parsed.project.name,
      groups: parsed.groups.length,
      tasks: parsed.groups.reduce((sum, g) => sum + g.tasks.length, 0) + parsed.orphanTasks.length,
      parseErrors: parsed.errors.length,
    });

    // Step 2: Check for fatal parse errors
    const fatalParseErrors = parsed.errors.filter(e => e.severity === 'error');
    const allTasks = [...parsed.groups.flatMap(g => g.tasks), ...parsed.orphanTasks];
    if (allTasks.length === 0) {
      return this.buildResult(parsed.project.name, parsed, {
        groupIssues: [],
        tasks: [],
        subIssueRelationships: 0,
        totalIssues: 0,
      }, [], fatalParseErrors.length > 0
        ? [`Spec has fatal parse errors: ${fatalParseErrors.map(e => e.message).join('; ')}`]
        : ['Spec contains no tasks — nothing to ingest'],
      []);
    }

    // Step 3: Map
    const mapped = mapSpec(parsed, this.profile);
    this.logger.info('Spec mapped', {
      groupIssues: mapped.groupIssues.length,
      tasks: mapped.tasks.length,
      mappingErrors: mapped.errors.length,
    });

    // Step 4: Check for fatal mapping errors (circular deps)
    const circularErrors = mapped.errors.filter(e => e.message.includes('Circular dependency'));
    if (circularErrors.length > 0) {
      return this.buildResult(parsed.project.name, parsed, {
        groupIssues: [],
        tasks: [],
        subIssueRelationships: 0,
        totalIssues: 0,
      }, [], [
        ...mapped.warnings,
        ...circularErrors.map(e => e.message),
      ], []);
    }

    // Step 5: Dry run — return preview
    if (dryRun) {
      return this.buildDryRunResult(parsed, mapped);
    }

    // Step 6: Create capability issues (parent issues for tasks)
    const groupRefToIssue = new Map<string, { id: string; number: number; url: string }>();
    const createdGroups: Array<{ ref: string; issueNumber: number; title: string; url: string }> = [];
    const groupingContainer = findGroupingContainer(this.profile);

    for (const group of mapped.groupIssues) {
      try {
        const issue = await this.issueRepository.createIssue(group.title, withLineageMarker(group.ref, group.body));
        await this.projectRepository.addItemToProject(issue.id);
        groupRefToIssue.set(group.ref, issue);
        createdGroups.push({
          ref: group.ref,
          issueNumber: issue.number,
          title: group.title,
          url: issue.url,
        });
        this.logger.info('Capability issue created', { ref: group.ref, issueNumber: issue.number });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`Failed to create capability issue: ${group.ref} — ${error.message}`);
        // Capability creation failure is non-fatal — tasks will just not have container assignment
        mapped.warnings.push(`Failed to create capability "${group.title}": ${error.message}`);
      }
    }

    // Step 7: Create tasks in topological order
    const taskRefToIssue = new Map<string, { id: string; number: number; url: string }>();
    const createdTasks: Array<{ ref: string; issueNumber: number; title: string; url: string; dependsOn: string[]; groupRef: string | null }> = [];
    const failed: Array<{ ref: string; title: string; error: string }> = [];
    const failedRefs = new Set<string>();

    for (const task of mapped.tasks) {
      // Check if any dependency failed
      const failedDep = task.dependsOn.find(ref => failedRefs.has(ref));
      if (failedDep) {
        failed.push({
          ref: task.ref,
          title: task.request.title,
          error: `Skipped: dependency ${failedDep} failed to create`,
        });
        failedRefs.add(task.ref);
        continue;
      }

      try {
        // Resolve dependency refs to issue numbers
        const resolvedDeps = this.resolveDependencies(task, taskRefToIssue);

        // Resolve group container
        const containers = { ...task.request.containers };
        if (task.groupRef && groupingContainer) {
          const groupIssue = groupRefToIssue.get(task.groupRef);
          if (groupIssue) {
            containers[groupingContainer.id] = `#${groupIssue.number}`;
          }
        }

        const result = await this.taskService.createTask({
          title: task.request.title,
          body: withLineageMarker(task.ref, task.request.body),
          initialStatus: task.request.initialStatus,
          containers,
          dependencies: resolvedDeps,
          effort: task.request.effort,
          riskLevel: task.request.riskLevel,
          aiSuitability: task.request.aiSuitability,
          taskType: task.request.taskType,
          actor: SYSTEM_ACTOR,
        });

        if (result.success) {
          taskRefToIssue.set(task.ref, {
            id: result.data.issueId,
            number: result.data.issueNumber,
            url: result.data.url,
          });
          createdTasks.push({
            ref: task.ref,
            issueNumber: result.data.issueNumber,
            title: task.request.title,
            url: result.data.url,
            dependsOn: task.dependsOn,
            groupRef: task.groupRef,
          });
          this.logger.info('Task created', { ref: task.ref, issueNumber: result.data.issueNumber });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failed.push({ ref: task.ref, title: task.request.title, error: errorMsg });
        failedRefs.add(task.ref);
        this.logger.warn(`Task creation failed: ${task.ref} — ${errorMsg}`);
      }
    }

    // Step 8: Wire sub-issue relationships
    let subIssueCount = 0;
    for (const task of mapped.tasks) {
      if (!task.groupRef) continue;

      const groupIssue = groupRefToIssue.get(task.groupRef);
      const taskIssue = taskRefToIssue.get(task.ref);

      if (groupIssue && taskIssue) {
        try {
          await this.issueRepository.addSubIssue(groupIssue.id, taskIssue.id);
          subIssueCount++;
          await this.sleep(SUB_ISSUE_DELAY_MS);
        } catch (err) {
          this.logger.warn('Failed to create sub-issue relationship', {
            group: task.groupRef,
            task: task.ref,
            error: String(err),
          });
        }
      }
    }

    // Step 9: Build result
    const totalIssues = createdGroups.length + createdTasks.length;
    const allWarnings = [...mapped.warnings];
    const nonFatalParseWarnings = parsed.errors.filter(e => e.severity === 'warning');
    for (const w of nonFatalParseWarnings) {
      allWarnings.push(`Parse warning: ${w.message}`);
    }

    const suggestions = this.generateSuggestions(
      createdTasks.length,
      createdGroups.length,
      failed.length,
      groupingContainer?.singular ?? null,
      mapped.tasks,
    );

    return {
      success: failed.length === 0,
      parsed: {
        projectName: parsed.project.name,
        groupCount: parsed.groups.length,
        taskCount: allTasks.length,
        parseErrors: parsed.errors,
      },
      created: {
        groupIssues: createdGroups,
        tasks: createdTasks,
        subIssueRelationships: subIssueCount,
        totalIssues,
      },
      failed,
      warnings: allWarnings,
      suggestions,
    };
  }

  private resolveDependencies(
    task: MappedTask,
    taskRefToIssue: Map<string, { id: string; number: number; url: string }>,
  ): string | undefined {
    if (task.dependsOn.length === 0) return undefined;

    const resolved = task.dependsOn
      .map(ref => {
        const issue = taskRefToIssue.get(ref);
        return issue ? `#${issue.number}` : ref;
      })
      .join(', ');

    return resolved;
  }

  private buildResult(
    projectName: string,
    parsed: ReturnType<typeof parseSpec>,
    created: IngestSpecResult['created'],
    failed: IngestSpecResult['failed'],
    warnings: string[],
    suggestions: string[],
  ): IngestSpecResult {
    const allTasks = [...parsed.groups.flatMap(g => g.tasks), ...parsed.orphanTasks];
    return {
      success: failed.length === 0 && warnings.filter(w => !w.startsWith('Parse warning')).length === 0,
      parsed: {
        projectName,
        groupCount: parsed.groups.length,
        taskCount: allTasks.length,
        parseErrors: parsed.errors,
      },
      created,
      failed,
      warnings,
      suggestions,
    };
  }

  private buildDryRunResult(
    parsed: ReturnType<typeof parseSpec>,
    mapped: ReturnType<typeof mapSpec>,
  ): IngestSpecResult {
    const allTasks = [...parsed.groups.flatMap(g => g.tasks), ...parsed.orphanTasks];
    const groupingContainer = findGroupingContainer(this.profile);

    const dryRunGroups = mapped.groupIssues.map((g, i) => ({
      ref: g.ref,
      issueNumber: -(i + 1),
      title: g.title,
      url: '(dry run)',
    }));

    const dryRunTasks = mapped.tasks.map((t, i) => ({
      ref: t.ref,
      issueNumber: -(i + 1),
      title: t.request.title,
      url: '(dry run)',
      dependsOn: t.dependsOn,
      groupRef: t.groupRef,
    }));

    const suggestions = this.generateSuggestions(
      mapped.tasks.length,
      mapped.groupIssues.length,
      0,
      groupingContainer?.singular ?? null,
      mapped.tasks,
    );

    return {
      success: true,
      parsed: {
        projectName: parsed.project.name,
        groupCount: parsed.groups.length,
        taskCount: allTasks.length,
        parseErrors: parsed.errors,
      },
      created: {
        groupIssues: dryRunGroups,
        tasks: dryRunTasks,
        subIssueRelationships: mapped.tasks.filter(t => t.groupRef).length,
        totalIssues: dryRunGroups.length + dryRunTasks.length,
      },
      failed: [],
      warnings: mapped.warnings,
      suggestions: ['(Dry run — no issues were created)', ...suggestions],
    };
  }

  private generateSuggestions(
    taskCount: number,
    groupCount: number,
    failedCount: number,
    containerSingular: string | null,
    tasks: MappedTask[],
  ): string[] {
    const suggestions: string[] = [];

    if (taskCount > 0) {
      const statusName = this.profile.states.find(s => s.key === this.profile.semantics.initialState)?.name ?? this.profile.semantics.initialState;
      suggestions.push(
        `Created ${taskCount} tasks in ${statusName}. Use planning tools to organize into execution containers.`,
      );
    }

    const highRiskTasks = tasks.filter(t => t.request.riskLevel === 'High');
    if (highRiskTasks.length > 0) {
      suggestions.push(
        `${highRiskTasks.length} task(s) have risk=High. Consider creating research spikes for these before starting.`,
      );
    }

    if (groupCount > 0 && containerSingular) {
      suggestions.push(
        `Capabilities were created as ${containerSingular.toLowerCase()}s. Use container assignment tools to adjust if needed.`,
      );
    }

    if (failedCount > 0) {
      suggestions.push(
        `${failedCount} task(s) failed to create. Review the failed list and retry manually if needed.`,
      );
    }

    return suggestions;
  }

  /** Overridable sleep for testing */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
