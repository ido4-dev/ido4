/**
 * DependencyService — Implements IDependencyService for dependency analysis and validation.
 *
 * Key design decisions:
 * - Single class replaces CLI's DependencyService + DependencyAnalyzer + DependencyValidator
 * - Recursive tree building with circular dependency detection (visited + visiting sets)
 * - No internal caching (session-scoped, repos handle caching)
 * - Max recursion depth: 10
 */

import type {
  IDependencyService,
  IIssueRepository,
  IWorkflowConfig,
  DependencyAnalysisResult,
  DependencyNode,
  DependencyValidationResult,
} from '../../container/interfaces.js';
import type { ILogger } from '../../shared/logger.js';

const MAX_DEPTH = 10;

export class DependencyService implements IDependencyService {
  constructor(
    private readonly issueRepository: IIssueRepository,
    private readonly workflowConfig: IWorkflowConfig,
    private readonly logger: ILogger,
  ) {}

  /**
   * Parse dependency text into issue numbers.
   * Handles: "#123", "123", "Depends on: #123, #456", "#123, #456"
   * Skips: "No dependencies", empty strings, negative numbers.
   */
  static parseDependencies(text: string | undefined): number[] {
    if (!text || text.trim() === '' || text.toLowerCase().includes('no dependencies')) {
      return [];
    }

    const numbers = new Set<number>();
    const regex = /(?<!\w)#?(\d+)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const num = parseInt(match[1]!, 10);
      if (num > 0) {
        numbers.add(num);
      }
    }

    return [...numbers];
  }

  async analyzeDependencies(issueNumber: number): Promise<DependencyAnalysisResult> {
    const task = await this.issueRepository.getTask(issueNumber);
    const depNumbers = DependencyService.parseDependencies(task.dependencies);

    if (depNumbers.length === 0) {
      return {
        issueNumber,
        dependencies: [],
        circularDependencies: [],
        maxDepth: 0,
      };
    }

    const visited = new Set<number>();
    const circularPaths: number[][] = [];
    let maxDepth = 0;

    const dependencies: DependencyNode[] = [];
    for (const depNum of depNumbers) {
      const node = await this.buildDependencyNode(
        depNum,
        visited,
        new Set<number>([issueNumber]),
        circularPaths,
        1,
      );
      if (node) {
        dependencies.push(node);
        maxDepth = Math.max(maxDepth, this.getTreeDepth(node));
      }
    }

    this.logger.debug('Dependency analysis complete', {
      issueNumber,
      dependencyCount: dependencies.length,
      circularCount: circularPaths.length,
      maxDepth,
    });

    return { issueNumber, dependencies, circularDependencies: circularPaths, maxDepth };
  }

  async validateDependencies(issueNumber: number): Promise<DependencyValidationResult> {
    const analysis = await this.analyzeDependencies(issueNumber);

    const unsatisfied: number[] = [];
    this.collectUnsatisfied(analysis.dependencies, unsatisfied);

    return {
      valid: unsatisfied.length === 0 && analysis.circularDependencies.length === 0,
      unsatisfied,
      circular: analysis.circularDependencies,
    };
  }

  private async buildDependencyNode(
    issueNumber: number,
    visited: Set<number>,
    visiting: Set<number>,
    circularPaths: number[][],
    depth: number,
  ): Promise<DependencyNode | null> {
    // Circular detection
    if (visiting.has(issueNumber)) {
      circularPaths.push([...visiting, issueNumber]);
      return null;
    }

    // Already fully processed
    if (visited.has(issueNumber)) {
      // Still need to return a node but don't recurse
      try {
        const task = await this.issueRepository.getTask(issueNumber);
        return {
          issueNumber,
          title: task.title,
          status: task.status,
          satisfied: this.workflowConfig.isTerminalStatus(task.status),
          children: [],
        };
      } catch {
        return null;
      }
    }

    // Max depth
    if (depth > MAX_DEPTH) {
      return null;
    }

    visiting.add(issueNumber);

    try {
      const task = await this.issueRepository.getTask(issueNumber);
      const depNumbers = DependencyService.parseDependencies(task.dependencies);

      const children: DependencyNode[] = [];
      for (const childNum of depNumbers) {
        const child = await this.buildDependencyNode(
          childNum,
          visited,
          visiting,
          circularPaths,
          depth + 1,
        );
        if (child) {
          children.push(child);
        }
      }

      visiting.delete(issueNumber);
      visited.add(issueNumber);

      return {
        issueNumber,
        title: task.title,
        status: task.status,
        satisfied: this.workflowConfig.isTerminalStatus(task.status),
        children,
      };
    } catch (error) {
      visiting.delete(issueNumber);
      this.logger.debug('Failed to fetch dependency task', { issueNumber, error });
      return null;
    }
  }

  private collectUnsatisfied(nodes: DependencyNode[], result: number[]): void {
    for (const node of nodes) {
      if (!node.satisfied) {
        result.push(node.issueNumber);
      }
      this.collectUnsatisfied(node.children, result);
    }
  }

  private getTreeDepth(node: DependencyNode): number {
    if (node.children.length === 0) return 1;
    let max = 0;
    for (const child of node.children) {
      max = Math.max(max, this.getTreeDepth(child));
    }
    return 1 + max;
  }
}
