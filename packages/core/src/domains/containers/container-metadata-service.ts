/**
 * ContainerMetadataService — tracks container lifecycle metadata (start dates).
 *
 * Used by CircuitBreakerValidation to determine if a container's timebox has expired.
 * File-based implementation reads/writes .ido4/container-metadata.json.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// ─── Public Interface ───

export interface IContainerMetadataService {
  getContainerMetadata(containerName: string): Promise<ContainerMetadata | null>;
  setContainerMetadata(containerName: string, metadata: ContainerMetadata): Promise<void>;
}

export interface ContainerMetadata {
  /** ISO-8601 timestamp when the container was started/created */
  startDate: string;
  /** Matches ContainerTypeDefinition.id (e.g., 'cycle', 'sprint', 'wave') */
  containerTypeId: string;
}

// ─── File-Based Implementation ───

interface MetadataFile {
  containers: Record<string, ContainerMetadata>;
}

export class FileContainerMetadataService implements IContainerMetadataService {
  private readonly filePath: string;

  constructor(projectRoot: string) {
    this.filePath = path.join(projectRoot, '.ido4', 'container-metadata.json');
  }

  async getContainerMetadata(containerName: string): Promise<ContainerMetadata | null> {
    const data = await this.readFile();
    return data.containers[containerName] ?? null;
  }

  async setContainerMetadata(containerName: string, metadata: ContainerMetadata): Promise<void> {
    const data = await this.readFile();
    data.containers[containerName] = metadata;
    await this.writeFile(data);
  }

  private async readFile(): Promise<MetadataFile> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as MetadataFile;
    } catch {
      return { containers: {} };
    }
  }

  private async writeFile(data: MetadataFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

// ─── In-Memory Implementation (for testing) ───

export class InMemoryContainerMetadataService implements IContainerMetadataService {
  private store = new Map<string, ContainerMetadata>();

  async getContainerMetadata(containerName: string): Promise<ContainerMetadata | null> {
    return this.store.get(containerName) ?? null;
  }

  async setContainerMetadata(containerName: string, metadata: ContainerMetadata): Promise<void> {
    this.store.set(containerName, metadata);
  }
}
