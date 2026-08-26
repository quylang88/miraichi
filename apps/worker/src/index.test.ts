import { describe, expect, it, vi } from 'vitest';
import { startWorker, WORKER_PROVIDER_STATUS } from './index.js';

describe('provider retirement worker boundary', () => {
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
});
