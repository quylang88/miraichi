import { open, rename, writeFile, stat, unlink, readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { API_FOOTBALL_QUOTA_CONFIG } from '@miraichi/config';

export const API_FOOTBALL_USAGE_SCHEMA_VERSION = 'miraichi.api-football-usage.v1' as const;

export interface ApiFootballDailyUsage {
  reserved: number;
  confirmed: number;
  limit: number;
}

export interface ApiFootballLastReportedHeader {
  limit: number | null;
  remaining: number | null;
  resetsInSeconds?: number | null;
  observedAt: string | null;
}

export interface ApiFootballUsageState {
  schemaVersion: typeof API_FOOTBALL_USAGE_SCHEMA_VERSION;
  dayKey: string;
  dailyUsage: ApiFootballDailyUsage;
  rollingRequests: string[];
  lastReportedHeader: ApiFootballLastReportedHeader;
  updatedAt: string;
}

export class ApiFootballQuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly usedToday: number,
    public readonly limit: number
  ) {
    super(message);
    this.name = 'ApiFootballQuotaExceededError';
  }
}

export interface ApiFootballUsageLedgerOptions {
  storagePath?: string | undefined;
  dataRoot?: string | undefined;
  hardCeiling?: number | undefined;
  totalLimit?: number | undefined;
  maxRequestsPerMinute?: number | undefined;
  rollingWindowMs?: number | undefined;
  staleLockTimeoutMs?: number | undefined;
  lockTimeoutMs?: number | undefined;
  lockRetryDelayMs?: number | undefined;
  now?: (() => Date) | undefined;
  sleepFn?: ((ms: number) => Promise<void>) | undefined;
}

export function extractHeaderValue(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === 'function') {
    const val = (headers as Headers).get(name);
    return val !== null ? val : undefined;
  }
  const lowerName = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lowerName) {
      if (Array.isArray(v)) return v[0];
      if (typeof v === 'string') return v;
      return String(v);
    }
  }
  return undefined;
}

export class ApiFootballUsageLedger {
  private readonly storagePath: string;
  private readonly lockPath: string;
  private readonly hardCeiling: number;
  private readonly totalLimit: number;
  private readonly maxRequestsPerMinute: number;
  private readonly rollingWindowMs: number;
  private readonly staleLockTimeoutMs: number;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryDelayMs: number;
  private readonly now: () => Date;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options: ApiFootballUsageLedgerOptions = {}) {
    if (options.storagePath) {
      this.storagePath = resolve(options.storagePath);
    } else if (options.dataRoot) {
      this.storagePath = resolve(join(options.dataRoot, 'api-football', 'usage-ledger.json'));
    } else {
      throw new Error('api_football_ledger_path_missing');
    }

    this.lockPath = `${this.storagePath}.lock`;
    this.hardCeiling = options.hardCeiling ?? API_FOOTBALL_QUOTA_CONFIG.hardCeiling;
    this.totalLimit = options.totalLimit ?? API_FOOTBALL_QUOTA_CONFIG.dailyLimit;
    this.maxRequestsPerMinute = options.maxRequestsPerMinute ?? 10;
    this.rollingWindowMs = options.rollingWindowMs ?? 60_000;
    this.staleLockTimeoutMs = options.staleLockTimeoutMs ?? 10_000;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 15_000;
    this.lockRetryDelayMs = options.lockRetryDelayMs ?? 50;
    this.now = options.now ?? (() => new Date());
    this.sleepFn = options.sleepFn ?? ((ms: number) => new Promise((res) => setTimeout(res, ms)));
  }

  public getStoragePath(): string {
    return this.storagePath;
  }

  public async getState(now = this.now()): Promise<ApiFootballUsageState> {
    return this.withLock(() => this.readState(now));
  }

  public async canRequest(emergency = false, now = this.now()): Promise<boolean> {
    const state = await this.getState(now);
    const ceiling = emergency ? this.totalLimit : this.hardCeiling;
    return state.dailyUsage.reserved < ceiling;
  }

  public async getRemainingQuota(emergency = false, now = this.now()): Promise<number> {
    const state = await this.getState(now);
    const ceiling = emergency ? this.totalLimit : this.hardCeiling;
    return Math.max(0, ceiling - state.dailyUsage.reserved);
  }

  public async reserveSlot(options: { emergency?: boolean } = {}): Promise<ApiFootballUsageState> {
    while (true) {
      let waitMs = 0;

      const result = await this.withLock(async () => {
        const now = this.now();
        let state = await this.readState(now);
        const todayKey = now.toISOString().slice(0, 10);

        if (state.dayKey !== todayKey) {
          state = this.createInitialState(todayKey, now);
        }

        const currNowMs = now.getTime();
        state.rollingRequests = state.rollingRequests.filter((ts) => {
          const parsed = Date.parse(ts);
          return !Number.isNaN(parsed) && currNowMs - parsed < this.rollingWindowMs;
        });

        if (state.rollingRequests.length >= this.maxRequestsPerMinute) {
          const oldestIso = state.rollingRequests[0];
          const oldestMs = oldestIso ? Date.parse(oldestIso) : now.getTime();
          waitMs = Math.max(0, this.rollingWindowMs - (now.getTime() - oldestMs)) + 1;
          return null;
        }

        const ceiling = options.emergency ? this.totalLimit : this.hardCeiling;
        if (state.dailyUsage.reserved >= ceiling) {
          throw new ApiFootballQuotaExceededError(
            `API-Football daily request quota reached (${state.dailyUsage.reserved}/${ceiling}) for ${state.dayKey}`,
            state.dailyUsage.reserved,
            ceiling
          );
        }

        state.dailyUsage.reserved += 1;
        state.rollingRequests.push(now.toISOString());
        state.updatedAt = now.toISOString();

        await this.writeState(state);
        return state;
      });

      if (result !== null) {
        return result;
      }

      if (waitMs > 0) {
        await this.sleepFn(waitMs);
      }
    }
  }

  public async reconcileHeaders(
    headers?: Headers | Record<string, string | string[] | undefined>,
    options: { now?: Date } = {}
  ): Promise<ApiFootballUsageState> {
    return this.withLock(async () => {
      const now = options.now || this.now();
      let state = await this.readState(now);
      const todayKey = now.toISOString().slice(0, 10);

      if (state.dayKey !== todayKey) {
        state = this.createInitialState(todayKey, now);
      }

      const limitStr =
        extractHeaderValue(headers, 'x-ratelimit-requests-limit') ??
        extractHeaderValue(headers, 'x-ratelimit-limit');
      const remainingStr =
        extractHeaderValue(headers, 'x-ratelimit-requests-remaining') ??
        extractHeaderValue(headers, 'x-ratelimit-remaining');
      const resetStr =
        extractHeaderValue(headers, 'x-ratelimit-requests-reset') ??
        extractHeaderValue(headers, 'x-ratelimit-reset') ??
        extractHeaderValue(headers, 'retry-after');

      const limitNum = limitStr !== undefined ? parseInt(limitStr, 10) : null;
      const remainingNum = remainingStr !== undefined ? parseInt(remainingStr, 10) : null;
      const resetNum = resetStr !== undefined ? parseInt(resetStr, 10) : null;

      const hasValidHeaders =
        limitNum !== null &&
        !Number.isNaN(limitNum) &&
        remainingNum !== null &&
        !Number.isNaN(remainingNum);

      if (hasValidHeaders) {
        const providerReportedUsage = Math.max(0, limitNum - remainingNum);
        state.dailyUsage.confirmed = Math.max(state.dailyUsage.confirmed, providerReportedUsage);
        state.dailyUsage.reserved = Math.max(state.dailyUsage.reserved, state.dailyUsage.confirmed);

        state.lastReportedHeader = {
          limit: limitNum,
          remaining: remainingNum,
          resetsInSeconds: resetNum !== null && !Number.isNaN(resetNum) ? resetNum : null,
          observedAt: now.toISOString()
        };
      } else {
        state.dailyUsage.confirmed = Math.min(
          state.dailyUsage.reserved,
          state.dailyUsage.confirmed + 1
        );
        if (state.dailyUsage.confirmed === 0) state.dailyUsage.confirmed = 1;
        state.dailyUsage.reserved = Math.max(state.dailyUsage.reserved, state.dailyUsage.confirmed);
      }

      state.updatedAt = now.toISOString();
      await this.writeState(state);
      return state;
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
    await mkdir(dirname(this.storagePath), { recursive: true });

    while (true) {
      try {
        const lockId = randomUUID();
        const handle = await open(this.lockPath, 'wx');
        try {
          const lockInfo = JSON.stringify({
            pid: process.pid,
            createdAt: new Date().toISOString(),
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
            const currentLock = JSON.parse(await readFile(this.lockPath, 'utf8')) as { id?: string };
            if (currentLock.id === lockId) {
              await unlink(this.lockPath);
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        };
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EEXIST') {
          // Check for stale lock
          try {
            const content = await readFile(this.lockPath, 'utf8');
            const parsed = JSON.parse(content) as { pid?: number; createdAtMs?: number; createdAt?: string };
            const createdAtMs =
              typeof parsed.createdAtMs === 'number'
                ? parsed.createdAtMs
                : parsed.createdAt
                ? Date.parse(parsed.createdAt)
                : NaN;

            const ownerIsAlive = typeof parsed.pid === 'number' && isProcessAlive(parsed.pid);
            if (!ownerIsAlive && !Number.isNaN(createdAtMs)) {
              const lockAge = Date.now() - createdAtMs;
              if (lockAge > this.staleLockTimeoutMs) {
                await unlink(this.lockPath).catch(() => {});
                continue;
              }
            } else {
              const stats = await stat(this.lockPath);
              const lockAge = Date.now() - stats.mtimeMs;
              if (lockAge > this.staleLockTimeoutMs) {
                await unlink(this.lockPath).catch(() => {});
                continue;
              }
            }
          } catch {
            // Lock may have just been released by owner, retry
            try {
              const stats = await stat(this.lockPath);
              const lockAge = Date.now() - stats.mtimeMs;
              if (lockAge > this.staleLockTimeoutMs) {
                await unlink(this.lockPath).catch(() => {});
                continue;
              }
            } catch {
              continue;
            }
          }

          const elapsed = Date.now() - startTime;
          if (elapsed > this.lockTimeoutMs) {
            throw new Error(
              `Timeout acquiring lock for API-Football usage ledger at ${this.lockPath} after ${elapsed}ms`
            );
          }

          await this.sleepFn(this.lockRetryDelayMs);
        } else {
          throw err;
        }
      }
    }
  }

  private async readState(now = this.now()): Promise<ApiFootballUsageState> {
    const todayKey = now.toISOString().slice(0, 10);
    try {
      const content = await readFile(this.storagePath, 'utf8');
      const parsed = parseUsageState(content);
      return parsed.dayKey === todayKey ? parsed : this.createInitialState(todayKey, now);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const backupPath = `${this.storagePath}.backup`;
        try {
          const backupState = parseUsageState(await readFile(backupPath, 'utf8'));
          await rename(backupPath, this.storagePath);
          return backupState.dayKey === todayKey
            ? backupState
            : this.createInitialState(todayKey, now);
        } catch (backupError) {
          if ((backupError as NodeJS.ErrnoException).code === 'ENOENT') {
            return this.createInitialState(todayKey, now);
          }
          const invalidBackupError = new Error('api_football_usage_ledger_invalid');
          (invalidBackupError as Error & { cause?: unknown }).cause = backupError;
          throw invalidBackupError;
        }
      } else {
        const invalidError = new Error('api_football_usage_ledger_invalid');
        (invalidError as Error & { cause?: unknown }).cause = error;
        throw invalidError;
      }
    }
  }

  private createInitialState(dayKey: string, now: Date): ApiFootballUsageState {
    return {
      schemaVersion: API_FOOTBALL_USAGE_SCHEMA_VERSION,
      dayKey,
      dailyUsage: {
        reserved: 0,
        confirmed: 0,
        limit: this.hardCeiling
      },
      rollingRequests: [],
      lastReportedHeader: {
        limit: null,
        remaining: null,
        resetsInSeconds: null,
        observedAt: null
      },
      updatedAt: now.toISOString()
    };
  }

  private async writeState(state: ApiFootballUsageState): Promise<void> {
    const dir = dirname(this.storagePath);
    await mkdir(dir, { recursive: true });
    const tempPath = `${this.storagePath}.tmp.${Date.now()}.${randomUUID()}`;
    const backupPath = `${this.storagePath}.backup`;
    const serialized = JSON.stringify(state, null, 2);
    await writeFile(tempPath, serialized, 'utf8');
    try {
      await rename(tempPath, this.storagePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EEXIST') {
        await unlink(tempPath).catch(() => {});
        throw error;
      }

      await unlink(backupPath).catch(() => {});
      await rename(this.storagePath, backupPath);
      try {
        await rename(tempPath, this.storagePath);
      } catch (replacementError) {
        await rename(backupPath, this.storagePath).catch(() => {});
        await unlink(tempPath).catch(() => {});
        throw replacementError;
      }
      await unlink(backupPath).catch(() => {});
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function parseUsageState(content: string): ApiFootballUsageState {
  const parsed = JSON.parse(content) as Partial<ApiFootballUsageState>;
  const dailyUsage = parsed.dailyUsage;
  const header = parsed.lastReportedHeader;
  const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;
  const isNullableNumber = (value: unknown): value is number | null =>
    value === null || (typeof value === 'number' && Number.isFinite(value));

  if (
    parsed.schemaVersion !== API_FOOTBALL_USAGE_SCHEMA_VERSION ||
    typeof parsed.dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(parsed.dayKey) ||
    !dailyUsage ||
    !isNonNegativeInteger(dailyUsage.reserved) ||
    !isNonNegativeInteger(dailyUsage.confirmed) ||
    !isNonNegativeInteger(dailyUsage.limit) ||
    !Array.isArray(parsed.rollingRequests) ||
    !parsed.rollingRequests.every((value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))) ||
    !header ||
    !isNullableNumber(header.limit) ||
    !isNullableNumber(header.remaining) ||
    !isNullableNumber(header.resetsInSeconds ?? null) ||
    !(header.observedAt === null || (typeof header.observedAt === 'string' && !Number.isNaN(Date.parse(header.observedAt)))) ||
    typeof parsed.updatedAt !== 'string' || Number.isNaN(Date.parse(parsed.updatedAt))
  ) {
    throw new Error('Invalid API-Football usage ledger schema');
  }

  return parsed as ApiFootballUsageState;
}
