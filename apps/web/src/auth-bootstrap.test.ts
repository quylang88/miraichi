import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapAuthenticatedShell, renderOwnerLogin } from './auth-bootstrap.js';
import { getIndexHtml } from './index.js';

function response(ok: boolean, payload: unknown, status = ok ? 200 : 401): Response {
  return { ok, status, json: async () => payload } as Response;
}

describe('owner auth PWA bootstrap', () => {
  afterEach(() => vi.useRealTimers());

  it('ships the data-free four-tab shell in HTML before any session or script completes', () => {
    const html = getIndexHtml();
    expect(html).toContain('content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"');
    expect(html).toContain('class="bottom-nav"');
    expect(html).toContain('data-owner-session="pending"');
    expect(html).toContain('id="main-scroll" inert');
    expect(html).not.toContain('Loading Miraichi...');
    for (const tab of ['today', 'matches', 'bets', 'bankroll']) {
      expect(html).toContain(`data-shell-tab-panel="${tab}"`);
    }
    expect(html).not.toContain('data-today-setup-prompt');
  });

  it('bounds a stalled session without loading protected application behavior', async () => {
    vi.useFakeTimers();
    const loadShell = vi.fn(async () => undefined);
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const state = bootstrapAuthenticatedShell(fetcher, loadShell);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await Promise.race([state, Promise.resolve('still-pending')])).toBe('unavailable');
    expect(loadShell).not.toHaveBeenCalled();
  });

  it('imports the production shell only after an authenticated session response', async () => {
    const loadShell = vi.fn(async () => undefined);
    const authenticated = await bootstrapAuthenticatedShell(
      vi.fn(async () => response(true, { authenticated: true })),
      loadShell
    );
    expect(authenticated).toBe('authenticated');
    expect(loadShell).toHaveBeenCalledTimes(1);

    loadShell.mockClear();
    const anonymous = await bootstrapAuthenticatedShell(
      vi.fn(async () => response(true, { authenticated: false })),
      loadShell
    );
    expect(anonymous).toBe('login');
    expect(loadShell).not.toHaveBeenCalled();
  });

  it('renders a password-only owner login with no registration path', () => {
    const html = renderOwnerLogin('vi', 'invalid');
    expect(html).toContain('name="password"');
    expect(html).toContain('Đăng nhập');
    expect(html).toContain('Sai mật khẩu');
    expect(html.toLowerCase()).not.toContain('register');
    expect(html.toLowerCase()).not.toContain('sign up');
  });

  it('boots index and service worker through auth-bootstrap instead of loading shell-entry directly', () => {
    const html = getIndexHtml();
    expect(html).toContain('src="/apps/web/src/auth-bootstrap.js"');
    expect(readFileSync(fileURLToPath(new URL('./auth-bootstrap.ts', import.meta.url)), 'utf8')).toContain('installApplicationZoomConstraints');
    expect(html).not.toContain('src="/apps/web/src/shell-entry.js"');
    const exactAttribution = '<a href="https://sportscore.com/" rel="dofollow" title="Sports data by SportScore">Powered by SportScore</a>';
    expect(html.split(exactAttribution)).toHaveLength(2);
    expect(html.indexOf(exactAttribution)).toBeGreaterThan(html.indexOf('<body>'));

    const worker = readFileSync(fileURLToPath(new URL('../public/service-worker.ts', import.meta.url)), 'utf8');
    expect(worker).toContain("'/apps/web/src/auth-bootstrap.js'");
    expect(worker).not.toContain("'/apps/web/src/shell-entry.js'");
  });
});
