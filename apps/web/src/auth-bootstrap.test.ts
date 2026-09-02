import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { bootstrapAuthenticatedShell, renderOwnerLogin } from './auth-bootstrap.js';
import { getIndexHtml } from './index.js';

function response(ok: boolean, payload: unknown, status = ok ? 200 : 401): Response {
  return { ok, status, json: async () => payload } as Response;
}

describe('owner auth PWA bootstrap', () => {
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
    expect(html).not.toContain('src="/apps/web/src/shell-entry.js"');
    const exactAttribution = '<a href="https://sportscore.com/" rel="dofollow" title="Sports data by SportScore">Powered by SportScore</a>';
    expect(html.split(exactAttribution)).toHaveLength(2);
    expect(html.indexOf(exactAttribution)).toBeGreaterThan(html.indexOf('<body>'));

    const worker = readFileSync(fileURLToPath(new URL('../public/service-worker.ts', import.meta.url)), 'utf8');
    expect(worker).toContain("'/apps/web/src/auth-bootstrap.js'");
    expect(worker).not.toContain("'/apps/web/src/shell-entry.js'");
  });
});
