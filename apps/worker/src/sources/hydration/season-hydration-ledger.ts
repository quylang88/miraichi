import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SEASON_HYDRATION_LEDGER_SCHEMA_VERSION =
  'miraichi.season-hydration-ledger.v1' as const;

export interface SeasonHydrationCheckpoint {
  completedAt: string;
  etag?: string;
  cursor?: string;
}

export interface SeasonHydrationFailure {
  failureCount: number;
  nextAttemptAt: string;
  lastError: string;
}

export interface SeasonHydrationLedgerState {
  schemaVersion: typeof SEASON_HYDRATION_LEDGER_SCHEMA_VERSION;
  revision: number;
  checkpoints: Record<string, SeasonHydrationCheckpoint>;
  failures: Record<string, SeasonHydrationFailure>;
  updatedAt: string;
}

export interface SeasonHydrationSuccessInput {
  key: string;
  etag?: string;
  cursor?: string;
}

export interface SeasonHydrationFailureInput {
  key: string;
  error: string;
  deferralMinutes?: number;
}

export class SeasonHydrationLedger {
  private readonly storagePath: string;
  private readonly now: () => Date;

  constructor(options: { dataRoot: string; now?: () => Date }) {
    this.storagePath = path.join(
      path.resolve(options.dataRoot),
      'providers',
      'season-hydration',
      'state',
      'ledger.json'
    );
    this.now = options.now ?? (() => new Date());
  }

  async getState(): Promise<SeasonHydrationLedgerState> {
    try {
      return parseState(await readFile(this.storagePath, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyState(this.now().toISOString());
      }
      throw new Error('season_hydration_ledger_invalid', { cause: error });
    }
  }

  async recordSuccess(
    key: string,
    observedAt: Date,
    checkpoint: { etag?: string; cursor?: string } = {}
  ): Promise<void> {
    await this.recordBatch({
      successes: [{
        key,
        ...(checkpoint.etag === undefined ? {} : { etag: checkpoint.etag }),
        ...(checkpoint.cursor === undefined ? {} : { cursor: checkpoint.cursor })
      }],
      failures: []
    }, observedAt);
  }

  async recordBatch(
    outcomes: {
      successes: readonly SeasonHydrationSuccessInput[];
      failures: readonly SeasonHydrationFailureInput[];
    },
    observedAt: Date
  ): Promise<void> {
    const keys = new Set<string>();
    for (const outcome of [...outcomes.successes, ...outcomes.failures]) {
      assertTargetKey(outcome.key);
      if (keys.has(outcome.key)) {
        throw new Error(`Season hydration batch contains duplicate outcome ${outcome.key}.`);
      }
      keys.add(outcome.key);
    }
    await this.mutate(observedAt, (state) => {
      for (const success of outcomes.successes) {
        const current = state.checkpoints[success.key];
        const etag = success.etag ?? current?.etag;
        const cursor = success.cursor ?? current?.cursor;
        state.checkpoints[success.key] = {
          completedAt: observedAt.toISOString(),
          ...(etag === undefined ? {} : { etag }),
          ...(cursor === undefined ? {} : { cursor })
        };
        delete state.failures[success.key];
      }
      for (const failure of outcomes.failures) {
        const deferralMinutes = failure.deferralMinutes ?? 15;
        if (!Number.isInteger(deferralMinutes) || deferralMinutes < 1) {
          throw new Error('Season hydration deferralMinutes must be a positive integer.');
        }
        const failureCount = (state.failures[failure.key]?.failureCount ?? 0) + 1;
        const delayMinutes = Math.min(360, deferralMinutes * (2 ** (failureCount - 1)));
        state.failures[failure.key] = {
          failureCount,
          nextAttemptAt: new Date(observedAt.getTime() + delayMinutes * 60_000).toISOString(),
          lastError: failure.error.slice(0, 500)
        };
      }
    });
  }

  async recordFailure(
    key: string,
    error: string,
    observedAt: Date,
    deferralMinutes = 15
  ): Promise<void> {
    await this.recordBatch({
      successes: [],
      failures: [{ key, error, deferralMinutes }]
    }, observedAt);
  }

  private async mutate(
    observedAt: Date,
    update: (state: SeasonHydrationLedgerState) => void
  ): Promise<void> {
    if (Number.isNaN(observedAt.valueOf())) {
      throw new Error('Season hydration ledger time is invalid.');
    }
    const state = await this.getState();
    update(state);
    state.revision += 1;
    state.updatedAt = observedAt.toISOString();
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const temporary = `${this.storagePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx'
      });
      await rename(temporary, this.storagePath);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

function emptyState(observedAt: string): SeasonHydrationLedgerState {
  return {
    schemaVersion: SEASON_HYDRATION_LEDGER_SCHEMA_VERSION,
    revision: 0,
    checkpoints: {},
    failures: {},
    updatedAt: observedAt
  };
}

function parseState(raw: string): SeasonHydrationLedgerState {
  const value = JSON.parse(raw) as Partial<SeasonHydrationLedgerState>;
  if (
    value.schemaVersion !== SEASON_HYDRATION_LEDGER_SCHEMA_VERSION
    || !Number.isInteger(value.revision)
    || !isRecord(value.checkpoints)
    || !isRecord(value.failures)
    || !isTimestamp(value.updatedAt)
  ) {
    throw new Error('Invalid season hydration ledger.');
  }
  for (const [key, checkpoint] of Object.entries(value.checkpoints)) {
    assertTargetKey(key);
    if (
      !isRecord(checkpoint)
      || !isTimestamp(checkpoint.completedAt)
      || (checkpoint.etag !== undefined && typeof checkpoint.etag !== 'string')
      || (checkpoint.cursor !== undefined && typeof checkpoint.cursor !== 'string')
    ) {
      throw new Error('Invalid season hydration checkpoint.');
    }
  }
  for (const [key, failure] of Object.entries(value.failures)) {
    assertTargetKey(key);
    if (
      !isRecord(failure)
      || !Number.isInteger(failure.failureCount)
      || (failure.failureCount as number) < 1
      || !isTimestamp(failure.nextAttemptAt)
      || typeof failure.lastError !== 'string'
    ) {
      throw new Error('Invalid season hydration failure.');
    }
  }
  return value as SeasonHydrationLedgerState;
}

function assertTargetKey(key: string): void {
  const parts = key.split('|');
  if (parts.length !== 3 || parts.some((part) => part.trim() === '')) {
    throw new Error('Season hydration target key must be provider|competition|season.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
