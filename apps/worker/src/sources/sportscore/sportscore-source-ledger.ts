import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SPORTSCORE_SOURCE_LEDGER_SCHEMA_VERSION =
  'miraichi.sportscore-source-ledger.v1' as const;

export interface SportScoreDailyCheckpoint {
  completedAt?: string;
  nextAttemptAt?: string;
  failureCount: number;
}

export interface SportScoreTerminalWindowCheckpoint {
  plus15CompletedAt?: string;
  plus30CompletedAt?: string;
  terminalAt?: string;
  exhaustedAt?: string;
  nextAttemptAt?: string;
  recoveryAttempts?: number;
  failureCount: number;
}

export interface SportScoreTerminalSchedule {
  competitionId: string;
  date: string;
  expectedEndAt: string;
  sourceMatchSlugs: string[];
  matchIds: string[];
}

export interface SportScoreSourceLedgerState {
  schemaVersion: typeof SPORTSCORE_SOURCE_LEDGER_SCHEMA_VERSION;
  revision: number;
  rotationCursor: number;
  daily: Record<string, SportScoreDailyCheckpoint>;
  terminalSchedules: Record<string, SportScoreTerminalSchedule>;
  terminalWindows: Record<string, SportScoreTerminalWindowCheckpoint>;
  updatedAt: string;
}

export interface SportScoreSourceLedgerOptions {
  dataRoot: string;
  storagePath?: string;
  now?: () => Date;
}

export function sportScoreDailyCheckpointKey(competitionId: string, date: string): string {
  return `${competitionId}|${date}`;
}

export function createEmptySportScoreLedgerState(
  observedAt: string
): SportScoreSourceLedgerState {
  assertIsoTimestamp(observedAt, 'ledger observedAt');
  return {
    schemaVersion: SPORTSCORE_SOURCE_LEDGER_SCHEMA_VERSION,
    revision: 0,
    rotationCursor: 0,
    daily: {},
    terminalSchedules: {},
    terminalWindows: {},
    updatedAt: observedAt
  };
}

export class SportScoreSourceLedger {
  private readonly storagePath: string;
  private readonly now: () => Date;

  constructor(options: SportScoreSourceLedgerOptions) {
    this.storagePath = path.resolve(
      options.storagePath
        ?? path.join(options.dataRoot, 'providers', 'sportscore', 'state', 'source-ledger.json')
    );
    this.now = options.now ?? (() => new Date());
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  async getState(): Promise<SportScoreSourceLedgerState> {
    try {
      return parseSportScoreSourceLedger(await readFile(this.storagePath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return createEmptySportScoreLedgerState(this.now().toISOString());
      }
      const invalid = new Error('sportscore_source_ledger_invalid');
      (invalid as Error & { cause?: unknown }).cause = error;
      throw invalid;
    }
  }

  async recordRotationCursor(rotationCursor: number, observedAt: Date): Promise<void> {
    if (!Number.isInteger(rotationCursor) || rotationCursor < 0) {
      throw new Error('SportScore rotation cursor must be a non-negative integer.');
    }
    await this.mutate(observedAt, (state) => {
      state.rotationCursor = rotationCursor;
    });
  }

  async recordDailySuccess(
    competitionId: string,
    date: string,
    observedAt: Date
  ): Promise<void> {
    const key = sportScoreDailyCheckpointKey(competitionId, date);
    await this.mutate(observedAt, (state) => {
      state.daily[key] = {
        completedAt: observedAt.toISOString(),
        failureCount: 0
      };
    });
  }

  async recordDailyDeferral(
    competitionId: string,
    date: string,
    nextAttemptAt: Date,
    observedAt: Date
  ): Promise<void> {
    const key = sportScoreDailyCheckpointKey(competitionId, date);
    await this.mutate(observedAt, (state) => {
      const current = state.daily[key];
      state.daily[key] = {
        ...(current?.completedAt === undefined ? {} : { completedAt: current.completedAt }),
        nextAttemptAt: nextAttemptAt.toISOString(),
        failureCount: (current?.failureCount ?? 0) + 1
      };
    });
  }

  async recordTerminalSuccess(
    windowKey: string,
    stage: 'plus_15' | 'plus_30' | 'recovery',
    terminal: boolean,
    observedAt: Date,
    followUp: { nextAttemptAt?: Date; exhausted?: boolean } = {}
  ): Promise<void> {
    await this.mutate(observedAt, (state) => {
      const current = state.terminalWindows[windowKey] ?? { failureCount: 0 };
      const next: SportScoreTerminalWindowCheckpoint = {
        ...current,
        failureCount: 0
      };
      delete next.nextAttemptAt;
      if (stage === 'plus_15') {
        next.plus15CompletedAt = observedAt.toISOString();
      } else {
        if (stage === 'plus_30') {
          next.plus30CompletedAt = observedAt.toISOString();
        } else {
          next.recoveryAttempts = (current.recoveryAttempts ?? 0) + 1;
        }
      }
      if (terminal) {
        next.terminalAt = observedAt.toISOString();
      } else if (followUp.exhausted) {
        next.exhaustedAt = observedAt.toISOString();
      } else if (followUp.nextAttemptAt) {
        next.nextAttemptAt = followUp.nextAttemptAt.toISOString();
      }
      state.terminalWindows[windowKey] = next;
      if (terminal) {
        delete state.terminalSchedules[windowKey];
      }
    });
  }

  async recordTerminalSchedules(
    schedules: ReadonlyArray<{ windowKey: string; schedule: SportScoreTerminalSchedule }>,
    observedAt: Date
  ): Promise<void> {
    if (schedules.length === 0) return;
    for (const { windowKey, schedule } of schedules) {
      if (!isTerminalSchedule(schedule) || windowKey.trim() === '') {
        throw new Error('SportScore terminal schedule is invalid.');
      }
    }
    await this.mutate(observedAt, (state) => {
      for (const { windowKey, schedule } of schedules) {
        const current = state.terminalSchedules[windowKey];
        state.terminalSchedules[windowKey] = {
          ...schedule,
          sourceMatchSlugs: dedupe([
            ...(current?.sourceMatchSlugs ?? []),
            ...schedule.sourceMatchSlugs
          ]),
          matchIds: dedupe([...(current?.matchIds ?? []), ...schedule.matchIds])
        };
      }
    });
  }

  async recordTerminalDeferral(
    windowKey: string,
    nextAttemptAt: Date,
    observedAt: Date
  ): Promise<void> {
    await this.mutate(observedAt, (state) => {
      const current = state.terminalWindows[windowKey] ?? { failureCount: 0 };
      state.terminalWindows[windowKey] = {
        ...current,
        nextAttemptAt: nextAttemptAt.toISOString(),
        failureCount: current.failureCount + 1
      };
    });
  }

  async recordTerminalExhaustion(windowKey: string, observedAt: Date): Promise<void> {
    await this.mutate(observedAt, (state) => {
      const current = state.terminalWindows[windowKey] ?? { failureCount: 0 };
      state.terminalWindows[windowKey] = {
        ...current,
        exhaustedAt: observedAt.toISOString(),
        failureCount: current.failureCount + 1
      };
    });
  }

  private async mutate(
    observedAt: Date,
    update: (state: SportScoreSourceLedgerState) => void
  ): Promise<void> {
    if (Number.isNaN(observedAt.valueOf())) {
      throw new Error('SportScore ledger observedAt must be a valid date.');
    }
    const state = await this.getState();
    update(state);
    state.revision += 1;
    state.updatedAt = observedAt.toISOString();
    await this.writeState(state);
  }

  private async writeState(state: SportScoreSourceLedgerState): Promise<void> {
    const directory = path.dirname(this.storagePath);
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${this.storagePath}.tmp.${randomUUID()}`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
    try {
      await rename(temporaryPath, this.storagePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EEXIST') {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
      const backupPath = `${this.storagePath}.backup`;
      await unlink(backupPath).catch(() => undefined);
      await rename(this.storagePath, backupPath);
      try {
        await rename(temporaryPath, this.storagePath);
        await unlink(backupPath).catch(() => undefined);
      } catch (replacementError) {
        await rename(backupPath, this.storagePath).catch(() => undefined);
        await unlink(temporaryPath).catch(() => undefined);
        throw replacementError;
      }
    }
  }
}

function parseSportScoreSourceLedger(content: string): SportScoreSourceLedgerState {
  const parsed = JSON.parse(content) as Partial<SportScoreSourceLedgerState>;
  if (
    parsed.schemaVersion !== SPORTSCORE_SOURCE_LEDGER_SCHEMA_VERSION
    || !Number.isInteger(parsed.revision)
    || (parsed.revision as number) < 0
    || !Number.isInteger(parsed.rotationCursor)
    || (parsed.rotationCursor as number) < 0
    || !isRecord(parsed.daily)
    || !Object.values(parsed.daily).every(isDailyCheckpoint)
    || !isRecord(parsed.terminalSchedules)
    || !Object.values(parsed.terminalSchedules).every(isTerminalSchedule)
    || !isRecord(parsed.terminalWindows)
    || !Object.values(parsed.terminalWindows).every(isTerminalCheckpoint)
    || typeof parsed.updatedAt !== 'string'
    || Number.isNaN(Date.parse(parsed.updatedAt))
  ) {
    throw new Error('Invalid SportScore source ledger schema.');
  }
  return parsed as SportScoreSourceLedgerState;
}

function isDailyCheckpoint(value: unknown): value is SportScoreDailyCheckpoint {
  return isRecord(value)
    && isOptionalTimestamp(value.completedAt)
    && isOptionalTimestamp(value.nextAttemptAt)
    && Number.isInteger(value.failureCount)
    && (value.failureCount as number) >= 0;
}

function isTerminalCheckpoint(value: unknown): value is SportScoreTerminalWindowCheckpoint {
  return isRecord(value)
    && isOptionalTimestamp(value.plus15CompletedAt)
    && isOptionalTimestamp(value.plus30CompletedAt)
    && isOptionalTimestamp(value.terminalAt)
    && isOptionalTimestamp(value.exhaustedAt)
    && isOptionalTimestamp(value.nextAttemptAt)
    && (value.recoveryAttempts === undefined
      || (Number.isInteger(value.recoveryAttempts) && (value.recoveryAttempts as number) >= 0))
    && Number.isInteger(value.failureCount)
    && (value.failureCount as number) >= 0;
}

function isTerminalSchedule(value: unknown): value is SportScoreTerminalSchedule {
  return isRecord(value)
    && typeof value.competitionId === 'string'
    && value.competitionId.trim() !== ''
    && typeof value.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/u.test(value.date)
    && typeof value.expectedEndAt === 'string'
    && !Number.isNaN(Date.parse(value.expectedEndAt))
    && Array.isArray(value.sourceMatchSlugs)
    && value.sourceMatchSlugs.length > 0
    && value.sourceMatchSlugs.every((slug) => typeof slug === 'string' && slug.trim() !== '')
    && Array.isArray(value.matchIds)
    && value.matchIds.every((id) => typeof id === 'string' && id.trim() !== '');
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function isOptionalTimestamp(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

function assertIsoTimestamp(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO timestamp.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
