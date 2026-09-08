import type { LiveMatchViewState } from '../services/live-match-service.js';

export function createLiveMode(refresh: () => Promise<void>) {
  let active = false;
  let inFlight: Promise<void> | null = null;
  return {
    get active() { return active; },
    toggle() {
      active = !active;
      if (active && !inFlight) inFlight = refresh().catch(() => undefined).finally(() => { inFlight = null; });
    }
  };
}

export function retainLastGoodLive(previous: LiveMatchViewState, next: LiveMatchViewState): LiveMatchViewState {
  return next.status === 'unavailable' && previous.status === 'ready'
    ? { ...previous, stale: true, warningCode: next.reason } : next;
}
