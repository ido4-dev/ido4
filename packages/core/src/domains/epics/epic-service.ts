/**
 * EpicService — Implements IEpicService for epic management and integrity validation.
 *
 * Key design decisions:
 * - Returns IntegrityResult (never throws for integrity violations)
 * - Uses ProjectRepository for task listing (avoids N+1 issue queries)
 * - Maps ProjectItem → TaskData for interface compliance
 */

import type {
  IEpicService,
  IProjectRepository,
  TaskData,
  ProjectItem,
  IntegrityResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';
import type { MethodologyProfile, SameContainerRule } from '../../profiles/types.js';
import { EpicUtils } from '../../shared/utils/index.js';

export class EpicService implements IEpicService {
  private readonly epicField: string;

  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly profile: MethodologyProfile,
    private readonly logger: ILogger,
  ) {
    const epicContainer = profile.containers.find((c) => c.id === 'epic');
    this.epicField = epicContainer?.taskField ?? 'Epic';
  }

  async getTasksInEpic(epicName: string): Promise<TaskData[]> {
    const items = await this.projectRepository.getProjectItems();
    const normalizedEpic = EpicUtils.normalizeEpicName(epicName);

    const matched = items.filter((item) => {
      // Match by epic field value
      const epicField = item.fieldValues[this.epicField];
      if (epicField && EpicUtils.normalizeEpicName(epicField) === normalizedEpic) {
        return true;
      }
      // Match by title pattern [epicName]
      if (item.content.title.toLowerCase().includes(`[${normalizedEpic}]`)) {
        return true;
      }
      return false;
    });

    this.logger.debug('Epic tasks found', { epicName, count: matched.length });
    return matched.map((item) => this.mapProjectItemToTaskData(item));
  }

  async validateEpicIntegrity(task: TaskData): Promise<IntegrityResult> {
    const sameContainerRules = this.profile.integrityRules.filter(
      (r): r is SameContainerRule => r.type === 'same-container',
    );

    if (sameContainerRules.length === 0) {
      return { maintained: true, violations: [] };
    }

    const allViolations: string[] = [];

    for (const rule of sameContainerRules) {
      const groupByValue = task.containers[rule.groupBy];
      if (!groupByValue) continue;

      const groupTasks = await this.getTasksByContainer(rule.groupBy, groupByValue);

      // Collect unique mustMatch values (excluding tasks with no assignment)
      const mustMatchValues = new Set<string>();
      for (const t of groupTasks) {
        const value = t.containers[rule.mustMatch];
        if (value) mustMatchValues.add(value);
      }

      if (mustMatchValues.size <= 1) continue;

      const containerList = [...mustMatchValues];
      const containerDef = this.profile.containers.find((c) => c.id === rule.groupBy);
      const groupLabel = containerDef?.singular ?? rule.groupBy;

      allViolations.push(
        `${groupLabel} "${groupByValue}" has tasks spread across ${mustMatchValues.size} ${rule.mustMatch}s: ${containerList.join(', ')}`,
      );

      this.logger.debug('Container integrity violation detected', {
        ruleId: rule.id,
        groupBy: groupByValue,
        containers: containerList,
      });
    }

    if (allViolations.length === 0) {
      return { maintained: true, violations: [] };
    }

    return { maintained: false, violations: allViolations };
  }

  /**
   * Generic container-based task lookup: finds all tasks sharing a container value.
   * Reads the field name from the profile's container definition.
   */
  private async getTasksByContainer(containerId: string, value: string): Promise<TaskData[]> {
    const containerDef = this.profile.containers.find((c) => c.id === containerId);
    if (!containerDef) return [];

    const fieldName = containerDef.taskField;
    const items = await this.projectRepository.getProjectItems();
    const normalizedValue = EpicUtils.normalizeEpicName(value);

    const matched = items.filter((item) => {
      const fieldValue = item.fieldValues[fieldName];
      return fieldValue !== undefined && EpicUtils.normalizeEpicName(fieldValue) === normalizedValue;
    });

    return matched.map((item) => this.mapProjectItemToTaskData(item));
  }

  private mapProjectItemToTaskData(item: ProjectItem): TaskData {
    const containers: Record<string, string> = {};
    if (item.fieldValues['Wave']) containers['wave'] = item.fieldValues['Wave'];
    if (item.fieldValues['Epic']) containers['epic'] = item.fieldValues['Epic'];

    return {
      id: '', // Issue node_id not available from project items
      itemId: item.id,
      number: item.content.number,
      title: item.content.title,
      body: item.content.body,
      status: item.fieldValues['Status'] ?? '',
      containers,
      dependencies: item.fieldValues['Dependencies'] || undefined,
      aiSuitability: item.fieldValues['AI Suitability'] || undefined,
      riskLevel: item.fieldValues['Risk Level'] || undefined,
      effort: item.fieldValues['Effort'] || undefined,
      aiContext: item.fieldValues['AI Context'] || undefined,
      url: item.content.url,
      closed: item.content.closed,
    };
  }
}
