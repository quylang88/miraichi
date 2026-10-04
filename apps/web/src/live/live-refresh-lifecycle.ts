export const LIVE_REFRESH_INTERVAL_MS = 5 * 60 * 1_000;

interface VisibilityEventTarget extends EventTarget {
  readonly visibilityState: DocumentVisibilityState;
}

export interface LiveRefreshLifecycle {
  start(): void;
  stop(): void;
}

export function createLiveRefreshLifecycle(options: {
  readonly documentTarget: VisibilityEventTarget;
  readonly windowTarget: EventTarget;
  readonly refresh: () => Promise<void>;
  readonly setIntervalFn?: (handler: () => void, timeoutMs: number) => unknown;
  readonly clearIntervalFn?: (handle: unknown) => void;
}): LiveRefreshLifecycle {
  const setIntervalFn = options.setIntervalFn ?? ((handler, timeoutMs) => setInterval(handler, timeoutMs));
  const clearIntervalFn = options.clearIntervalFn ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
  let timer: unknown | null = null;
  let started = false;
  let pageSuspended = false;
  let inFlight: Promise<void> | null = null;

  const run = () => {
    if (pageSuspended || options.documentTarget.visibilityState !== 'visible' || inFlight) return;
    inFlight = Promise.resolve(options.refresh()).finally(() => { inFlight = null; });
  };
  const stopTimer = () => {
    if (timer === null) return;
    clearIntervalFn(timer);
    timer = null;
  };
  const activate = () => {
    if (pageSuspended || options.documentTarget.visibilityState !== 'visible') return;
    run();
    if (timer === null) timer = setIntervalFn(run, LIVE_REFRESH_INTERVAL_MS);
  };
  const onVisibilityChange = () => {
    if (options.documentTarget.visibilityState === 'visible') activate();
    else stopTimer();
  };
  const onWake = () => activate();
  const onPageHide = () => { pageSuspended = true; stopTimer(); };
  const onPageShow = () => { pageSuspended = false; activate(); };

  return {
    start() {
      if (started) return;
      started = true;
      options.documentTarget.addEventListener('visibilitychange', onVisibilityChange);
      options.windowTarget.addEventListener('focus', onWake);
      options.windowTarget.addEventListener('online', onWake);
      options.windowTarget.addEventListener('pageshow', onPageShow);
      options.windowTarget.addEventListener('pagehide', onPageHide);
      activate();
    },
    stop() {
      if (!started) return;
      started = false;
      stopTimer();
      options.documentTarget.removeEventListener('visibilitychange', onVisibilityChange);
      options.windowTarget.removeEventListener('focus', onWake);
      options.windowTarget.removeEventListener('online', onWake);
      options.windowTarget.removeEventListener('pageshow', onPageShow);
      options.windowTarget.removeEventListener('pagehide', onPageHide);
    }
  };
}
