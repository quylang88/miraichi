import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createOwnerPasswordHash, readOwnerAuthConfig } from './owner-auth.js';
import { enforceOwnerSession, handleOwnerAuthRoute } from './owner-auth-boundary.js';

function request(method: string, url: string, body = '', headers: Record<string, string> = {}) {
  const req = Readable.from(body ? [body] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function response() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string | number | readonly string[]>,
    body: '',
    setHeader(name: string, value: string | number | readonly string[]) { this.headers[name] = value; },
    writeHead(code: number, headers?: Record<string, string | number | readonly string[]>) {
      this.statusCode = code;
      Object.assign(this.headers, headers ?? {});
    },
    end(body?: unknown) { this.body = String(body ?? ''); }
  };
}

async function passwordConfig() {
  return readOwnerAuthConfig({
    APP_ENV: 'production',
    MIRAICHI_OWNER_PASSWORD_HASH: await createOwnerPasswordHash('correct horse battery staple'),
    MIRAICHI_SESSION_SECRET: 'session-secret-with-at-least-thirty-two-characters'
  });
}

describe('owner session HTTP boundary', () => {
  it('returns one generic failure for invalid login and a hardened cookie for valid login', async () => {
    const config = await passwordConfig();
    const invalid = response();
    await handleOwnerAuthRoute(
      request('POST', '/api/v1/auth/login', JSON.stringify({ password: 'wrong' }), { 'content-type': 'application/json' }) as never,
      invalid as never,
      config,
      Date.parse('2026-09-02T00:00:00.000Z')
    );
    expect(invalid.statusCode).toBe(401);
    expect(invalid.body).toBe(JSON.stringify({ error: { code: 'invalid_credentials', message: 'Invalid credentials.' } }));
    expect(invalid.body).not.toContain('password');

    const valid = response();
    await handleOwnerAuthRoute(
      request('POST', '/api/v1/auth/login', JSON.stringify({ password: 'correct horse battery staple' }), { 'content-type': 'application/json' }) as never,
      valid as never,
      config,
      Date.parse('2026-09-02T00:00:00.000Z')
    );
    expect(valid.statusCode).toBe(204);
    expect(String(valid.headers['Set-Cookie'])).toContain('__Host-miraichi_owner=');
    expect(String(valid.headers['Set-Cookie'])).toContain('HttpOnly');
    expect(String(valid.headers['Set-Cookie'])).toContain('Secure');
    expect(String(valid.headers['Set-Cookie'])).toContain('SameSite=Strict');
    expect(String(valid.headers['Set-Cookie'])).not.toContain('Domain=');
  });

  it('protects owner API routes and never accepts the service bearer token as an owner session', async () => {
    const config = await passwordConfig();
    const missing = response();
    expect(enforceOwnerSession(request('GET', '/api/v1/matches') as never, missing as never, config)).toBe('handled');
    expect(missing.statusCode).toBe(401);

    const bearer = response();
    expect(enforceOwnerSession(
      request('GET', '/api/v1/bankroll/accounts', '', { authorization: 'Bearer refresh-service-secret' }) as never,
      bearer as never,
      config
    )).toBe('handled');
    expect(bearer.statusCode).toBe(401);

    const login = response();
    const now = Date.parse('2026-09-02T00:00:00.000Z');
    await handleOwnerAuthRoute(
      request('POST', '/api/v1/auth/login', JSON.stringify({ password: 'correct horse battery staple' }), { 'content-type': 'application/json' }) as never,
      login as never,
      config,
      now
    );
    const cookie = String(login.headers['Set-Cookie']).split(';')[0]!;
    const allowed = response();
    expect(enforceOwnerSession(
      request('GET', '/api/v1/bankroll/accounts', '', { cookie }) as never,
      allowed as never,
      config,
      now + 1_000
    )).toBe('continue');
  });

  it('reports session state without exposing a token and clears the host-only cookie on logout', async () => {
    const config = await passwordConfig();
    const anonymous = response();
    await handleOwnerAuthRoute(request('GET', '/api/v1/auth/session') as never, anonymous as never, config);
    expect(anonymous.statusCode).toBe(200);
    expect(JSON.parse(anonymous.body)).toEqual({ authenticated: false });
    expect(anonymous.headers['Cache-Control']).toBe('no-store');

    const logout = response();
    await handleOwnerAuthRoute(request('POST', '/api/v1/auth/logout') as never, logout as never, config);
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['Set-Cookie'])).toContain('Max-Age=0');
    expect(String(logout.headers['Set-Cookie'])).toContain('Secure');
  });
});
