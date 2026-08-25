import { describe, expect, it, vi } from 'vitest';
import type { ApiFootballIngestionRunResult } from './jobs/api-football-ingestion-job.js';
import {
  API_FOOTBALL_SCHEDULE_INTERVAL_MS,
  startApiFootballSchedule
} from './index.js';

function successfulResult(): ApiFootballIngestionRunResult {
  return {
    status: 'published',
    runId: 'run-1',
    mode: 'window_poll',
    matchesProcessed: 1,
    matchesCompleted: 1,
    quotaUsedToday: 5
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

describe('startApiFootballSchedule', () => {
  it('starts immediately and schedules subsequent ticks on polling interval', () => {
    const runJob = vi.fn().mockResolvedValue(successfulResult());
    const intervalHandle = { id: 'api-football' } as unknown as ReturnType<typeof setInterval>;
    const setIntervalFn = vi.fn(() => intervalHandle) as unknown as typeof setInterval;
    const clearIntervalFn = vi.fn() as unknown as typeof clearInterval;

    const schedule = startApiFootballSchedule({
      runJob,
      setIntervalFn,
      clearIntervalFn,
      log: vi.fn()
    });

    expect(schedule.intervalMilliseconds).toBe(API_FOOTBALL_SCHEDULE_INTERVAL_MS);
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), API_FOOTBALL_SCHEDULE_INTERVAL_MS);

    schedule.stop();
    expect(clearIntervalFn).toHaveBeenCalledWith(intervalHandle);
  });

  it('coalesces overlapping ticks until running job settles', async () => {
    const firstRun = deferred<ApiFootballIngestionRunResult>();
    const runJob = vi.fn()
      .mockReturnValueOnce(firstRun.promise)
      .mockResolvedValue(successfulResult());
    let tick: (() => void) | undefined;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return { id: 'api-football' } as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;

    startApiFootballSchedule({
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
      .mockRejectedValueOnce(new Error('Ingestion network error'))
      .mockResolvedValue(successfulResult());
    const log = vi.fn();
    let tick: (() => void) | undefined;
    const setIntervalFn = vi.fn((callback: () => void) => {
      tick = callback;
      return { id: 'api-football' } as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;

    startApiFootballSchedule({
      runJob,
      setIntervalFn,
      clearIntervalFn: vi.fn() as unknown as typeof clearInterval,
      log
    });

    await settle();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Ingestion network error'));

    tick!();
    expect(runJob).toHaveBeenCalledTimes(2);
  });
});
