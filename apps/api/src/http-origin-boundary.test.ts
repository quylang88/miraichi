import { describe, expect, it } from 'vitest';
import { enforceOriginBoundary } from './http-origin-boundary.js';

function request(method: string, origin?: string, host = 'miraichi.example') {
  return { method, headers: { host, 'x-forwarded-proto': 'https', ...(origin ? { origin } : {}) } };
}

function response() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; },
    writeHead(code: number) { this.statusCode = code; },
    end(body?: unknown) { this.body = String(body ?? ''); }
  };
}

describe('HTTP origin boundary', () => {
  it('allows same-origin requests without wildcard CORS', () => {
    const out = response();
    expect(enforceOriginBoundary(request('POST', 'https://miraichi.example') as never, out as never)).toBe('continue');
    expect(Object.values(out.headers)).not.toContain('*');
  });

  it('allows exactly one configured local split origin with credentials', () => {
    const out = response();
    expect(enforceOriginBoundary(request('OPTIONS', 'http://localhost:3000', 'localhost:3001') as never, out as never, 'http://localhost:3000')).toBe('handled');
    expect(out.statusCode).toBe(204);
    expect(out.headers).toMatchObject({
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin'
    });
    expect(Object.values(out.headers)).not.toContain('*');
  });

  it('rejects a mismatched browser origin and still permits origin-less service traffic', () => {
    const rejected = response();
    expect(enforceOriginBoundary(request('POST', 'https://attacker.example') as never, rejected as never, 'http://localhost:3000')).toBe('handled');
    expect(rejected.statusCode).toBe(403);

    const service = response();
    expect(enforceOriginBoundary(request('POST') as never, service as never)).toBe('continue');
  });
});
