#!/usr/bin/env node

/**
 * ido4-spec-format CLI — Structural validation for strategic spec artifacts.
 *
 * Usage: ido4-spec-format <file.md>
 *
 * Reads a strategic spec markdown file, parses it, and outputs a rich JSON
 * result to stdout. Exit code 0 = valid, 1 = structural errors found,
 * 2 = usage/IO error.
 *
 * Designed for consumption by ido4shape agents in Cowork — the JSON output
 * provides full parsed structure, computed metrics, and separated errors/warnings
 * so the agent can interpret results intelligently and suggest specific fixes.
 */

import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseStrategicSpec } from './strategic-spec-parser.js';
import type { StrategicCapability } from './strategic-spec-types.js';

// When bundled by esbuild, __SPEC_FORMAT_VERSION__ is replaced with the literal version string.
// In unbundled (tsc) builds, it's undefined — fall back to reading package.json.
declare const __SPEC_FORMAT_VERSION__: string | undefined;

function getVersion(): string {
  if (typeof __SPEC_FORMAT_VERSION__ === 'string') {
    return __SPEC_FORMAT_VERSION__;
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
  const filePath = process.argv[2];

  if (!filePath || filePath === '--help' || filePath === '-h') {
    const usage = [
      'Usage: ido4-spec-format <file.md>',
      '',
      'Parses a strategic spec and outputs structured JSON to stdout.',
      'Exit codes: 0 = valid, 1 = structural errors, 2 = usage/IO error.',
    ];
    process.stderr.write(usage.join('\n') + '\n');
    process.exit(filePath ? 0 : 2);
  }

  const absolutePath = resolve(filePath);
  let content: string;
  try {
    content = readFileSync(absolutePath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error reading file: ${message}\n`);
    process.exit(2);
  }

  const startMs = Date.now();
  const result = parseStrategicSpec(content);
  const durationMs = Date.now() - startMs;

  const errors = result.errors.filter(e => e.severity === 'error');
  const warnings = result.errors.filter(e => e.severity === 'warning');
  const allCapabilities = [
    ...result.groups.flatMap(g => g.capabilities),
    ...result.orphanCapabilities,
  ];

  const output = {
    valid: errors.length === 0,
    meta: {
      file: absolutePath,
      parseDurationMs: durationMs,
      parserVersion: version,
    },
    metrics: {
      groupCount: result.groups.length,
      capabilityCount: allCapabilities.length,
      orphanCapabilityCount: result.orphanCapabilities.length,
      crossCuttingConcernCount: result.crossCuttingConcerns.length,
      dependencyEdgeCount: allCapabilities.reduce((sum, c) => sum + c.dependsOn.length, 0),
      maxDependencyDepth: computeMaxDepth(allCapabilities),
      errorCount: errors.length,
      warningCount: warnings.length,
    },
    project: result.project,
    crossCuttingConcerns: result.crossCuttingConcerns,
    groups: result.groups.map(g => ({
      name: g.name,
      prefix: g.prefix,
      priority: g.priority,
      description: g.description,
      capabilityCount: g.capabilities.length,
      capabilities: g.capabilities.map(c => ({
        ref: c.ref,
        title: c.title,
        priority: c.priority,
        risk: c.risk,
        dependsOn: c.dependsOn,
        successConditions: c.successConditions,
        groupName: c.groupName,
      })),
    })),
    orphanCapabilities: result.orphanCapabilities.map(c => ({
      ref: c.ref,
      title: c.title,
      priority: c.priority,
      risk: c.risk,
      dependsOn: c.dependsOn,
      successConditions: c.successConditions,
    })),
    dependencyGraph: buildDependencyGraph(allCapabilities),
    errors: errors.map(e => ({ line: e.line, message: e.message })),
    warnings: warnings.map(e => ({ line: e.line, message: e.message })),
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(errors.length > 0 ? 1 : 0);
}

function buildDependencyGraph(capabilities: StrategicCapability[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const cap of capabilities) {
    if (cap.dependsOn.length > 0) {
      graph[cap.ref] = cap.dependsOn;
    }
  }
  return graph;
}

function computeMaxDepth(capabilities: StrategicCapability[]): number {
  const depMap = new Map<string, string[]>();
  for (const cap of capabilities) {
    depMap.set(cap.ref, cap.dependsOn);
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
  for (const cap of capabilities) {
    maxDepth = Math.max(maxDepth, depth(cap.ref, new Set()));
  }
  return maxDepth;
}

main();
