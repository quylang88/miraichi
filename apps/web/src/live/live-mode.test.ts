import { expect, it, vi } from 'vitest';

it('toggles immediately, refreshes manually once and preserves the last-good state on failure', async () => {
  const module = await import('./live-mode.js').catch(() => null);
  expect(module?.createLiveMode).toBeTypeOf('function');
  if (!module) return;
  let resolve: (() => void) | undefined;
  const refresh = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  const mode = module.createLiveMode(refresh);
  mode.toggle();
  expect(mode.active).toBe(true);
  mode.toggle();
  expect(mode.active).toBe(false);
  mode.toggle();
  expect(refresh).toHaveBeenCalledTimes(1);
  resolve?.();
  const previous = { status: 'ready' as const, snapshot: {} as never, stale: false, partial: false, warningCode: null };
  expect(module.retainLastGoodLive(previous, { status: 'unavailable', reason: 'live_data_unavailable' })).toMatchObject({ status: 'ready', stale: true });
});
