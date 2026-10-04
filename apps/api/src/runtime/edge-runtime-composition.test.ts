import { describe, expect, it, vi } from 'vitest';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import {
  createEdgeRuntimeSmokeHandler,
  createEdgeRequestHandler,
  createPostgresEdgeApiHandler
} from './edge-runtime-composition.js';

describe('Supabase Edge request composition', () => {
  const token = 'edge-gateway-token-with-at-least-32-bytes';

  it('denies before constructing or invoking the API handler', async () => {
    const createHandler = vi.fn(() => vi.fn(async () => new Response('unexpected')));
    const handle = createEdgeRequestHandler({
      env: { MIRAICHI_GATEWAY_TOKEN: token },
      createHandler
    });

    const response = await handle(new Request(
      'https://edge.example/functions/v1/miraichi-api/api/v1/health'
    ));
    expect(response.status).toBe(401);
    expect(createHandler).not.toHaveBeenCalled();
  });

  it('normalizes only the exact function mount and strips the gateway header before routing', async () => {
    const apiHandler = vi.fn(async (request: Request) => new Response(new URL(request.url).pathname));
    const handle = createEdgeRequestHandler({
      env: { MIRAICHI_GATEWAY_TOKEN: token },
      createHandler: () => apiHandler
    });
    const response = await handle(new Request(
      'https://edge.example/functions/v1/miraichi-api/api/v1/health?probe=1',
      { headers: { 'x-miraichi-gateway-token': token } }
    ));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('/api/v1/health');
    expect(new URL(apiHandler.mock.calls[0]![0].url).search).toBe('?probe=1');
    expect(apiHandler.mock.calls[0]![0].headers.has('x-miraichi-gateway-token')).toBe(false);

    const rejected = await handle(new Request(
      'https://edge.example/functions/v1/miraichi-api-evil/api/v1/health',
      { headers: { 'x-miraichi-gateway-token': token } }
    ));
    expect(rejected.status).toBe(404);

    const runtimeMount = await handle(new Request(
      'http://edge-runtime.internal/miraichi-api/api/v1/health',
      { headers: { 'x-miraichi-gateway-token': token } }
    ));
    expect(runtimeMount.status).toBe(200);
    expect(await runtimeMount.text()).toBe('/api/v1/health');
  });

  it('constructs the downstream API handler lazily once', async () => {
    const createHandler = vi.fn(() => vi.fn(async () => new Response('ok')));
    const handle = createEdgeRequestHandler({
      env: { MIRAICHI_GATEWAY_TOKEN: token },
      createHandler
    });
    const request = () => new Request(
      'https://edge.example/functions/v1/miraichi-api/api/v1/health',
      { headers: { 'x-miraichi-gateway-token': token } }
    );

    expect((await handle(request())).status).toBe(200);
    expect((await handle(request())).status).toBe(200);
    expect(createHandler).toHaveBeenCalledTimes(1);
  });

  it('composes cloud persistence from an injected Edge query client', async () => {
    const query = vi.fn();
    const client: PostgresQueryClient = {
      query: async <T extends Record<string, unknown>>() => {
        query();
        return { rows: [{ ok: 1 } as unknown as T], rowCount: 1 };
      },
      transaction: async (operation) => operation(client)
    };
    const handler = createPostgresEdgeApiHandler({
      APP_ENV: 'local',
      SUPABASE_DB_URL: 'postgresql://postgres:postgres@db:5432/postgres',
      SPORTSCORE_LIVE_MODE: 'disabled'
    }, client);

    const response = await handler(new Request(
      'http://edge-runtime.internal/api/v1/cloud-persistence/status'
    ));
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toMatchObject({
      provider: 'supabase-postgres', mode: 'supabase', state: 'ready'
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('routes hosted provider refresh through a separate token before database work', async () => {
    const query = vi.fn();
    const client: PostgresQueryClient = { query: query as PostgresQueryClient['query'], transaction: async (run) => run(client) };
    const handler = createPostgresEdgeApiHandler({ APP_ENV: 'local', SUPABASE_DB_URL: 'postgresql://postgres:postgres@db:5432/postgres' }, client);
    const response = await handler(new Request('https://staging.test/api/internal/providers/current/refresh', { method: 'POST' }));
    expect(response?.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps the runtime smoke route local, explicit, and behind gateway auth', async () => {
    const createRuntimeSmokeHandler = vi.fn(() => vi.fn(async () => Response.json({ ok: true })));
    const baseRequest = (tokenValue: string) => new Request(
      'http://edge-runtime.internal/miraichi-api/__runtime-smoke/postgres',
      { method: 'POST', headers: { 'x-miraichi-gateway-token': tokenValue } }
    );
    const disabled = createEdgeRequestHandler({
      env: { APP_ENV: 'staging', MIRAICHI_GATEWAY_TOKEN: token },
      createRuntimeSmokeHandler
    });
    expect((await disabled(baseRequest(token))).status).toBe(404);
    expect(createRuntimeSmokeHandler).not.toHaveBeenCalled();

    const enabled = createEdgeRequestHandler({
      env: {
        APP_ENV: 'local',
        MIRAICHI_EDGE_RUNTIME_SMOKE: 'enabled',
        MIRAICHI_GATEWAY_TOKEN: token
      },
      createRuntimeSmokeHandler
    });
    expect((await enabled(baseRequest('wrong-token'))).status).toBe(401);
    expect(createRuntimeSmokeHandler).not.toHaveBeenCalled();
    expect((await enabled(baseRequest(token))).status).toBe(200);
    expect(createRuntimeSmokeHandler).toHaveBeenCalledTimes(1);
  });

  it('exercises the exact owner crypto primitives only on the local auth smoke route', async () => {
    const client: PostgresQueryClient = {
      query: async () => ({ rows: [], rowCount: 0 }),
      transaction: async (operation) => operation(client)
    };
    const handler = createEdgeRuntimeSmokeHandler(client);
    const response = await handler(new Request(
      'http://edge-runtime.internal/__runtime-smoke/auth-primitives',
      { method: 'POST' }
    ));
    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      scope: 'auth-primitives', scrypt: true, randomBytes: true, hmacSession: true
    });
  });
});
