import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface SportScoreEvidenceRequestMetadata {
  endpoint: 'fixtures' | 'match';
  path: string;
  query: Record<string, string>;
  requestedAt: string;
  completedAt: string;
  attempt: number;
  statusCode: number;
  authenticated: boolean;
}

export interface SportScoreRawEvidenceRecord {
  request: SportScoreEvidenceRequestMetadata;
  payload: unknown;
  redactions?: {
    inPlayMatchesOmitted?: number;
    inPlayMatchDetailOmitted?: boolean;
  };
}

export interface SportScoreRawEvidenceCacheOptions {
  rootDirectory: string;
  maxEntries?: number;
}

interface EvidenceFile {
  filePath: string;
  modifiedAt: number;
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

/**
 * Stores a small, private diagnostic trail. Callers must pass sanitized request
 * metadata; headers and credentials are deliberately absent from the contract.
 */
export class SportScoreRawEvidenceCache {
  private readonly rootDirectory: string;
  private readonly maxEntries: number;

  constructor(options: SportScoreRawEvidenceCacheOptions) {
    if (!options.rootDirectory.trim()) {
      throw new Error('SportScore raw evidence root directory is required.');
    }

    this.rootDirectory = path.resolve(options.rootDirectory);
    this.maxEntries = options.maxEntries ?? 100;
    requirePositiveInteger(this.maxEntries, 'SportScore raw evidence maxEntries');
  }

  async write(record: SportScoreRawEvidenceRecord): Promise<void> {
    const observedDate = record.request.completedAt.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observedDate)) {
      throw new Error('SportScore raw evidence completedAt must be an ISO timestamp.');
    }

    const dayDirectory = this.resolveContained(observedDate);
    await mkdir(dayDirectory, { recursive: true });

    const timestamp = record.request.completedAt.replaceAll(':', '-');
    const fileName = `${timestamp}-${randomUUID()}.json`;
    const targetPath = this.resolveContained(observedDate, fileName);
    const temporaryPath = `${targetPath}.tmp`;
    const serialized = `${JSON.stringify({
      schemaVersion: 1,
      sourceId: 'sportscore',
      ...record
    }, null, 2)}\n`;

    await writeFile(temporaryPath, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, targetPath);
    await this.prune();
  }

  private resolveContained(...segments: string[]): string {
    const candidate = path.resolve(this.rootDirectory, ...segments);
    const relative = path.relative(this.rootDirectory, candidate);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('SportScore raw evidence path escaped its private root.');
    }

    return candidate;
  }

  private async prune(): Promise<void> {
    const files = await this.listEvidenceFiles(this.rootDirectory);
    if (files.length <= this.maxEntries) {
      return;
    }

    files.sort((left, right) => left.modifiedAt - right.modifiedAt
      || left.filePath.localeCompare(right.filePath));
    await Promise.all(files
      .slice(0, files.length - this.maxEntries)
      .map((file) => rm(file.filePath, { force: true })));
  }

  private async listEvidenceFiles(directory: string): Promise<EvidenceFile[]> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const nested = await Promise.all(entries.map(async (entry): Promise<EvidenceFile[]> => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return this.listEvidenceFiles(entryPath);
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        return [];
      }

      const metadata = await stat(entryPath);
      return [{ filePath: entryPath, modifiedAt: metadata.mtimeMs }];
    }));

    return nested.flat();
  }
}
