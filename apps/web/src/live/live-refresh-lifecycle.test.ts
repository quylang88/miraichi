import { describe, expect, it, vi } from 'vitest';
import { createLiveRefreshLifecycle, LIVE_REFRESH_INTERVAL_MS } from './live-refresh-lifecycle.js';

class VisibilityTarget extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

describe('visible live refresh lifecycle', () => {
  it('refreshes immediately with exactly one five-minute interval while visible', async () => {
    const documentTarget = new VisibilityTarget();
    const windowTarget = new EventTarget();
    const refresh = vi.fn(async () => undefined);
    const setIntervalFn = vi.fn((_handler: TimerHandler, _timeout?: number) => 41 as never);
    const clearIntervalFn = vi.fn();
    const lifecycle = createLiveRefreshLifecycle({
      documentTarget,
      windowTarget,
      refresh,
      setIntervalFn,
      clearIntervalFn
    });

    lifecycle.start();
    lifecycle.start();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setIntervalFn).toHaveBeenCalledTimes(1);
    expect(setIntervalFn.mock.calls[0]?.[1]).toBe(LIVE_REFRESH_INTERVAL_MS);
    await Promise.resolve();

    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(clearIntervalFn).toHaveBeenCalledWith(41);

    documentTarget.visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(setIntervalFn).toHaveBeenCalledTimes(2);
  });

  it('stops on pagehide, resumes on pageshow, and coalesces concurrent wake events', async () => {
    const documentTarget = new VisibilityTarget();
    const windowTarget = new EventTarget();
    let resolveRefresh!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { resolveRefresh = resolve; }));
    const lifecycle = createLiveRefreshLifecycle({
      documentTarget,
      windowTarget,
      refresh,
      setIntervalFn: (() => 7 as never),
      clearIntervalFn: vi.fn()
    });
    lifecycle.start();
    windowTarget.dispatchEvent(new Event('focus'));
    windowTarget.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh();
    await Promise.resolve();

    windowTarget.dispatchEvent(new Event('pagehide'));
    windowTarget.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(1);
    windowTarget.dispatchEvent(new Event('pageshow'));
    expect(refresh).toHaveBeenCalledTimes(2);
    lifecycle.stop();
  });
});
