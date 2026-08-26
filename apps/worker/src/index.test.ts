import { describe, expect, it, vi } from 'vitest';
import {
  SPORTSCORE_WORKER_PROVIDER_STATUS,
  startWorker,
  WORKER_PROVIDER_STATUS
} from './index.js';

describe('explicit worker provider boundary', () => {
  it('starts in an explicit idle state without scheduling external requests', () => {
    const log = vi.fn();

    const worker = startWorker({ log });

    expect(WORKER_PROVIDER_STATUS).toBe('idle');
    expect(worker.status).toBe('idle');
    expect(log).toHaveBeenCalledWith(
      '[Worker Daemon] No external match provider is configured; worker is idle.'
    );
    expect(() => worker.stop()).not.toThrow();
  });

  it('enables SportScore only through an explicitly injected schedule', () => {
    const log = vi.fn();
    const run = vi.fn();
    const setIntervalFn = vi.fn(() => 42 as unknown as ReturnType<typeof setInterval>);
    const clearIntervalFn = vi.fn();

    const worker = startWorker({
      log,
      sportScoreSchedule: {
        run,
        intervalMs: 60_000,
        setIntervalFn: setIntervalFn as unknown as typeof setInterval,
        clearIntervalFn: clearIntervalFn as typeof clearInterval
      }
    });

    expect(worker.status).toBe(SPORTSCORE_WORKER_PROVIDER_STATUS);
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      '[Worker Daemon] SportScore schedule enabled with explicit injected configuration.'
    );
    worker.stop();
    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
  });
});
