/**
 * Strategic Spec Parser — Parses strategic spec markdown into a structured AST.
 *
 * Strategic specs are produced by ido4shape and consumed by ido4 MCP's
 * decomposition pipeline. They use the same heading patterns as technical specs
 * (# Project, ## Group:, ### PREFIX-NN:) but carry different metadata
 * (priority, strategic risk) and richer prose content.
 *
 * Pure function, no side effects, zero profile awareness.
 * Uses a line-by-line state machine: INIT → PROJECT → CROSS_CUTTING → GROUP → CAPABILITY.
 */

import type {
  ParsedStrategicSpec,
  StrategicProjectHeader,
  StrategicGroup,
  StrategicCapability,
  StrategicParseError,
  CrossCuttingConcern,
  Stakeholder,
} from './strategic-spec-types.js';
import { STRATEGIC_PRIORITIES, STRATEGIC_RISKS } from './strategic-spec-types.js';
import { parseMetadataLine, derivePrefix } from './spec-parse-utils.js';

type ParserState = 'INIT' | 'PROJECT' | 'CROSS_CUTTING' | 'GROUP' | 'CAPABILITY';

const PROJECT_HEADING = /^# (.+)$/;
const FORMAT_METADATA = /^>\s*format:\s*(.+?)\s*\|\s*version:\s*(.+)$/;
const GROUP_HEADING = /^## Group:\s*(.+)$/;
const CROSS_CUTTING_HEADING = /^## Cross-Cutting Concerns\s*$/i;
const CROSS_CUTTING_SUBSECTION = /^### (.+)$/;
const CAPABILITY_HEADING = /^### ([A-Z]{2,5}-\d{2,3}):\s*(.+)$/;
const BLOCKQUOTE = /^>\s?(.*)$/;
const BULLET_ITEM = /^(?:[-*+]|\d+\.)\s+(.+)$/;
const SECTION_HEADER = /^\*\*(.+?):\*\*\s*$/;
const SEPARATOR = /^---\s*$/;

const KNOWN_GROUP_METADATA_KEYS = new Set(['priority']);
const KNOWN_CAPABILITY_METADATA_KEYS = new Set(['priority', 'risk', 'depends_on']);

export function parseStrategicSpec(markdown: string): ParsedStrategicSpec {
  const lines = markdown.split('\n');
  const errors: StrategicParseError[] = [];

  let state: ParserState = 'INIT';
  const project: StrategicProjectHeader = {
    name: '',
    format: '',
    version: '',
    description: '',
    stakeholders: [],
    constraints: [],
    nonGoals: [],
    openQuestions: [],
  };

  const crossCuttingConcerns: CrossCuttingConcern[] = [];
  const groups: StrategicGroup[] = [];
  const orphanCapabilities: StrategicCapability[] = [];
  const seenRefs = new Set<string>();

  let currentGroup: StrategicGroup | null = null;
  let currentCapability: StrategicCapability | null = null;
  let currentCrossCutting: CrossCuttingConcern | null = null;

  // Track metadata parsing state
  let expectingMetadata = false;
  let metadataTarget: 'group' | 'capability' | 'project' = 'project';
  let projectDescriptionDone = false;
  let currentSection: string | null = null;

  // Body accumulation
  let bodyLines: string[] = [];

  function flushCapability(): void {
    if (!currentCapability) return;
    currentCapability.body = bodyLines.join('\n').trim();
    bodyLines = [];
    currentSection = null;
    currentCapability = null;
  }

  function flushGroupDescription(): void {
    if (!currentGroup) return;
    currentGroup.description = bodyLines.join('\n').trim();
    bodyLines = [];
    currentSection = null;
  }

  function flushCrossCutting(): void {
    if (!currentCrossCutting) return;
    currentCrossCutting.content = bodyLines.join('\n').trim();
    bodyLines = [];
    currentCrossCutting = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line: string = lines[i]!;
    const lineNum = i + 1;

    // --- Project heading ---
    const projectMatch = PROJECT_HEADING.exec(line);
    if (projectMatch && state === 'INIT' && projectMatch[1]) {
      project.name = projectMatch[1].trim();
      state = 'PROJECT';
      expectingMetadata = true;
      metadataTarget = 'project';
      continue;
    }

    // --- Cross-cutting concerns section ---
    if (CROSS_CUTTING_HEADING.test(line)) {
      if (state === 'CAPABILITY') flushCapability();
      if (state === 'GROUP' && currentGroup && currentGroup.capabilities.length === 0) {
        flushGroupDescription();
      }
      state = 'CROSS_CUTTING';
      bodyLines = [];
      currentSection = null;
      continue;
    }

    // --- Group heading ---
    const groupMatch = GROUP_HEADING.exec(line);
    if (groupMatch && groupMatch[1]) {
      if (state === 'CAPABILITY') flushCapability();
      if (state === 'GROUP' && currentGroup && currentGroup.capabilities.length === 0) {
        flushGroupDescription();
      }
      if (state === 'CROSS_CUTTING') flushCrossCutting();

      const groupName = groupMatch[1].trim();
      currentGroup = {
        name: groupName,
        prefix: derivePrefix(groupName),
        description: '',
        capabilities: [],
      };
      groups.push(currentGroup);
      state = 'GROUP';
      expectingMetadata = true;
      metadataTarget = 'group';
      bodyLines = [];
      currentSection = null;
      continue;
    }

    // --- Capability heading (### PREFIX-NN: Title) ---
    const capMatch = CAPABILITY_HEADING.exec(line);
    if (capMatch && capMatch[1] && capMatch[2]) {
      if (state === 'CAPABILITY') flushCapability();
      if (state === 'GROUP' && currentGroup && currentGroup.capabilities.length === 0) {
        flushGroupDescription();
      }
      if (state === 'CROSS_CUTTING') flushCrossCutting();

      const ref = capMatch[1];
      const title = capMatch[2].trim();

      // Check for duplicate refs
      if (seenRefs.has(ref)) {
        errors.push({
          line: lineNum,
          message: `Duplicate capability ref: ${ref}`,
          severity: 'error',
        });
      }
      seenRefs.add(ref);

      currentCapability = {
        ref,
        title,
        body: '',
        dependsOn: [],
        successConditions: [],
        groupName: currentGroup?.name ?? null,
      };

      if (currentGroup) {
        currentGroup.capabilities.push(currentCapability);
      } else {
        orphanCapabilities.push(currentCapability);
      }

      state = 'CAPABILITY';
      expectingMetadata = true;
      metadataTarget = 'capability';
      bodyLines = [];
      currentSection = null;
      continue;
    }

    // --- Cross-cutting subsection (### Performance, ### Security, etc.) ---
    if (state === 'CROSS_CUTTING') {
      const subsectionMatch = CROSS_CUTTING_SUBSECTION.exec(line);
      if (subsectionMatch && subsectionMatch[1]) {
        flushCrossCutting();
        currentCrossCutting = {
          name: subsectionMatch[1].trim(),
          content: '',
        };
        crossCuttingConcerns.push(currentCrossCutting);
        bodyLines = [];
        continue;
      }
    }

    // --- Separator ---
    if (SEPARATOR.test(line)) {
      if (state === 'CAPABILITY') flushCapability();
      if (state === 'GROUP' && currentGroup && currentGroup.capabilities.length === 0) {
        flushGroupDescription();
      }
      if (state === 'CROSS_CUTTING') flushCrossCutting();
      currentSection = null;
      continue;
    }

    // --- Blockquote (format metadata, project description, or group/capability metadata) ---
    const bqMatch = BLOCKQUOTE.exec(line);
    if (bqMatch) {
      const content = (bqMatch[1] ?? '').trim();

      // Check for format metadata on the line right after project heading
      if (state === 'PROJECT' && metadataTarget === 'project' && !projectDescriptionDone) {
        const formatMatch = FORMAT_METADATA.exec(line);
        if (formatMatch && formatMatch[1] && formatMatch[2]) {
          project.format = formatMatch[1].trim();
          project.version = formatMatch[2].trim();
          continue;
        }

        // Regular project description blockquote
        if (content) {
          if (project.description) project.description += ' ';
          project.description += content;
        }
        continue;
      }

      if (expectingMetadata && metadataTarget === 'group' && currentGroup) {
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
          if (meta['priority']) currentGroup.priority = meta['priority'];
          continue;
        }
      }

      if (expectingMetadata && metadataTarget === 'capability' && currentCapability) {
        const meta = parseMetadataLine(content);
        if (Object.keys(meta).length > 0) {
          for (const key of Object.keys(meta)) {
            if (!KNOWN_CAPABILITY_METADATA_KEYS.has(key)) {
              errors.push({
                line: lineNum,
                message: `Unknown capability metadata key: ${key}`,
                severity: 'warning',
              });
            }
          }
          if (meta['priority']) currentCapability.priority = meta['priority'];
          if (meta['risk']) currentCapability.risk = meta['risk'];
          if (meta['depends_on']) {
            const raw = meta['depends_on'].trim();
            if (raw !== '-') {
              currentCapability.dependsOn = raw.split(',').map(s => s.trim()).filter(Boolean);
            }
          }
          continue;
        }
      }

      // Not a metadata line — stop expecting metadata
      expectingMetadata = false;
    }

    // In PROJECT state, non-blockquote non-empty lines are either description
    // terminators (section headers like **Stakeholders:**) or plain-text description.
    // This accepts both blockquote and plain-text descriptions — matching ido4shape's
    // documented format where description is plain narrative paragraphs.
    if (state === 'PROJECT' && metadataTarget === 'project' && !bqMatch && line.trim()) {
      if (SECTION_HEADER.test(line)) {
        // Structural element — terminates description, falls through to section processing
        projectDescriptionDone = true;
        expectingMetadata = false;
      } else if (!projectDescriptionDone) {
        // Plain-text description paragraph — accumulate
        if (project.description) project.description += ' ';
        project.description += line.trim();
      }
    }

    // --- Section headers ---
    const sectionMatch = SECTION_HEADER.exec(line);
    if (sectionMatch && sectionMatch[1]) {
      const sectionName = sectionMatch[1].toLowerCase();

      if (state === 'PROJECT') {
        if (sectionName === 'stakeholders') {
          currentSection = 'stakeholders';
        } else if (sectionName === 'constraints') {
          currentSection = 'constraints';
        } else if (sectionName === 'non-goals') {
          currentSection = 'nonGoals';
        } else if (sectionName === 'open questions') {
          currentSection = 'openQuestions';
        }
        continue;
      }

      if (state === 'CAPABILITY' && currentCapability) {
        expectingMetadata = false;
        if (sectionName === 'success conditions') {
          currentSection = 'successConditions';
        } else {
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
        if (currentSection === 'stakeholders') {
          const stakeholder = parseStakeholder(item);
          if (stakeholder) {
            project.stakeholders.push(stakeholder);
          }
        } else if (currentSection === 'constraints') {
          project.constraints.push(item);
        } else if (currentSection === 'nonGoals') {
          project.nonGoals.push(item);
        } else if (currentSection === 'openQuestions') {
          project.openQuestions.push(item);
        }
        continue;
      }

      if (state === 'CAPABILITY' && currentCapability && currentSection === 'successConditions') {
        currentCapability.successConditions.push(bulletMatch[1].trim());
        continue;
      }
    }

    // --- Body accumulation ---
    if (state === 'CAPABILITY') {
      expectingMetadata = false;
      bodyLines.push(line);
      continue;
    }

    if (state === 'GROUP' && currentGroup && currentGroup.capabilities.length === 0) {
      expectingMetadata = false;
      bodyLines.push(line);
      continue;
    }

    if (state === 'CROSS_CUTTING' && currentCrossCutting) {
      bodyLines.push(line);
      continue;
    }
  }

  // Flush last entity
  if (state === 'CAPABILITY') flushCapability();
  if (state === 'GROUP' && currentGroup && currentGroup.capabilities.length === 0) {
    flushGroupDescription();
  }
  if (state === 'CROSS_CUTTING') flushCrossCutting();

  // --- Post-parse validation ---

  // Format marker
  if (project.format !== 'strategic-spec') {
    errors.push({
      line: 0,
      message: 'Missing or invalid format marker: expected "format: strategic-spec | version: 1.0"',
      severity: 'error',
    });
  }

  // Groups with no capabilities
  for (const group of groups) {
    if (group.capabilities.length === 0) {
      errors.push({
        line: 0,
        message: `Group "${group.name}" has no capabilities`,
        severity: 'warning',
      });
    }
  }

  // Empty spec
  const allCapabilities = [...groups.flatMap(g => g.capabilities), ...orphanCapabilities];
  if (allCapabilities.length === 0) {
    errors.push({
      line: 0,
      message: 'Strategic spec contains no capabilities',
      severity: 'warning',
    });
  }

  // Validate metadata values
  for (const group of groups) {
    if (group.priority && !STRATEGIC_PRIORITIES.includes(group.priority as typeof STRATEGIC_PRIORITIES[number])) {
      errors.push({
        line: 0,
        message: `Group "${group.name}" has invalid priority: "${group.priority}" (expected: ${STRATEGIC_PRIORITIES.join(', ')})`,
        severity: 'warning',
      });
    }
  }

  for (const cap of allCapabilities) {
    if (cap.priority && !STRATEGIC_PRIORITIES.includes(cap.priority as typeof STRATEGIC_PRIORITIES[number])) {
      errors.push({
        line: 0,
        message: `Capability ${cap.ref} has invalid priority: "${cap.priority}" (expected: ${STRATEGIC_PRIORITIES.join(', ')})`,
        severity: 'warning',
      });
    }
    if (cap.risk && !STRATEGIC_RISKS.includes(cap.risk as typeof STRATEGIC_RISKS[number])) {
      errors.push({
        line: 0,
        message: `Capability ${cap.ref} has invalid risk: "${cap.risk}" (expected: ${STRATEGIC_RISKS.join(', ')})`,
        severity: 'warning',
      });
    }
  }

  // Validate dependency references
  for (const cap of allCapabilities) {
    for (const dep of cap.dependsOn) {
      if (!seenRefs.has(dep)) {
        errors.push({
          line: 0,
          message: `Capability ${cap.ref} depends on "${dep}" which does not exist`,
          severity: 'error',
        });
      }
    }
  }

  // Detect circular dependencies (Kahn's algorithm)
  const circularCheck = detectCircularDependencies(allCapabilities);
  if (circularCheck) {
    errors.push({
      line: 0,
      message: `Circular dependency detected: ${circularCheck.join(' → ')}`,
      severity: 'error',
    });
  }

  return { project, crossCuttingConcerns, groups, orphanCapabilities, errors };
}

function parseStakeholder(item: string): Stakeholder | null {
  // Formats: "Name (Role): Perspective" or "Name: Perspective"
  const match = item.match(/^(.+?):\s+(.+)$/);
  if (match && match[1] && match[2]) {
    return { name: match[1].trim(), perspective: match[2].trim() };
  }
  return null;
}

function detectCircularDependencies(capabilities: StrategicCapability[]): string[] | null {
  const refs = new Set(capabilities.map(c => c.ref));
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const ref of refs) {
    adjList.set(ref, []);
    inDegree.set(ref, 0);
  }

  for (const cap of capabilities) {
    for (const dep of cap.dependsOn) {
      if (refs.has(dep)) {
        adjList.get(dep)!.push(cap.ref);
        inDegree.set(cap.ref, (inDegree.get(cap.ref) ?? 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [ref, degree] of inDegree) {
    if (degree === 0) queue.push(ref);
  }

  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    processed++;
    for (const neighbor of adjList.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (processed === refs.size) return null;

  // Return the refs involved in the cycle
  return [...inDegree.entries()]
    .filter(([, degree]) => degree > 0)
    .map(([ref]) => ref);
}
