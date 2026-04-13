#!/usr/bin/env node

/**
 * ido4-tech-spec-format CLI — Structural validation for technical spec artifacts.
 *
 * Usage:
 *   ido4-tech-spec-format <file.md>
 *   ido4-tech-spec-format --version
 *   ido4-tech-spec-format --help
 *
 * Reads a technical spec markdown file, parses it, and outputs a rich JSON
 * result to stdout. Exit code 0 = valid, 1 = structural errors found,
 * 2 = usage/IO error.
 *
 * Designed for consumption by ido4specs agents — the JSON output provides full
 * parsed structure, computed metrics, and separated errors/warnings so the
 * agent can interpret results intelligently and suggest specific fixes.
 */

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseSpec } from './spec-parser.js';
import { SUPPORTED_FORMAT_VERSIONS } from './types.js';
import type { ParsedTask } from './types.js';

// When bundled by esbuild, __TECH_SPEC_FORMAT_VERSION__ is replaced with the literal
// version string. In unbundled (tsc) builds, it's undefined — fall back to reading
// package.json.
declare const __TECH_SPEC_FORMAT_VERSION__: string | undefined;

function getVersion(): string {
  if (typeof __TECH_SPEC_FORMAT_VERSION__ === 'string') {
    return __TECH_SPEC_FORMAT_VERSION__;
  }
  try {
    const pkgJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };
    return pkgJson.version;
  } catch {
    return 'unknown';
  }
}

const version = getVersion();

function main(): void {
  const arg = process.argv[2];

  if (!arg || arg === '--help' || arg === '-h') {
    const usage = [
      'Usage: ido4-tech-spec-format <file.md>',
      '       ido4-tech-spec-format --version',
      '',
      'Parses a technical spec and outputs structured JSON to stdout.',
      'Exit codes: 0 = valid, 1 = structural errors, 2 = usage/IO error.',
      '',
      `Supported format versions: ${SUPPORTED_FORMAT_VERSIONS.join(', ')}`,
    ];
    process.stderr.write(usage.join('\n') + '\n');
    process.exit(arg ? 0 : 2);
  }

  if (arg === '--version' || arg === '-v') {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  }

  const absolutePath = resolve(arg);
  let content: string;
  try {
    content = readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error reading file: ${message}\n`);
    process.exit(2);
  }

  const startMs = Date.now();
  const result = parseSpec(content);
  const durationMs = Date.now() - startMs;

  const errors = result.errors.filter(e => e.severity === 'error');
  const warnings = result.errors.filter(e => e.severity === 'warning');
  const allTasks = [
    ...result.groups.flatMap(g => g.tasks),
    ...result.orphanTasks,
  ];

  const output = {
    valid: errors.length === 0,
    meta: {
      file: absolutePath,
      parseDurationMs: durationMs,
      parserVersion: version,
      supportedFormatVersions: SUPPORTED_FORMAT_VERSIONS,
      // schemaVersion describes the shape of THIS JSON output, not the
      // technical-spec format version. Consumers can key their JSON-parsing
      // logic off this field so breaking changes to the CLI output shape
      // become explicit signals rather than silent drift.
      schemaVersion: '1.0',
    },
    metrics: {
      groupCount: result.groups.length,
      taskCount: allTasks.length,
      orphanTaskCount: result.orphanTasks.length,
      dependencyEdgeCount: allTasks.reduce((sum, t) => sum + t.dependsOn.length, 0),
      maxDependencyDepth: computeMaxDepth(allTasks),
      successConditionCount: allTasks.reduce((sum, t) => sum + t.successConditions.length, 0),
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    project: result.project,
    groups: result.groups.map(g => ({
      name: g.name,
      prefix: g.prefix,
      size: g.size,
      risk: g.risk,
      description: g.description,
      taskCount: g.tasks.length,
      tasks: g.tasks.map(t => ({
        ref: t.ref,
        title: t.title,
        effort: t.effort,
        risk: t.risk,
        taskType: t.taskType,
        aiSuitability: t.aiSuitability,
        dependsOn: t.dependsOn,
        successConditions: t.successConditions,
        groupName: t.groupName,
      })),
    })),
    orphanTasks: result.orphanTasks.map(t => ({
      ref: t.ref,
      title: t.title,
      effort: t.effort,
      risk: t.risk,
      taskType: t.taskType,
      aiSuitability: t.aiSuitability,
      dependsOn: t.dependsOn,
      successConditions: t.successConditions,
    })),
    dependencyGraph: buildDependencyGraph(allTasks),
    errors: errors.map(e => ({ line: e.line, message: e.message })),
    warnings: warnings.map(e => ({ line: e.line, message: e.message })),
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(errors.length > 0 ? 1 : 0);
}

function buildDependencyGraph(tasks: ParsedTask[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const task of tasks) {
    if (task.dependsOn.length > 0) {
      graph[task.ref] = task.dependsOn;
    }
  }
  return graph;
}

function computeMaxDepth(tasks: ParsedTask[]): number {
  const depMap = new Map<string, string[]>();
  for (const task of tasks) {
    depMap.set(task.ref, task.dependsOn);
  }
  const cache = new Map<string, number>();

  function depth(ref: string, visited: Set<string>): number {
    if (cache.has(ref)) return cache.get(ref)!;
    if (visited.has(ref)) return 0;
    visited.add(ref);
    const deps = depMap.get(ref) ?? [];
    const maxChildDepth = deps.reduce(
      (max, dep) => Math.max(max, depMap.has(dep) ? depth(dep, visited) : 0),
      0,
    );
    const result = deps.length > 0 ? maxChildDepth + 1 : 0;
    cache.set(ref, result);
    return result;
  }

  let maxDepth = 0;
  for (const task of tasks) {
    maxDepth = Math.max(maxDepth, depth(task.ref, new Set()));
  }
  return maxDepth;
}

main();
