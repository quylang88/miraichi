import { describe, expect, it, vi } from 'vitest';
import {
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

  it('does not expose the retired SportScore schedule injection path', () => {
    const log = vi.fn();
    const run = vi.fn();
    const setIntervalFn = vi.fn(() => 42 as unknown as ReturnType<typeof setInterval>);

    const worker = startWorker({
      log,
      sportScoreSchedule: {
        run,
        intervalMs: 60_000,
        setIntervalFn: setIntervalFn as unknown as typeof setInterval,
        clearIntervalFn: vi.fn() as typeof clearInterval
      }
    } as never);

    expect(worker.status).toBe(WORKER_PROVIDER_STATUS);
    expect(setIntervalFn).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      '[Worker Daemon] No external match provider is configured; worker is idle.'
    );
    worker.stop();
  });
});
