import { describe, expect, it, vi } from 'vitest';
import {
  parseEdgeRuntimeSmokeArgs,
  runEdgeRuntimeSmoke
} from './supabase-edge-runtime-smoke.js';

describe('Supabase Edge runtime smoke', () => {
  it('accepts only the postgres, auth, and aggregate scopes', () => {
    expect(parseEdgeRuntimeSmokeArgs(['--scope', 'postgres'])).toEqual({ scope: 'postgres' });
    expect(parseEdgeRuntimeSmokeArgs(['--scope', 'auth'])).toEqual({ scope: 'auth' });
    expect(parseEdgeRuntimeSmokeArgs(['--scope', 'all'])).toEqual({ scope: 'all' });
    expect(() => parseEdgeRuntimeSmokeArgs(['--scope', 'unknown'])).toThrow('Unsupported Edge runtime smoke scope');
  });

  it('requires a successful parameter, rollback, commit, and cleanup result', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({
      scope: 'postgres',
      parameterizedQuery: true,
      rollback: true,
      commit: true,
      cleanup: true
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(runEdgeRuntimeSmoke({
      scope: 'postgres',
      functionUrl: 'http://127.0.0.1:15421/functions/v1/miraichi-api',
      gatewayToken: 'edge-gateway-token-with-at-least-32-bytes',
      fetcher
    })).resolves.toMatchObject({ scope: 'postgres', rollback: true, commit: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe(
      'http://127.0.0.1:15421/functions/v1/miraichi-api/__runtime-smoke/postgres'
    );
  });

  it('fails when the runtime omits any transaction proof', async () => {
    await expect(runEdgeRuntimeSmoke({
      scope: 'postgres',
      functionUrl: 'http://127.0.0.1:15421/functions/v1/miraichi-api',
      gatewayToken: 'edge-gateway-token-with-at-least-32-bytes',
      fetcher: async () => new Response(JSON.stringify({
        scope: 'postgres', parameterizedQuery: true, rollback: false, commit: true, cleanup: true
      }), { status: 200 })
    })).rejects.toThrow('Edge postgres smoke did not prove all gates');
  });

  it('proves runtime auth primitives and the complete owner cookie boundary', async () => {
    const responses = [
      new Response(JSON.stringify({
        scope: 'auth-primitives', scrypt: true, randomBytes: true, hmacSession: true
      }), { status: 200 }),
      new Response(JSON.stringify({ error: { code: 'invalid_credentials', message: 'Invalid credentials.' } }), { status: 401 }),
      new Response(null, {
        status: 204,
        headers: { 'Set-Cookie': '__Host-miraichi_owner=v1.payload.signature; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800' }
      }),
      new Response(JSON.stringify({ provider: 'supabase-postgres', state: 'ready' }), { status: 200 }),
      new Response(JSON.stringify({ error: { code: 'authentication_required' } }), { status: 401 }),
      new Response(null, {
        status: 204,
        headers: { 'Set-Cookie': '__Host-miraichi_owner=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' }
      })
    ];
    const fetcher = vi.fn(async () => responses.shift()!);

    await expect(runEdgeRuntimeSmoke({
      scope: 'auth',
      functionUrl: 'http://127.0.0.1:15421/functions/v1/miraichi-api',
      gatewayToken: 'edge-gateway-token-with-at-least-32-bytes',
      ownerPassword: 'correct horse battery staple',
      refreshToken: 'refresh-token-with-at-least-thirty-two-bytes',
      fetcher
    })).resolves.toEqual({
      scope: 'auth',
      scrypt: true,
      randomBytes: true,
      hmacSession: true,
      invalidLogin: true,
      sessionCookie: true,
      protectedRoute: true,
      refreshIsolation: true,
      logout: true
    });
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
});
