import { afterEach, describe, expect, it, vi } from 'vitest';

async function importFreshRegisterModule() {
  // Vitest query suffix forces a fresh module instance for this side-effect module.
  // @ts-expect-error - Vite/Vitest query imports are resolved by the test runner.
  await import('./register-service-worker.js?test-localhost-cleanup');
}

describe('PWA service worker registration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('removes service workers and caches on localhost instead of registering a cache-first shell', async () => {
    const unregister = vi.fn(() => Promise.resolve(true));
    const registration = { unregister };
    const deleteCache = vi.fn(() => Promise.resolve(true));
    const addEventListener = vi.fn((_event, callback) => callback());
    const register = vi.fn(() => Promise.resolve({ scope: 'http://localhost:3011/' }));
    const getRegistrations = vi.fn(() => Promise.resolve([registration]));

    vi.stubGlobal('window', {
      addEventListener,
      location: {
        hostname: 'localhost'
      }
    });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations,
        register
      }
    });
    vi.stubGlobal('caches', {
      keys: vi.fn(() => Promise.resolve(['miraichi-shell-v4-phase-5-9-production'])),
      delete: deleteCache
    });

    await importFreshRegisterModule();
    await Promise.resolve();
    await Promise.resolve();

    expect(register).not.toHaveBeenCalled();
    expect(getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('miraichi-shell-v4-phase-5-9-production');
  });
});
