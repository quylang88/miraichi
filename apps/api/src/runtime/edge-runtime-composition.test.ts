import { describe, expect, it, vi } from 'vitest';
import { createEdgeRequestHandler } from './edge-runtime-composition.js';

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
});
