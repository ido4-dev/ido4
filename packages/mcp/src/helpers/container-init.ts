/**
 * Lazy ServiceContainer initializer.
 *
 * Created on first tool call, shared across concurrent calls via promise caching.
 * Project root auto-detected from IDO4_PROJECT_ROOT env var or process.cwd().
 */

import { ServiceContainer, ConsoleLogger } from '@ido4/core';
import type { ServiceContainerConfig } from '@ido4/core';

let containerPromise: Promise<ServiceContainer> | null = null;

export function getContainer(): Promise<ServiceContainer> {
  if (!containerPromise) {
    containerPromise = initContainer();
  }
  return containerPromise;
}

export function resetContainer(): void {
  containerPromise = null;
}

async function initContainer(): Promise<ServiceContainer> {
  const projectRoot = process.env.IDO4_PROJECT_ROOT ?? process.cwd();
  const logger = new ConsoleLogger({ component: 'mcp-server' });

  logger.info('Initializing ServiceContainer', { projectRoot });

  const config: ServiceContainerConfig = {
    projectRoot,
    githubToken: process.env.GITHUB_TOKEN,
    logger,
    sessionId: crypto.randomUUID(),
  };

  return ServiceContainer.create(config);
}
