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
import { EpicUtils } from '../../shared/utils/index.js';

export class EpicService implements IEpicService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly logger: ILogger,
  ) {}

  async getTasksInEpic(epicName: string): Promise<TaskData[]> {
    const items = await this.projectRepository.getProjectItems();
    const normalizedEpic = EpicUtils.normalizeEpicName(epicName);

    const matched = items.filter((item) => {
      // Match by epic field value
      const epicField = item.fieldValues['Epic'];
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
    if (!task.epic) {
      return { maintained: true, violations: [] };
    }

    const epicTasks = await this.getTasksInEpic(task.epic);

    // Collect unique waves (excluding tasks with no wave)
    const waves = new Set<string>();
    for (const t of epicTasks) {
      if (t.wave) {
        waves.add(t.wave);
      }
    }

    if (waves.size <= 1) {
      return { maintained: true, violations: [] };
    }

    const waveList = [...waves];
    const violations = [
      `Epic "${task.epic}" has tasks spread across ${waves.size} waves: ${waveList.join(', ')}`,
    ];

    this.logger.debug('Epic integrity violation detected', {
      epicName: task.epic,
      waves: waveList,
    });

    return { maintained: false, violations };
  }

  private mapProjectItemToTaskData(item: ProjectItem): TaskData {
    return {
      id: '', // Issue node_id not available from project items
      itemId: item.id,
      number: item.content.number,
      title: item.content.title,
      body: item.content.body,
      status: item.fieldValues['Status'] ?? '',
      wave: item.fieldValues['Wave'] || undefined,
      epic: item.fieldValues['Epic'] || undefined,
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
