import { describe, expect, it, vi } from 'vitest';
import type { OpenFootballIngestionRunResult } from './jobs/openfootball-ingestion-job.js';
import {
  OPENFOOTBALL_SCHEDULE_INTERVAL_MS,
  startOpenFootballSchedule
} from './index.js';

function successfulResult(): OpenFootballIngestionRunResult {
  return {
    status: 'skipped',
    runId: 'run-1',
    changedSourceCount: 0,
    notModifiedSourceCount: 0,
    errorCodes: []
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('startOpenFootballSchedule', () => {
  it('starts immediately and schedules subsequent runs every six hours', () => {
    const runJob = vi.fn().mockResolvedValue(successfulResult());
    const intervalHandle = { id: 'openfootball' } as unknown as ReturnType<typeof setInterval>;
    const setIntervalFn = vi.fn(() => intervalHandle) as unknown as typeof setInterval;
    const clearIntervalFn = vi.fn() as unknown as typeof clearInterval;

    const schedule = startOpenFootballSchedule({
      runJob,
      setIntervalFn,
      clearIntervalFn,
      log: vi.fn()
    });

    expect(OPENFOOTBALL_SCHEDULE_INTERVAL_MS).toBe(360 * 60_000);
    expect(schedule.intervalMilliseconds).toBe(360 * 60_000);
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 360 * 60_000);

    schedule.stop();
    expect(clearIntervalFn).toHaveBeenCalledWith(intervalHandle);
  });

  it('coalesces overlapping ticks until the running job settles', async () => {
    const firstRun = deferred<OpenFootballIngestionRunResult>();
    const runJob = vi.fn()
      .mockReturnValueOnce(firstRun.promise)
      .mockResolvedValue(successfulResult());
    let tick: (() => void) | undefined;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return { id: 'openfootball' } as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;

    startOpenFootballSchedule({
      runJob,
      setIntervalFn,
      clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
      log: vi.fn()
    });

    tick!();
    tick!();
    expect(runJob).toHaveBeenCalledTimes(1);

    firstRun.resolve(successfulResult());
    await settle();
    tick!();
    expect(runJob).toHaveBeenCalledTimes(2);
  });

  it('logs a rejected run and continues scheduling later ticks', async () => {
    const runJob = vi.fn()
      .mockRejectedValueOnce(new Error('capture failed'))
      .mockResolvedValue(successfulResult());
    const log = vi.fn();
    let tick: (() => void) | undefined;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return { id: 'openfootball' } as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;

    startOpenFootballSchedule({
      runJob,
      setIntervalFn,
      clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
      log
    });

    await settle();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('capture failed'));

    tick!();
    expect(runJob).toHaveBeenCalledTimes(2);
  });

  it('logs a failed job result and remains scheduled', async () => {
    const failedResult: OpenFootballIngestionRunResult = {
      status: 'failed',
      runId: 'run-failed',
      changedSourceCount: 0,
      notModifiedSourceCount: 0,
      errorCodes: ['source_unavailable']
    };
    const runJob = vi.fn()
      .mockResolvedValueOnce(failedResult)
      .mockResolvedValue(successfulResult());
    const log = vi.fn();
    let tick: (() => void) | undefined;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return { id: 'openfootball' } as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;

    startOpenFootballSchedule({
      runJob,
      setIntervalFn,
      clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
      log
    });

    await settle();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('source_unavailable'));

    tick!();
    expect(runJob).toHaveBeenCalledTimes(2);
  });
});
