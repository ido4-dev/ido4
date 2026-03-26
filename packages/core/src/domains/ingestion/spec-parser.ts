/**
 * Spec Parser — Parses spec artifact markdown into a structured ParsedSpec AST.
 *
 * Pure function, no side effects, zero profile awareness.
 * Uses a line-by-line state machine: INIT → PROJECT → GROUP → TASK.
 */

import type {
  ParsedSpec,
  ParsedProjectHeader,
  ParsedGroup,
  ParsedTask,
  ParseError,
} from './types.js';
import { parseMetadataLine, derivePrefix } from '@ido4/spec-format';

type ParserState = 'INIT' | 'PROJECT' | 'GROUP' | 'TASK';

const PROJECT_HEADING = /^# (.+)$/;
const GROUP_HEADING = /^## Capability:\s*(.+)$/;
const TASK_HEADING = /^### ([A-Z]{2,5}-\d{2,3}):\s*(.+)$/;
const BLOCKQUOTE = /^>\s?(.*)$/;
const BULLET_ITEM = /^- (.+)$/;
const SECTION_HEADER = /^\*\*(.+?):\*\*\s*$/;
const SEPARATOR = /^---\s*$/;

const KNOWN_TASK_METADATA_KEYS = new Set([
  'effort', 'risk', 'type', 'ai', 'depends_on',
]);
const KNOWN_GROUP_METADATA_KEYS = new Set([
  'size', 'risk',
]);

export function parseSpec(markdown: string): ParsedSpec {
  const lines = markdown.split('\n');
  const errors: ParseError[] = [];

  let state: ParserState = 'INIT';
  const project: ParsedProjectHeader = {
    name: '',
    description: '',
    constraints: [],
    nonGoals: [],
    openQuestions: [],
  };

  const groups: ParsedGroup[] = [];
  const orphanTasks: ParsedTask[] = [];
  const seenRefs = new Set<string>();

  let currentGroup: ParsedGroup | null = null;
  let currentTask: ParsedTask | null = null;

  // Track metadata parsing state
  let expectingMetadata = false;
  let metadataTarget: 'group' | 'task' | 'project' = 'project';
  let projectDescriptionDone = false;
  let currentSection: string | null = null;

  // Body accumulation for tasks
  let bodyLines: string[] = [];

  function flushTask(): void {
    if (!currentTask) return;
    currentTask.body = bodyLines.join('\n').trim();
    bodyLines = [];
    currentSection = null;
    currentTask = null;
  }

  function flushGroupDescription(): void {
    if (!currentGroup) return;
    currentGroup.description = bodyLines.join('\n').trim();
    bodyLines = [];
    currentSection = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line: string = lines[i]!;
    const lineNum = i + 1;

    // --- Check for headings (highest priority transitions) ---

    const projectMatch = PROJECT_HEADING.exec(line);
    if (projectMatch && state === 'INIT' && projectMatch[1]) {
      project.name = projectMatch[1].trim();
      state = 'PROJECT';
      expectingMetadata = true;
      metadataTarget = 'project';
      continue;
    }

    const groupMatch = GROUP_HEADING.exec(line);
    if (groupMatch && groupMatch[1]) {
      // Flush previous task or group description
      if (state === 'TASK') flushTask();
      if (state === 'GROUP' && currentGroup && currentGroup.tasks.length === 0) {
        flushGroupDescription();
      }

      const groupName = groupMatch[1].trim();
      currentGroup = {
        name: groupName,
        prefix: derivePrefix(groupName),
        description: '',
        tasks: [],
      };
      groups.push(currentGroup);
      state = 'GROUP';
      expectingMetadata = true;
      metadataTarget = 'group';
      bodyLines = [];
      currentSection = null;
      continue;
    }

    const taskMatch = TASK_HEADING.exec(line);
    if (taskMatch && taskMatch[1] && taskMatch[2]) {
      // Flush previous task or group description
      if (state === 'TASK') flushTask();
      if (state === 'GROUP' && currentGroup && currentGroup.tasks.length === 0) {
        flushGroupDescription();
      }

      const ref = taskMatch[1];
      const title = taskMatch[2].trim();

      // Check for duplicate refs
      if (seenRefs.has(ref)) {
        errors.push({
          line: lineNum,
          message: `Duplicate task ref: ${ref}`,
          severity: 'error',
        });
      }
      seenRefs.add(ref);

      currentTask = {
        ref,
        title,
        body: '',
        dependsOn: [],
        successConditions: [],
        groupName: currentGroup?.name ?? null,
      };

      if (currentGroup) {
        currentGroup.tasks.push(currentTask);
      } else {
        orphanTasks.push(currentTask);
      }

      state = 'TASK';
      expectingMetadata = true;
      metadataTarget = 'task';
      bodyLines = [];
      currentSection = null;
      continue;
    }

    // --- Separator ---
    if (SEPARATOR.test(line)) {
      if (state === 'TASK') flushTask();
      if (state === 'GROUP' && currentGroup && currentGroup.tasks.length === 0) {
        flushGroupDescription();
      }
      currentSection = null;
      continue;
    }

    // --- Blockquote (metadata or project description) ---
    const bqMatch = BLOCKQUOTE.exec(line);
    if (bqMatch && expectingMetadata) {
      const content = (bqMatch[1] ?? '').trim();

      if (metadataTarget === 'project') {
        if (!projectDescriptionDone) {
          if (project.description) project.description += ' ';
          project.description += content;
        }
        continue;
      }

      if (metadataTarget === 'group' && currentGroup) {
        const meta = parseMetadataLine(content);
        if (Object.keys(meta).length > 0) {
          for (const key of Object.keys(meta)) {
            if (!KNOWN_GROUP_METADATA_KEYS.has(key)) {
              errors.push({
                line: lineNum,
                message: `Unknown group metadata key: ${key}`,
                severity: 'warning',
              });
            }
          }
          if (meta['size']) currentGroup.size = meta['size'];
          if (meta['risk']) currentGroup.risk = meta['risk'];
          continue;
        }
      }

      if (metadataTarget === 'task' && currentTask) {
        const meta = parseMetadataLine(content);
        if (Object.keys(meta).length > 0) {
          for (const key of Object.keys(meta)) {
            if (!KNOWN_TASK_METADATA_KEYS.has(key)) {
              errors.push({
                line: lineNum,
                message: `Unknown task metadata key: ${key}`,
                severity: 'warning',
              });
            }
          }
          if (meta['effort']) currentTask.effort = meta['effort'];
          if (meta['risk']) currentTask.risk = meta['risk'];
          if (meta['type']) currentTask.taskType = meta['type'];
          if (meta['ai']) currentTask.aiSuitability = meta['ai'];
          if (meta['depends_on']) {
            const raw = meta['depends_on'].trim();
            if (raw !== '-') {
              currentTask.dependsOn = raw.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          continue;
        }
      }

      // Not a metadata line — stop expecting metadata
      expectingMetadata = false;
    }

    // After first non-blockquote, non-empty line in PROJECT state, description is done
    if (state === 'PROJECT' && metadataTarget === 'project' && !bqMatch && line.trim()) {
      projectDescriptionDone = true;
      expectingMetadata = false;
    }

    // --- Section headers in project or task ---
    const sectionMatch = SECTION_HEADER.exec(line);
    if (sectionMatch && sectionMatch[1]) {
      const sectionName = sectionMatch[1].toLowerCase();

      if (state === 'PROJECT') {
        if (sectionName === 'constraints') {
          currentSection = 'constraints';
        } else if (sectionName === 'non-goals') {
          currentSection = 'nonGoals';
        } else if (sectionName === 'open questions') {
          currentSection = 'openQuestions';
        }
        continue;
      }

      if (state === 'TASK' && currentTask) {
        expectingMetadata = false;
        if (sectionName === 'success conditions') {
          currentSection = 'successConditions';
        } else {
          // Other sections (Technical notes, Open questions) become part of body
          currentSection = 'body';
          bodyLines.push(line);
        }
        continue;
      }
    }

    // --- Bullet items ---
    const bulletMatch = BULLET_ITEM.exec(line);
    if (bulletMatch && bulletMatch[1]) {
      if (state === 'PROJECT' && currentSection) {
        const item = bulletMatch[1].trim();
        if (currentSection === 'constraints') project.constraints.push(item);
        if (currentSection === 'nonGoals') project.nonGoals.push(item);
        if (currentSection === 'openQuestions') project.openQuestions.push(item);
        continue;
      }

      if (state === 'TASK' && currentTask && currentSection === 'successConditions') {
        currentTask.successConditions.push(bulletMatch[1].trim());
        continue;
      }
    }

    // --- Body accumulation ---
    if (state === 'TASK') {
      expectingMetadata = false;
      bodyLines.push(line);
      continue;
    }

    if (state === 'GROUP' && currentGroup && currentGroup.tasks.length === 0) {
      expectingMetadata = false;
      bodyLines.push(line);
      continue;
    }
  }

  // Flush last task/group
  if (state === 'TASK') flushTask();
  if (state === 'GROUP' && currentGroup && currentGroup.tasks.length === 0) {
    flushGroupDescription();
  }

  // --- Post-parse validation ---

  // Groups with no tasks
  for (const group of groups) {
    if (group.tasks.length === 0) {
      errors.push({
        line: 0,
        message: `Group "${group.name}" has no tasks`,
        severity: 'warning',
      });
    }
  }

  // Empty spec
  const allTasks = [...groups.flatMap(g => g.tasks), ...orphanTasks];
  if (allTasks.length === 0) {
    errors.push({
      line: 0,
      message: 'Spec contains no tasks',
      severity: 'warning',
    });
  }

  return { project, groups, orphanTasks, errors };
}
