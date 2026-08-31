import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const FOTMOB_RESULT_LEDGER_SCHEMA_VERSION =
  'miraichi.fotmob-terminal-results-ledger.v1' as const;

export interface FotMobResultDateCheckpoint {
  etag?: string;
  lastCheckedAt?: string;
  nextAttemptAt?: string;
  failureCount: number;
  lastError?: string;
}

export interface FotMobResultMatchCheckpoint {
  attemptCount: number;
  nextCheckAt?: string;
  terminalAt?: string;
  exhaustedAt?: string;
}

export interface FotMobResultLedgerState {
  schemaVersion: typeof FOTMOB_RESULT_LEDGER_SCHEMA_VERSION;
  revision: number;
  dates: Record<string, FotMobResultDateCheckpoint>;
  matches: Record<string, FotMobResultMatchCheckpoint>;
  updatedAt: string;
}

export type FotMobDateOutcome =
  | { kind: 'success'; date: string; etag?: string }
  | { kind: 'failure'; date: string; error: string; delayMinutes: number };

export type FotMobMatchOutcome =
  | { kind: 'retry'; matchId: string; delayMinutes: number }
  | { kind: 'terminal'; matchId: string }
  | { kind: 'exhausted'; matchId: string };

export function fotMobDateKey(date: string): string {
  assertCalendarDate(date);
  return `fotmob-unofficial|${date}`;
}

export function fotMobMatchKey(matchId: string): string {
  assertMatchId(matchId);
  return `fotmob-unofficial|${matchId}`;
}

export class FotMobResultLedger {
  private readonly storagePath: string;
  private readonly now: () => Date;

  constructor(options: { dataRoot: string; now?: () => Date }) {
    this.storagePath = path.resolve(
      options.dataRoot,
      'providers',
      'fotmob-unofficial',
      'state',
      'terminal-results.json'
    );
    this.now = options.now ?? (() => new Date());
  }

  async getState(): Promise<FotMobResultLedgerState> {
    try {
      return parseState(await readFile(this.storagePath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyState(this.now().toISOString());
      }
      throw new Error('fotmob_result_ledger_invalid', { cause: error });
    }
  }

  async recordBatch(
    outcomes: {
      dates: readonly FotMobDateOutcome[];
      matches: readonly FotMobMatchOutcome[];
    },
    observedAt: Date
  ): Promise<void> {
    if (Number.isNaN(observedAt.valueOf())) {
      throw new Error('FotMob result ledger observedAt must be valid.');
    }
    const dateKeys = new Set<string>();
    for (const outcome of outcomes.dates) {
      const key = fotMobDateKey(outcome.date);
      if (dateKeys.has(key)) throw new Error(`FotMob result batch has duplicate date ${key}.`);
      dateKeys.add(key);
      if (outcome.kind === 'failure') assertDelay(outcome.delayMinutes);
      if (outcome.kind === 'success' && outcome.etag !== undefined) assertEtag(outcome.etag);
    }
    const matchKeys = new Set<string>();
    for (const outcome of outcomes.matches) {
      const key = fotMobMatchKey(outcome.matchId);
      if (matchKeys.has(key)) throw new Error(`FotMob result batch has duplicate match ${key}.`);
      matchKeys.add(key);
      if (outcome.kind === 'retry') assertDelay(outcome.delayMinutes);
    }

    const state = await this.getState();
    for (const outcome of outcomes.dates) {
      const key = fotMobDateKey(outcome.date);
      const current = state.dates[key] ?? { failureCount: 0 };
      if (outcome.kind === 'success') {
        state.dates[key] = {
          ...(outcome.etag ?? current.etag
            ? { etag: outcome.etag ?? current.etag }
            : {}),
          lastCheckedAt: observedAt.toISOString(),
          failureCount: 0
        };
      } else {
        const failureCount = current.failureCount + 1;
        const delayMinutes = Math.min(360, outcome.delayMinutes * (2 ** (failureCount - 1)));
        state.dates[key] = {
          ...(current.etag ? { etag: current.etag } : {}),
          ...(current.lastCheckedAt ? { lastCheckedAt: current.lastCheckedAt } : {}),
          nextAttemptAt: new Date(observedAt.getTime() + delayMinutes * 60_000).toISOString(),
          failureCount,
          lastError: outcome.error.slice(0, 500)
        };
      }
    }
    for (const outcome of outcomes.matches) {
      const key = fotMobMatchKey(outcome.matchId);
      const current = state.matches[key] ?? { attemptCount: 0 };
      const attemptCount = current.attemptCount + 1;
      if (outcome.kind === 'retry') {
        state.matches[key] = {
          attemptCount,
          nextCheckAt: new Date(
            observedAt.getTime() + outcome.delayMinutes * 60_000
          ).toISOString()
        };
      } else if (outcome.kind === 'terminal') {
        state.matches[key] = { attemptCount, terminalAt: observedAt.toISOString() };
      } else {
        state.matches[key] = { attemptCount, exhaustedAt: observedAt.toISOString() };
      }
    }
    state.revision += 1;
    state.updatedAt = observedAt.toISOString();
    await this.writeState(state);
  }

  private async writeState(state: FotMobResultLedgerState): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const temporary = `${this.storagePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
    try {
      await rename(temporary, this.storagePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EEXIST') throw error;
      const backup = `${this.storagePath}.backup`;
      await unlink(backup).catch(() => undefined);
      await rename(this.storagePath, backup);
      try {
        await rename(temporary, this.storagePath);
        await unlink(backup).catch(() => undefined);
      } catch (replacementError) {
        await rename(backup, this.storagePath).catch(() => undefined);
        throw replacementError;
      }
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

export type FotMobResultLeaseResult<T> =
  | { acquired: true; value: T }
  | { acquired: false };

export class FotMobResultJobLease {
  private readonly lockPath: string;
  private readonly staleAfterMs: number;
  private readonly now: () => Date;

  constructor(options: { dataRoot: string; staleAfterMs?: number; now?: () => Date }) {
    this.lockPath = path.resolve(
      options.dataRoot,
      'providers',
      'fotmob-unofficial',
      'state',
      'terminal-results.lock'
    );
    this.staleAfterMs = options.staleAfterMs ?? 5 * 60_000;
    this.now = options.now ?? (() => new Date());
    if (!Number.isInteger(this.staleAfterMs) || this.staleAfterMs < 1) {
      throw new Error('FotMob result lease staleAfterMs must be a positive integer.');
    }
  }

  async tryWithLease<T>(operation: () => Promise<T>): Promise<FotMobResultLeaseResult<T>> {
    const release = await this.tryAcquire();
    if (!release) return { acquired: false };
    try {
      return { acquired: true, value: await operation() };
    } finally {
      await release();
    }
  }

  private async tryAcquire(): Promise<(() => Promise<void>) | null> {
    await mkdir(path.dirname(this.lockPath), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const lockId = randomUUID();
      try {
        const handle = await open(this.lockPath, 'wx');
        try {
          const now = this.now();
          await handle.writeFile(JSON.stringify({
            id: lockId,
            pid: process.pid,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + this.staleAfterMs).toISOString()
          }), 'utf8');
        } finally {
          await handle.close();
        }
        return this.releaseFor(lockId);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (attempt === 0 && await this.removeStaleLease()) continue;
        return null;
      }
    }
    return null;
  }

  private releaseFor(lockId: string): () => Promise<void> {
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        const current = JSON.parse(await readFile(this.lockPath, 'utf8')) as { id?: string };
        if (current.id === lockId) await unlink(this.lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    };
  }

  private async removeStaleLease(): Promise<boolean> {
    try {
      const current = JSON.parse(await readFile(this.lockPath, 'utf8')) as {
        pid?: number;
        expiresAt?: string;
      };
      if (typeof current.pid === 'number' && isProcessAlive(current.pid)) return false;
      if (typeof current.expiresAt === 'string'
        && Date.parse(current.expiresAt) <= this.now().getTime()) {
        await unlink(this.lockPath);
        return true;
      }
      return false;
    } catch {
      try {
        const info = await stat(this.lockPath);
        if (this.now().getTime() - info.mtimeMs > this.staleAfterMs) {
          await unlink(this.lockPath);
          return true;
        }
      } catch {
        return true;
      }
      return false;
    }
  }
}

function emptyState(observedAt: string): FotMobResultLedgerState {
  return {
    schemaVersion: FOTMOB_RESULT_LEDGER_SCHEMA_VERSION,
    revision: 0,
    dates: {},
    matches: {},
    updatedAt: observedAt
  };
}

function parseState(raw: string): FotMobResultLedgerState {
  const value = JSON.parse(raw) as Partial<FotMobResultLedgerState>;
  if (value.schemaVersion !== FOTMOB_RESULT_LEDGER_SCHEMA_VERSION
    || !Number.isInteger(value.revision)
    || (value.revision as number) < 0
    || !isRecord(value.dates)
    || !Object.entries(value.dates).every(([key, checkpoint]) => (
      isDateKey(key) && isDateCheckpoint(checkpoint)
    ))
    || !isRecord(value.matches)
    || !Object.entries(value.matches).every(([key, checkpoint]) => (
      isMatchKey(key) && isMatchCheckpoint(checkpoint)
    ))
    || !isTimestamp(value.updatedAt)) {
    throw new Error('Invalid FotMob result ledger.');
  }
  return value as FotMobResultLedgerState;
}

function isDateCheckpoint(value: unknown): value is FotMobResultDateCheckpoint {
  return isRecord(value)
    && Number.isInteger(value.failureCount)
    && (value.failureCount as number) >= 0
    && isOptionalTimestamp(value.lastCheckedAt)
    && isOptionalTimestamp(value.nextAttemptAt)
    && (value.etag === undefined || (typeof value.etag === 'string' && value.etag.trim() !== ''))
    && (value.lastError === undefined || typeof value.lastError === 'string');
}

function isMatchCheckpoint(value: unknown): value is FotMobResultMatchCheckpoint {
  return isRecord(value)
    && Number.isInteger(value.attemptCount)
    && (value.attemptCount as number) >= 0
    && isOptionalTimestamp(value.nextCheckAt)
    && isOptionalTimestamp(value.terminalAt)
    && isOptionalTimestamp(value.exhaustedAt);
}

function isDateKey(key: string): boolean {
  try {
    return fotMobDateKey(key.slice('fotmob-unofficial|'.length)) === key;
  } catch {
    return false;
  }
}

function isMatchKey(key: string): boolean {
  try {
    return fotMobMatchKey(key.slice('fotmob-unofficial|'.length)) === key;
  } catch {
    return false;
  }
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error('FotMob result date is invalid.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('FotMob result date is invalid.');
  }
}

function assertMatchId(value: string): void {
  if (!/^match-[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(value)) {
    throw new Error('FotMob result canonical match ID is invalid.');
  }
}

function assertDelay(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 360) {
    throw new Error('FotMob result delayMinutes must be between 1 and 360.');
  }
}

function assertEtag(value: string): void {
  if (!value.trim() || /[\r\n]/u.test(value)) throw new Error('FotMob result ETag is unsafe.');
}

function isOptionalTimestamp(value: unknown): boolean {
  return value === undefined || isTimestamp(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
