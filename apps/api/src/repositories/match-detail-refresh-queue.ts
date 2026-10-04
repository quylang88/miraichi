import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes, randomUUID } from 'node:crypto';

export type MatchDetailRefreshStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'quota_deferred';

export interface MatchDetailRefreshItem {
  matchId: string;
  status: MatchDetailRefreshStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const MATCH_DETAIL_REFRESH_QUEUE_SCHEMA_VERSION =
  'miraichi.match-detail-refresh-queue.v1' as const;

export interface MatchDetailRefreshQueueState {
  schemaVersion: typeof MATCH_DETAIL_REFRESH_QUEUE_SCHEMA_VERSION;
  items: Record<string, MatchDetailRefreshItem>;
  updatedAt: string;
}

export interface MatchDetailRefreshQueueOptions {
  dataRoot: string;
  lockTimeoutMs?: number;
  staleLockTimeoutMs?: number;
  lockRetryDelayMs?: number;
  processingLeaseMs?: number;
  now?: () => Date;
  sleepFn?: (ms: number) => Promise<void>;
  _writeHook?: (stage: 'before-sync' | 'before-rename') => Promise<void> | void;
}

export interface EnqueueOptions {
  maxAttempts?: number;
  now?: Date;
}

export interface MarkDeferredOptions {
  nextAttemptAt?: string;
  now?: Date;
}

export interface MarkFailedOptions {
  nextAttemptAt?: string;
  terminal?: boolean;
  now?: Date;
}

export const VALID_REFRESH_STATUSES: readonly MatchDetailRefreshStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'quota_deferred'
] as const;

export function resolveContainedPath(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const relativePath = path.relative(resolvedRoot, candidate);
  if (
    (relativePath === '' && segments.length > 0) ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath.startsWith('..\\') ||
    relativePath.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path escaped its allowed root: ${candidate}`);
  }
  return candidate;
}

export function assertSafeMatchId(matchId: string): void {
  if (typeof matchId !== 'string' || matchId.trim() === '') {
    throw new Error('Match ID must be a non-empty string');
  }
  if (
    !/^[A-Za-z0-9_-]+$/u.test(matchId) ||
    matchId === '__proto__' ||
    matchId === 'constructor' ||
    matchId === 'prototype'
  ) {
    throw new Error(`Unsafe match ID rejected: "${matchId}"`);
  }
}

export function validateMatchDetailRefreshItem(item: unknown): item is MatchDetailRefreshItem {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false;
  }
  const candidate = item as Partial<MatchDetailRefreshItem>;
  try {
    if (typeof candidate.matchId !== 'string') return false;
    assertSafeMatchId(candidate.matchId);
  } catch {
    return false;
  }
  if (
    typeof candidate.status !== 'string' ||
    !VALID_REFRESH_STATUSES.includes(candidate.status as MatchDetailRefreshStatus) ||
    typeof candidate.attempts !== 'number' ||
    !Number.isInteger(candidate.attempts) ||
    candidate.attempts < 0 ||
    typeof candidate.maxAttempts !== 'number' ||
    !Number.isInteger(candidate.maxAttempts) ||
    candidate.maxAttempts <= 0 ||
    typeof candidate.nextAttemptAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.nextAttemptAt)) ||
    typeof candidate.createdAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.createdAt)) ||
    typeof candidate.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(candidate.updatedAt))
  ) {
    return false;
  }
  if (
    candidate.lastAttemptAt !== undefined &&
    candidate.lastAttemptAt !== null &&
    (typeof candidate.lastAttemptAt !== 'string' || Number.isNaN(Date.parse(candidate.lastAttemptAt)))
  ) {
    return false;
  }
  if (
    candidate.lastError !== undefined &&
    candidate.lastError !== null &&
    typeof candidate.lastError !== 'string'
  ) {
    return false;
  }
  return true;
}

function sanitizeItem(item: MatchDetailRefreshItem): MatchDetailRefreshItem {
  const result: MatchDetailRefreshItem = {
    matchId: item.matchId,
    status: item.status,
    attempts: item.attempts,
    maxAttempts: item.maxAttempts,
    nextAttemptAt: item.nextAttemptAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
  if (item.lastAttemptAt !== undefined) {
    result.lastAttemptAt = item.lastAttemptAt;
  }
  if (item.lastError !== undefined) {
    result.lastError = item.lastError;
  }
  return result;
}

function validateQueueState(data: unknown): MatchDetailRefreshQueueState | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const candidate = data as Partial<MatchDetailRefreshQueueState>;
  if (candidate.schemaVersion !== MATCH_DETAIL_REFRESH_QUEUE_SCHEMA_VERSION) {
    return null;
  }
  if (!candidate.items || typeof candidate.items !== 'object' || Array.isArray(candidate.items)) {
    return null;
  }
  if (typeof candidate.updatedAt !== 'string' || Number.isNaN(Date.parse(candidate.updatedAt))) {
    return null;
  }
  const cleanItems: Record<string, MatchDetailRefreshItem> = {};
  for (const [key, val] of Object.entries(candidate.items)) {
    if (!validateMatchDetailRefreshItem(val) || val.matchId !== key) {
      return null;
    }
    cleanItems[key] = sanitizeItem(val);
  }
  return {
    schemaVersion: MATCH_DETAIL_REFRESH_QUEUE_SCHEMA_VERSION,
    items: cleanItems,
    updatedAt: candidate.updatedAt
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export class MatchDetailRefreshQueue {
  private readonly queueDir: string;
  private readonly queueFilePath: string;
  private readonly lockFilePath: string;
  private readonly backupFilePath: string;
  private readonly lockTimeoutMs: number;
  private readonly staleLockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly processingLeaseMs: number;
  private readonly now: () => Date;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly writeHook?: (stage: 'before-sync' | 'before-rename') => Promise<void> | void;

  constructor(options: MatchDetailRefreshQueueOptions | string) {
    const dataRoot = typeof options === 'string' ? options : options?.dataRoot;
    if (!dataRoot || typeof dataRoot !== 'string' || dataRoot.trim() === '') {
      throw new Error('dataRoot must be a non-empty string');
    }
    const resolvedRoot = path.resolve(dataRoot);
    this.queueDir = resolveContainedPath(resolvedRoot, 'match-detail-refresh');
    this.queueFilePath = resolveContainedPath(this.queueDir, 'queue.json');
    this.lockFilePath = resolveContainedPath(this.queueDir, 'queue.lock');
    this.backupFilePath = resolveContainedPath(this.queueDir, '.backup-queue.json');

    if (typeof options === 'object') {
      this.lockTimeoutMs = options.lockTimeoutMs ?? 15_000;
      this.staleLockTimeoutMs = options.staleLockTimeoutMs ?? 10_000;
      this.lockRetryDelayMs = options.lockRetryDelayMs ?? 50;
      this.processingLeaseMs = options.processingLeaseMs ?? 15 * 60 * 1000;
      if (!Number.isFinite(this.processingLeaseMs) || this.processingLeaseMs <= 0) {
        throw new Error('processingLeaseMs must be a positive number');
      }
      this.now = options.now ?? (() => new Date());
      this.sleepFn = options.sleepFn ?? ((ms: number) => new Promise((res) => setTimeout(res, ms)));
      if (options._writeHook) {
        this.writeHook = options._writeHook;
      }
    } else {
      this.lockTimeoutMs = 15_000;
      this.staleLockTimeoutMs = 10_000;
      this.lockRetryDelayMs = 50;
      this.processingLeaseMs = 15 * 60 * 1000;
      this.now = () => new Date();
      this.sleepFn = (ms: number) => new Promise((res) => setTimeout(res, ms));
    }
  }

  public getQueueDir(): string {
    return this.queueDir;
  }

  public getQueueFilePath(): string {
    return this.queueFilePath;
  }

  public async enqueue(
    matchId: string,
    options?: EnqueueOptions
  ): Promise<MatchDetailRefreshItem> {
    assertSafeMatchId(matchId);
    const now = options?.now ?? this.now();
    const maxAttempts = options?.maxAttempts ?? 3;
    if (typeof maxAttempts !== 'number' || !Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error('maxAttempts must be a positive integer');
    }

    return this.withLock(async () => {
      const state = await this.readState();
      const existing = state.items[matchId];

      if (existing) {
        if (
          existing.status === 'pending' ||
          existing.status === 'processing' ||
          existing.status === 'completed'
        ) {
          return sanitizeItem(existing);
        }

        if (existing.status === 'failed') {
          return sanitizeItem(existing);
        }

        // A quota deferral becomes pending again only after its due time.
        const nextAttemptTime = Date.parse(existing.nextAttemptAt);
        if (Number.isNaN(nextAttemptTime) || nextAttemptTime <= now.getTime()) {
          existing.status = 'pending';
          existing.attempts = 0;
          existing.maxAttempts = maxAttempts;
          existing.nextAttemptAt = now.toISOString();
          existing.lastError = null;
          existing.updatedAt = now.toISOString();
          state.updatedAt = now.toISOString();
          await this.writeState(state);
          return sanitizeItem(existing);
        }

        return sanitizeItem(existing);
      }

      const newItem: MatchDetailRefreshItem = {
        matchId,
        status: 'pending',
        attempts: 0,
        maxAttempts,
        nextAttemptAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      state.items[matchId] = newItem;
      state.updatedAt = now.toISOString();
      await this.writeState(state);
      return sanitizeItem(newItem);
    });
  }

  public async getDueItems(
    limit = 20,
    now = this.now()
  ): Promise<MatchDetailRefreshItem[]> {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
      throw new Error('limit must be a positive integer');
    }

    return this.withLock(async () => {
      const state = await this.readState();
      const nowMs = now.getTime();

      const dueItems = Object.values(state.items).filter((item) => {
        const nextTime = Date.parse(item.nextAttemptAt);
        const isTimeDue = !Number.isNaN(nextTime) && nextTime <= nowMs;
        if (
          item.status === 'pending' ||
          item.status === 'quota_deferred' ||
          item.status === 'processing'
        ) {
          return isTimeDue;
        }
        return false;
      });

      dueItems.sort((a, b) => {
        const timeA = Date.parse(a.nextAttemptAt);
        const timeB = Date.parse(b.nextAttemptAt);
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        return a.matchId.localeCompare(b.matchId);
      });

      return dueItems.slice(0, limit).map((item) => sanitizeItem(item));
    });
  }

  public async markProcessing(
    matchIds: string[],
    now = this.now()
  ): Promise<void> {
    if (!Array.isArray(matchIds)) {
      throw new Error('matchIds must be an array');
    }
    for (const matchId of matchIds) {
      assertSafeMatchId(matchId);
    }
    if (matchIds.length === 0) return;

    await this.withLock(async () => {
      const state = await this.readState();
      let modified = false;

      for (const matchId of matchIds) {
        const item = state.items[matchId];
        if (item) {
          item.status = 'processing';
          item.attempts += 1;
          item.lastAttemptAt = now.toISOString();
          item.nextAttemptAt = new Date(now.getTime() + this.processingLeaseMs).toISOString();
          item.lastError = null;
          item.updatedAt = now.toISOString();
          modified = true;
        }
      }

      if (modified) {
        state.updatedAt = now.toISOString();
        await this.writeState(state);
      }
    });
  }

  public async markCompleted(
    matchIds: string[],
    now = this.now()
  ): Promise<void> {
    if (!Array.isArray(matchIds)) {
      throw new Error('matchIds must be an array');
    }
    for (const matchId of matchIds) {
      assertSafeMatchId(matchId);
    }
    if (matchIds.length === 0) return;

    await this.withLock(async () => {
      const state = await this.readState();
      let modified = false;

      for (const matchId of matchIds) {
        const item = state.items[matchId];
        if (item) {
          item.status = 'completed';
          item.lastError = null;
          item.updatedAt = now.toISOString();
          modified = true;
        }
      }

      if (modified) {
        state.updatedAt = now.toISOString();
        await this.writeState(state);
      }
    });
  }

  public async markDeferred(
    matchIds: string[],
    reason?: string,
    optionsOrNow?: MarkDeferredOptions | Date,
    maybeNow?: Date
  ): Promise<void> {
    if (!Array.isArray(matchIds)) {
      throw new Error('matchIds must be an array');
    }
    for (const matchId of matchIds) {
      assertSafeMatchId(matchId);
    }
    if (matchIds.length === 0) return;

    let effectiveNow: Date;
    let nextAttemptAt: string | undefined;

    if (optionsOrNow instanceof Date) {
      effectiveNow = optionsOrNow;
    } else if (optionsOrNow && typeof optionsOrNow === 'object') {
      effectiveNow = optionsOrNow.now ?? this.now();
      nextAttemptAt = optionsOrNow.nextAttemptAt;
    } else if (maybeNow instanceof Date) {
      effectiveNow = maybeNow;
    } else {
      effectiveNow = this.now();
    }
    if (nextAttemptAt !== undefined && Number.isNaN(Date.parse(nextAttemptAt))) {
      throw new Error('nextAttemptAt must be a valid ISO datetime');
    }

    await this.withLock(async () => {
      const state = await this.readState();
      let modified = false;

      for (const matchId of matchIds) {
        const item = state.items[matchId];
        if (item) {
          item.status = 'quota_deferred';
          if (reason !== undefined) {
            item.lastError = reason;
          }
          if (nextAttemptAt !== undefined) {
            item.nextAttemptAt = nextAttemptAt;
          }
          item.updatedAt = effectiveNow.toISOString();
          modified = true;
        }
      }

      if (modified) {
        state.updatedAt = effectiveNow.toISOString();
        await this.writeState(state);
      }
    });
  }

  public async markFailed(
    matchIds: string[],
    error: string,
    nextAttemptAtOrOptions?: string | MarkFailedOptions,
    nowArg?: Date
  ): Promise<void> {
    if (!Array.isArray(matchIds)) {
      throw new Error('matchIds must be an array');
    }
    for (const matchId of matchIds) {
      assertSafeMatchId(matchId);
    }
    if (typeof error !== 'string') {
      throw new Error('error must be a string');
    }
    if (matchIds.length === 0) return;

    let nextAttemptAt: string | undefined;
    let terminal = false;
    let now = this.now();

    if (typeof nextAttemptAtOrOptions === 'string') {
      nextAttemptAt = nextAttemptAtOrOptions;
      if (nowArg instanceof Date) {
        now = nowArg;
      }
    } else if (typeof nextAttemptAtOrOptions === 'object' && nextAttemptAtOrOptions !== null) {
      nextAttemptAt = nextAttemptAtOrOptions.nextAttemptAt;
      terminal = Boolean(nextAttemptAtOrOptions.terminal);
      if (nextAttemptAtOrOptions.now instanceof Date) {
        now = nextAttemptAtOrOptions.now;
      }
    } else if (nowArg instanceof Date) {
      now = nowArg;
    }
    if (nextAttemptAt !== undefined && Number.isNaN(Date.parse(nextAttemptAt))) {
      throw new Error('nextAttemptAt must be a valid ISO datetime');
    }

    await this.withLock(async () => {
      const state = await this.readState();
      let modified = false;

      for (const matchId of matchIds) {
        const item = state.items[matchId];
        if (item) {
          item.lastError = error;
          item.updatedAt = now.toISOString();

          if (terminal || item.attempts >= item.maxAttempts) {
            item.status = 'failed';
            if (nextAttemptAt !== undefined) {
              item.nextAttemptAt = nextAttemptAt;
            }
          } else {
            if (nextAttemptAt !== undefined) {
              item.nextAttemptAt = nextAttemptAt;
            }
            item.status = 'pending';
          }
          modified = true;
        }
      }

      if (modified) {
        state.updatedAt = now.toISOString();
        await this.writeState(state);
      }
    });
  }

  public async getItem(matchId: string): Promise<MatchDetailRefreshItem | null> {
    assertSafeMatchId(matchId);
    return this.withLock(async () => {
      const state = await this.readState();
      const item = state.items[matchId];
      return item ? sanitizeItem(item) : null;
    });
  }

  public async pruneCompleted(
    olderThanSeconds = 86400,
    now = this.now()
  ): Promise<number> {
    if (typeof olderThanSeconds !== 'number' || olderThanSeconds < 0) {
      throw new Error('olderThanSeconds must be a non-negative number');
    }

    return this.withLock(async () => {
      const state = await this.readState();
      const cutoffMs = now.getTime() - olderThanSeconds * 1000;
      let prunedCount = 0;

      for (const [matchId, item] of Object.entries(state.items)) {
        if (item.status === 'completed') {
          const updatedMs = Date.parse(item.updatedAt);
          if (!Number.isNaN(updatedMs) && updatedMs <= cutoffMs) {
            delete state.items[matchId];
            prunedCount += 1;
          }
        }
      }

      if (prunedCount > 0) {
        state.updatedAt = now.toISOString();
        await this.writeState(state);
      }

      return prunedCount;
    });
  }

  public async getAllItems(): Promise<MatchDetailRefreshItem[]> {
    return this.withLock(async () => {
      const state = await this.readState();
      return Object.values(state.items).map((item) => sanitizeItem(item));
    });
  }

  public async size(): Promise<number> {
    return this.withLock(async () => {
      const state = await this.readState();
      return Object.keys(state.items).length;
    });
  }

  public async clear(): Promise<void> {
    return this.withLock(async () => {
      const state = this.createInitialState();
      await this.writeState(state);
    });
  }

  public async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquireLock();
    try {
      return await operation();
    } finally {
      await release();
    }
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    const startTime = Date.now();
    await fs.mkdir(this.queueDir, { recursive: true });

    while (true) {
      try {
        const lockId = randomUUID();
        const handle = await fs.open(this.lockFilePath, 'wx');
        try {
          const lockInfo = JSON.stringify({
            pid: process.pid,
            createdAt: this.now().toISOString(),
            createdAtMs: Date.now(),
            id: lockId
          });
          await handle.writeFile(lockInfo, 'utf8');
        } finally {
          await handle.close().catch(() => {});
        }

        let released = false;
        return async () => {
          if (released) return;
          released = true;
          try {
            const content = await fs.readFile(this.lockFilePath, 'utf8');
            const currentLock = JSON.parse(content) as { id?: string };
            if (currentLock.id === lockId) {
              await fs.unlink(this.lockFilePath);
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        };
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EEXIST') {
          try {
            const content = await fs.readFile(this.lockFilePath, 'utf8');
            const parsed = JSON.parse(content) as {
              pid?: number;
              createdAtMs?: number;
              createdAt?: string;
            };
            const createdAtMs =
              typeof parsed.createdAtMs === 'number'
                ? parsed.createdAtMs
                : parsed.createdAt
                ? Date.parse(parsed.createdAt)
                : NaN;

            const lockAge =
              !Number.isNaN(createdAtMs)
                ? Date.now() - createdAtMs
                : Date.now() - (await fs.stat(this.lockFilePath)).mtimeMs;

            const ownerIsAlive = typeof parsed.pid === 'number' && isProcessAlive(parsed.pid);
            if (ownerIsAlive) {
              // A live owner retains its lock regardless of age.
            } else if (lockAge > this.staleLockTimeoutMs || typeof parsed.pid === 'number') {
              await fs.unlink(this.lockFilePath).catch(() => {});
              continue;
            }
          } catch {
            try {
              const stats = await fs.stat(this.lockFilePath);
              const lockAge = Date.now() - stats.mtimeMs;
              if (lockAge > this.staleLockTimeoutMs) {
                await fs.unlink(this.lockFilePath).catch(() => {});
                continue;
              }
            } catch {
              continue;
            }
          }

          const elapsed = Date.now() - startTime;
          if (elapsed > this.lockTimeoutMs) {
            throw new Error(
              `Timeout acquiring lock for match detail refresh queue at ${this.lockFilePath} after ${elapsed}ms`
            );
          }

          await this.sleepFn(this.lockRetryDelayMs);
        } else {
          throw err;
        }
      }
    }
  }

  private async readState(): Promise<MatchDetailRefreshQueueState> {
    let content: string;
    let recoveredFromBackup = false;

    try {
      content = await fs.readFile(this.queueFilePath, 'utf8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        try {
          content = await fs.readFile(this.backupFilePath, 'utf8');
          recoveredFromBackup = true;
        } catch (backupError) {
          if ((backupError as NodeJS.ErrnoException).code === 'ENOENT') {
            return this.createInitialState();
          }
          throw backupError;
        }
      } else {
        throw error;
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      if (!recoveredFromBackup) {
        try {
          const backupContent = await fs.readFile(this.backupFilePath, 'utf8');
          parsed = JSON.parse(backupContent);
          recoveredFromBackup = true;
        } catch {
          throw new Error(`Corrupted queue storage file at ${this.queueFilePath}`);
        }
      } else {
        throw new Error(`Corrupted queue storage file at ${this.queueFilePath}`);
      }
    }

    const validated = validateQueueState(parsed);
    if (!validated) {
      throw new Error(`Invalid queue state schema in ${this.queueFilePath}`);
    }

    if (recoveredFromBackup) {
      try {
        await fs.rename(this.backupFilePath, this.queueFilePath);
      } catch {
        // Ignore rename failure
      }
    }

    return validated;
  }

  private createInitialState(): MatchDetailRefreshQueueState {
    return {
      schemaVersion: MATCH_DETAIL_REFRESH_QUEUE_SCHEMA_VERSION,
      items: {},
      updatedAt: this.now().toISOString()
    };
  }

  private async writeState(state: MatchDetailRefreshQueueState): Promise<void> {
    await fs.mkdir(this.queueDir, { recursive: true });
    const tempFileName = `.tmp-queue-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const tempPath = resolveContainedPath(this.queueDir, tempFileName);

    const handle = await fs.open(tempPath, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
      if (this.writeHook) {
        await this.writeHook('before-sync');
      }
      await handle.sync();
    } catch (writeError) {
      await handle.close().catch(() => {});
      await fs.unlink(tempPath).catch(() => {});
      throw writeError;
    }
    await handle.close();

    try {
      if (this.writeHook) {
        await this.writeHook('before-rename');
      }
      await fs.rename(tempPath, this.queueFilePath);
    } catch (renameError) {
      const code = (renameError as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EEXIST') {
        await fs.unlink(tempPath).catch(() => {});
        throw renameError;
      }

      await fs.unlink(this.backupFilePath).catch(() => {});
      await fs.rename(this.queueFilePath, this.backupFilePath);
      try {
        await fs.rename(tempPath, this.queueFilePath);
      } catch (replacementError) {
        await fs.rename(this.backupFilePath, this.queueFilePath).catch(() => {});
        await fs.unlink(tempPath).catch(() => {});
        throw replacementError;
      }
      await fs.unlink(this.backupFilePath).catch(() => {});
    }
  }
}
