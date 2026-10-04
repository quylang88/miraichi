import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
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

const stages = ['postgres', 'auth-primitives', 'invalid-login', 'login', 'protected-route', 'refresh-isolation', 'logout'] as const;
const smokeOptions = {
  scope: 'all' as const,
  functionUrl: 'http://127.0.0.1:15421/functions/v1/miraichi-api',
  gatewayToken: 'private-gateway-token-with-at-least-32-bytes',
  ownerPassword: 'private-owner-password',
  refreshToken: 'private-refresh-token-with-at-least-32-bytes'
};
function successfulResponses(): Response[] {
  return [
    Response.json({ scope: 'postgres', parameterizedQuery: true, rollback: true, commit: true, cleanup: true }),
    Response.json({ scrypt: true, randomBytes: true, hmacSession: true }),
    Response.json({ error: { code: 'invalid_credentials', message: 'Invalid credentials.' } }, { status: 401 }),
    new Response(null, { status: 204, headers: { 'set-cookie': '__Host-miraichi_owner=v1.payload.signature; Path=/; HttpOnly; Secure; SameSite=Strict' } }),
    Response.json({ state: 'ready' }),
    Response.json({ error: { code: 'authentication_required' } }, { status: 401 }),
    new Response(null, { status: 204, headers: { 'set-cookie': '__Host-miraichi_owner=; Max-Age=0' } })
  ];
}

describe('bounded Edge requests', () => {
  it.each(stages)('aborts a stalled %s request at the default deadline with only a safe stage', async (stage) => {
    vi.useFakeTimers();
    let stalledSignal: AbortSignal | null | undefined;
    const responses = successfulResponses();
    let index = 0;
    let rejectStalled: ((reason: Error) => void) | undefined;
    const fetcher: typeof fetch = async (_url, init) => {
      if (index++ !== stages.indexOf(stage)) return responses.shift()!;
      stalledSignal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        rejectStalled = reject;
        stalledSignal?.addEventListener('abort', () => reject(new Error('private password cookie Authorization raw response')), { once: true });
      });
    };
    const result = runEdgeRuntimeSmoke({ ...smokeOptions, fetcher }).catch((error: unknown) => error);
    try {
      await vi.advanceTimersByTimeAsync(25_000);
      expect(stalledSignal?.aborted).toBe(true);
      expect((await result as Error).message).toBe(`Edge runtime smoke timed out at stage: ${stage}`);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      rejectStalled?.(new Error('test cleanup'));
      await result;
      vi.useRealTimers();
    }
  });

  it('bounds a real HTTP response whose body never completes', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server address');
    const cleanupTimer = setTimeout(() => server.closeAllConnections(), 500);
    try {
      await expect(runEdgeRuntimeSmoke({
        ...smokeOptions, scope: 'postgres',
        functionUrl: `http://127.0.0.1:${address.port}`,
        requestTimeoutMs: 50
      })).rejects.toThrow('Edge runtime smoke timed out at stage: postgres');
    } finally {
      clearTimeout(cleanupTimer);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 1000);

  it('redacts transport error messages and releases the deadline timer', async () => {
    vi.useFakeTimers();
    try {
      await expect(runEdgeRuntimeSmoke({
        ...smokeOptions, scope: 'postgres',
        fetcher: async () => { throw new Error('private-owner-password Authorization cookie raw response'); }
      })).rejects.toThrow(/^Edge runtime smoke request failed at stage: postgres$/);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

it('exits the real smoke CLI with a safe failure after aborting a stalled native response', async () => {
  let responseClosed = false;
  const server = createServer((_request, response) => {
    response.on('close', () => { responseClosed = true; });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  const root = mkdtempSync(path.join(tmpdir(), 'miraichi-smoke-cli-'));
  mkdirSync(path.join(root, '.secrets'));
  writeFileSync(path.join(root, '.secrets/edge.local.env'), '', { mode: 0o600 });
  try {
    const result = await new Promise<{ code: number | string | undefined; stdout: string; stderr: string }>((resolve) => {
      execFile(process.execPath, [
        '--import', import.meta.resolve('tsx'),
        path.resolve('scripts/supabase-edge-runtime-smoke.ts'), '--scope', 'postgres'
      ], {
        cwd: root, timeout: 30_000,
        env: { ...process.env, MIRAICHI_GATEWAY_TOKEN: smokeOptions.gatewayToken,
          MIRAICHI_EDGE_FUNCTION_URL: `http://127.0.0.1:${address.port}` }
      }, (error, stdout, stderr) => resolve({ code: error?.code, stdout, stderr }));
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.trim()).toBe('Edge runtime smoke timed out at stage: postgres');
    expect(responseClosed).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
}, 35_000);

it.each([
  ['Error: failed to resolve npm:postgres@3.4.7; password=fixture-private', 'edge_module_resolution_failed'],
  ['worker boot error: SyntaxError with token=fixture-private', 'edge_syntax_error'],
  ['TypeError: fixture-private', 'edge_type_error'],
  ['Serving functions with cookie=fixture-private', 'edge_health_unavailable']
])('prints only a safe startup classification for %s', async (log, errorCode) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'miraichi-startup-log-'));
  try {
    const file = path.join(directory, 'edge.log');
    writeFileSync(file, log);
    const result = await new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
      execFile(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/supabase-edge-runtime-smoke.ts', '--startup-log', file],
        { timeout: 10000 }, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
    });
    expect(JSON.parse(result.stdout)).toEqual({ stage: 'health', errorCode });
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('fixture-private');
  } finally { rmSync(directory, {recursive: true, force: true}); }
});
